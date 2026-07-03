/**
 * Import Patient Package Subscriptions from MySQL (shanthiayur database)
 * Run this script when MySQL is available to pull subscription data into the JSON db.
 * 
 * Usage: node import-package-subs.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'clinic-data.json');

async function importSubscriptions() {
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

    // First check what tables exist
    const [tables] = await pool.execute("SHOW TABLES LIKE 'pack_%'");
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Found pack_ tables:', tableNames);

    // Find the subscription table
    const subTable = tableNames.find(t => t.toLowerCase().includes('patientpackage'));
    if (!subTable) {
      console.log('ERROR: No patient package subscription table found!');
      console.log('Available tables:', tableNames.join(', '));
      await pool.end();
      return;
    }

    console.log('Using table:', subTable);

    // Show columns
    const [cols] = await pool.execute(`SHOW COLUMNS FROM ${subTable}`);
    console.log('Columns:', cols.map(c => c.Field).join(', '));

    // Query subscriptions
    const [rows] = await pool.execute(`
      SELECT 
        ps.PPS_PatientDocNo as mrNo,
        CONCAT(COALESCE(p.Patient_FirstName,''), ' ', COALESCE(p.Patient_MiddleName,''), ' ', COALESCE(p.Patient_LastName,'')) as patientName,
        p.Patient_Mobile as mobile,
        ps.PPS_DPKG_DocNo as packageCode,
        pkg.DPKG_Name as packageName,
        DATE_FORMAT(ps.PPS_StartDate, '%d-%m-%Y') as startDate,
        DATE_FORMAT(ps.PPS_EndDate, '%d-%m-%Y') as endDate,
        ps.PPS_TotalSessions as totalSessions,
        ps.PPS_UsedSessions as usedSessions,
        (ps.PPS_TotalSessions - COALESCE(ps.PPS_UsedSessions, 0)) as balanceSessions
      FROM ${subTable} ps
      LEFT JOIN patientmaster p ON ps.PPS_PatientDocNo = p.Patient_DocNo
      LEFT JOIN pack_definedpackagesmaster pkg ON ps.PPS_DPKG_DocNo = pkg.DPKG_DocNo
      WHERE (ps.PPS_isDeleted IS NULL OR ps.PPS_isDeleted = 0)
      ORDER BY ps.PPS_PatientDocNo
    `);

    console.log(`Found ${rows.length} subscriptions`);

    // Load and update JSON database
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db.packageSubscriptions = rows;
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
    
    console.log(`Saved ${rows.length} subscriptions to clinic-data.json`);
    await pool.end();

  } catch (e) {
    console.log('Error:', e.message);
    if (pool) await pool.end().catch(() => {});
  }
}

importSubscriptions();
