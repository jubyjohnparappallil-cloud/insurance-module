/**
 * Import invoices with CORRECT patient data from MySQL (shanthiayur database)
 * Run this on the clinic machine where MySQL is running.
 * 
 * This reads bill_header → joins with patientmaster via BillHD_PatientDocNo
 * to get the correct patient name and MR number for each invoice.
 * 
 * Usage: node import-invoices-from-mysql.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'clinic-data.json');

async function main() {
  console.log('Connecting to MySQL (shanthiayur)...');
  
  let pool;
  try {
    pool = mysql.createPool({ 
      host: 'localhost', 
      port: 3306, 
      user: 'root', 
      password: 'null', 
      database: 'shanthiayur', 
      connectionLimit: 2 
    });

    // Get invoices with patient info
    console.log('Fetching invoices with patient data...');
    const [invoices] = await pool.execute(`
      SELECT 
        h.BillHD_DocNo as invoiceNo,
        DATE_FORMAT(h.BillHD_Date, '%d-%m-%Y') as date,
        h.BillHD_PatientDocNo as mrNo,
        CONCAT(COALESCE(p.Patient_FirstName,''), ' ', COALESCE(p.Patient_MiddleName,''), ' ', COALESCE(p.Patient_LastName,'')) as patientName,
        p.Patient_Mobile as mobile,
        COALESCE(d.DoctorName, '') as doctor,
        COALESCE(h.BillHD_SubTotal, 0) as subtotal,
        COALESCE(h.BillHD_DiscountAmount, 0) as discount,
        COALESCE(h.BillHD_TaxAmount, 0) as tax,
        COALESCE(h.BillHD_TotalAmount, 0) as total,
        COALESCE(h.BillHD_PaidAmount, 0) as paid,
        COALESCE(h.BillHD_DueAmount, 0) as due,
        CASE WHEN h.BillHD_PayModeCash > 0 THEN 'Cash' WHEN h.BillHD_PayModeCard > 0 THEN 'Card' ELSE 'Cash' END as payMode,
        CASE WHEN h.BillHD_DueAmount > 0 THEN 'Due' ELSE 'Paid' END as status,
        'Cash bill' as type,
        COALESCE(h.BillHD_CreatedBy, 'admin') as createdBy
      FROM bill_header h
      LEFT JOIN patientmaster p ON h.BillHD_PatientDocNo = p.Patient_DocNo
      LEFT JOIN doctormaster d ON h.BillHD_doctr_DocNo = d.Doctor_DocNo
      WHERE (h.BillHD_isDeleted IS NULL OR h.BillHD_isDeleted = 0)
      ORDER BY h.BillHD_Date DESC, h.BillHD_DocNo DESC
    `);

    console.log(`Found ${invoices.length} invoices`);

    // Get invoice details (line items)
    console.log('Fetching invoice details...');
    const [details] = await pool.execute(`
      SELECT 
        Bill_HD_DocNo as invoiceNo,
        BillD_SlNo as slNo,
        TariffDescription as description,
        BillD_Qty as qty,
        BillD_Amount as amount,
        BillD_DiscountAmt as discount,
        BillD_TaxAmount as tax,
        BillD_TotalAmount as total
      FROM bill_detail
      WHERE (BillD_isDeleted IS NULL OR BillD_isDeleted = 0)
    `);

    console.log(`Found ${details.length} line items`);

    // Group details by invoice
    const detailsByInv = {};
    details.forEach(d => {
      if (!detailsByInv[d.invoiceNo]) detailsByInv[d.invoiceNo] = [];
      detailsByInv[d.invoiceNo].push(d);
    });

    // Attach items to invoices
    invoices.forEach(inv => {
      inv.items = detailsByInv[inv.invoiceNo] || [];
    });

    // Save to JSON
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db.invoices = invoices;
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
    
    console.log(`\nSaved ${invoices.length} invoices to clinic-data.json`);
    console.log('Invoice List will now show correct patient names and MR numbers.');

    await pool.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (pool) await pool.end().catch(() => {});
  }
}

main();
