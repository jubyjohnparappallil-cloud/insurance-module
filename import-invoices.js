/**
 * Import Invoices (bill_header + bill_detail) and Receipts (invoicereceipts)
 * Usage: node import-invoices.js
 */
const fs = require('fs');
const readline = require('readline');
const SQL_FILE = 'shanthiayur_db.sql';
const DB_FILE = 'clinic-data.json';

function parseRow(line) {
  let s = line.trim();
  if (s.startsWith('(')) s = s.substring(1);
  if (s.endsWith('),')) s = s.slice(0,-2);
  else if (s.endsWith(');')) s = s.slice(0,-2);
  else if (s.endsWith(')')) s = s.slice(0,-1);
  const values = []; let i=0, val='', inQ=false;
  while (i < s.length) {
    const ch = s[i];
    if (inQ) {
      if (ch==='\\') { val+=s[i+1]||''; i+=2; continue; }
      if (ch==="'") { if(s[i+1]==="'"){val+="'";i+=2;continue;} inQ=false; i++; continue; }
      val+=ch; i++;
    } else {
      if (ch==="'") { inQ=true; i++; }
      else if (ch===',') { values.push(val.trim()==='NULL'?'':val.trim()); val=''; i++; }
      else { val+=ch; i++; }
    }
  }
  values.push(val.trim()==='NULL'?'':val.trim());
  return values;
}

function pad2(n){return String(n).padStart(2,'0');}
function fmtDate(s){
  if(!s||s.startsWith('0000')||s.startsWith('0001')||s.startsWith('1900'))return'';
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m){const y=parseInt(m[1]),mo=parseInt(m[2]),d=parseInt(m[3]);if(y<1900||y>2030)return'';return pad2(d)+'-'+pad2(mo)+'-'+y;}
  return'';
}

async function main() {
  console.log('Importing invoices & receipts...');
  const rl = readline.createInterface({input:fs.createReadStream(SQL_FILE,'utf8'),crlfDelay:Infinity});

  let billHdrCols=[], billDtlCols=[], receiptCols=[];
  let invoices=[], invoiceDetails=[], receipts=[];
  let ct='', lineNum=0;

  // Doctor map for matching
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const doctors = db.doctors || [];
  const patients = db.patients || [];
  const doctorMap = {};
  doctors.forEach((d,i) => { 
    // Build code map from known codes
    const codes = ['EM0057','EM0058','EM0059','EM0060','EM0061','EM0062','EM0063','EM0064','EM0065','EM0066','EM0067','EM0068','EM0069','EM0070','EM0071','EM0072'];
    if (i < codes.length) doctorMap[codes[i]] = d.name;
  });

  for await (const line of rl) {
    lineNum++;
    if(lineNum%100000===0) process.stdout.write('\r  Lines: '+lineNum+'...');

    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) {
      ct = im[1].toLowerCase();
      const cols = im[2].split(',').map(c=>c.trim().replace(/`/g,''));
      if (ct==='bill_header') billHdrCols=cols;
      else if (ct==='bill_detail') billDtlCols=cols;
      else if (ct==='invoicereceipts') receiptCols=cols;
      continue;
    }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (!line.startsWith("('")) continue;

    const vals = parseRow(line);
    const get=(cols,col)=>{const i=cols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};

    if (ct==='bill_header' && billHdrCols.length) {
      const billNo = get(billHdrCols,'BillHD_DocNo');
      const date = fmtDate(get(billHdrCols,'BillHD_Date'));
      const subtotal = get(billHdrCols,'BillHD_SubtotalAmt');
      const discount = get(billHdrCols,'BillHD_DiscountAmt');
      const tax = get(billHdrCols,'BillHD_TaxAmount');
      const total = get(billHdrCols,'BillHD_TotalAmount');
      const cash = get(billHdrCols,'BillHD_PayModeCash');
      const card = get(billHdrCols,'BillHD_PayModeCard');
      const online = get(billHdrCols,'BillHD_PaymodeOnline');
      const doctorCode = get(billHdrCols,'BillHD_doctr_DocNo');
      const visitDocNo = get(billHdrCols,'BillHD_Vst_Docno');
      const paidAmt = get(billHdrCols,'BillHD_PaidAmount');
      const dueAmt = get(billHdrCols,'BillHD_DueAmount');
      if (!billNo) continue;
      
      // Find patient from appointment/visit link
      const appt = db.appointments?.find(a => a.visitDocNo === visitDocNo);
      const mrNo = appt ? appt.mrNo : '';
      const patientName = appt ? appt.patient : '';

      invoices.push({
        invoiceNo: billNo,
        date,
        mrNo,
        patientName,
        subtotal: parseFloat(subtotal)||0,
        discount: parseFloat(discount)||0,
        tax: parseFloat(tax)||0,
        total: parseFloat(total)||0,
        paid: parseFloat(paidAmt || cash)||0,
        due: parseFloat(dueAmt)||0,
        payMode: parseFloat(cash)>0 ? 'Cash' : parseFloat(card)>0 ? 'Card' : parseFloat(online)>0 ? 'Online' : 'Cash',
        doctor: doctorMap[doctorCode] || doctorCode || '',
        status: parseFloat(dueAmt)>0 ? 'Due' : 'Paid'
      });
    }
    else if (ct==='bill_detail' && billDtlCols.length) {
      const detNo = get(billDtlCols,'BillD_DocNo');
      const billNo = get(billDtlCols,'Bill_HD_DocNo');
      const qty = get(billDtlCols,'BillD_Qty');
      const amount = get(billDtlCols,'BillD_Amount');
      const discPer = get(billDtlCols,'BillD_DiscountPerc');
      const discAmt = get(billDtlCols,'BillD_DiscountAmt');
      const taxPer = get(billDtlCols,'BillD_TaxPerc');
      const taxAmt = get(billDtlCols,'BillD_TaxAmount');
      const total = get(billDtlCols,'BillD_TotalAmount');
      const desc = get(billDtlCols,'TariffDescription');
      const isDeleted = get(billDtlCols,'BillD_isDeleted');
      if (isDeleted==='1' || !billNo) continue;
      invoiceDetails.push({
        invoiceNo: billNo,
        slNo: get(billDtlCols,'BillD_SlNo'),
        description: desc,
        qty: parseFloat(qty)||1,
        amount: parseFloat(amount)||0,
        discount: parseFloat(discAmt)||0,
        tax: parseFloat(taxAmt)||0,
        total: parseFloat(total)||0
      });
    }
    else if (ct==='invoicereceipts' && receiptCols.length) {
      const receiptNo = get(receiptCols,'invr_docno');
      const mrNo = get(receiptCols,'invr_patDocNo');
      const date = fmtDate(get(receiptCols,'invr_date'));
      const type = get(receiptCols,'invr_type');
      const remarks = get(receiptCols,'invr_remarks');
      const cash = get(receiptCols,'invr_cash');
      const card = get(receiptCols,'invr_card');
      const online = get(receiptCols,'invr_online');
      const amountPaid = get(receiptCols,'invr_amountpaid');
      const isDeleted = get(receiptCols,'invr_isDeleted');
      if (isDeleted==='1' || !receiptNo) continue;

      const pat = patients.find(p => p.mrNo === mrNo);
      receipts.push({
        receiptNo,
        date,
        mrNo,
        patientName: pat ? (pat.firstName + ' ' + pat.lastName).trim() : mrNo,
        type: type === 'DUEPAY' ? 'Due Payment' : type === 'ADVANCE' ? 'Advance' : type,
        amount: parseFloat(amountPaid)||0,
        mode: parseFloat(cash)>0 ? 'Cash' : parseFloat(card)>0 ? 'Card' : parseFloat(online)>0 ? 'Online' : 'Cash',
        remarks: remarks || '',
        status: 'Paid'
      });
    }
  }

  console.log('\r  Lines: '+lineNum+' ✓\n');
  console.log('  Invoices:        '+invoices.length);
  console.log('  Invoice Details: '+invoiceDetails.length);
  console.log('  Receipts:        '+receipts.length);

  // Link details to invoices
  const detailsByInv = {};
  invoiceDetails.forEach(d => {
    if (!detailsByInv[d.invoiceNo]) detailsByInv[d.invoiceNo] = [];
    detailsByInv[d.invoiceNo].push(d);
  });
  invoices.forEach(inv => {
    inv.items = detailsByInv[inv.invoiceNo] || [];
  });

  // Save
  db.invoices = invoices;
  db.receipts = receipts;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n  ✅ Saved to clinic-data.json');
  console.log('  Sample invoice:', JSON.stringify(invoices[0], null, 2).substring(0, 300));
  console.log('  Sample receipt:', JSON.stringify(receipts[0]));
}

main().catch(e => console.error('ERROR:', e));
