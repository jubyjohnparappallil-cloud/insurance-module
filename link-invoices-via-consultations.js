/**
 * Link invoices to patients using consultation data.
 * 
 * Strategy: Match invoices to consultations by date + doctor.
 * Since both are created from the same patient visit, this gives
 * the correct patient for each invoice.
 * 
 * For unmatched invoices, use receipts data (which has mrNo from original SQL).
 * 
 * Usage: node link-invoices-via-consultations.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'clinic-data.json');
const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const invoices = db.invoices || [];
const consultations = db.consultations || [];
const receipts = db.receipts || [];
const patients = db.patients || [];

// Build patient name map
const patientMap = {};
patients.forEach(p => {
  const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim();
  patientMap[p.mrNo] = name || p.firstName || '';
});

// Normalize doctor names for matching
function normDoctor(d) {
  return (d || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// Build consultation index by date + doctor -> [{mrNo, patientName}]
// Date in consultations is stored as consultDate
const consultIndex = {};
consultations.forEach(c => {
  if (!c.mrNo || !c.consultDate) return;
  // consultDate format varies - could be DD-MM-YYYY or DD/Mon/YYYY
  let dateKey = c.consultDate;
  // Normalize to DD-MM-YYYY
  const parts = dateKey.split('/');
  if (parts.length === 3) {
    const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const mm = months[parts[1]] || parts[1];
    dateKey = parts[0].padStart(2,'0') + '-' + mm + '-' + parts[2];
  }
  const doctor = normDoctor(c.doctor);
  const key = dateKey + '|' + doctor;
  if (!consultIndex[key]) consultIndex[key] = [];
  consultIndex[key].push({ mrNo: c.mrNo, patientName: c.patientName || patientMap[c.mrNo] || '' });
});

console.log('Consultation keys:', Object.keys(consultIndex).length);

// Also build receipt index: date + amount -> mrNo, patientName
const receiptIndex = {};
receipts.forEach(r => {
  if (!r.mrNo || !r.date) return;
  const key = r.date + '|' + r.mrNo;
  receiptIndex[key] = { mrNo: r.mrNo, patientName: r.patientName || patientMap[r.mrNo] || '' };
});

// Now try to link each invoice
let linkedByConsult = 0;
let linkedByReceipt = 0;
let unlinked = 0;

// Track which consultations have been used (to avoid duplicates)
const usedConsults = {};

invoices.forEach(inv => {
  if (inv.mrNo && inv.patientName) return; // already linked
  
  const invDate = inv.date;
  const invDoctor = normDoctor(inv.doctor);
  const key = invDate + '|' + invDoctor;
  
  // Try consultation match
  if (consultIndex[key] && consultIndex[key].length > 0) {
    // Find one that hasn't been used yet
    const usedKey = key + '|' + inv.invoiceNo;
    const available = consultIndex[key];
    if (available.length > 0) {
      const match = available.shift(); // take first available
      inv.mrNo = match.mrNo;
      inv.patientName = match.patientName;
      linkedByConsult++;
      return;
    }
  }
  
  // Try matching by date - find any consultation on same date with same doctor
  // Also try partial doctor name match
  const dateConsults = Object.keys(consultIndex).filter(k => k.startsWith(invDate + '|'));
  for (const dk of dateConsults) {
    const dkDoctor = dk.split('|')[1];
    if (dkDoctor.includes(invDoctor.split(' ')[0]) || invDoctor.includes(dkDoctor.split(' ')[0])) {
      if (consultIndex[dk].length > 0) {
        const match = consultIndex[dk].shift();
        inv.mrNo = match.mrNo;
        inv.patientName = match.patientName;
        linkedByConsult++;
        return;
      }
    }
  }
  
  unlinked++;
});

console.log(`\nResults:`);
console.log(`  Linked via consultations: ${linkedByConsult}`);
console.log(`  Unlinked: ${unlinked}`);
console.log(`  Total: ${invoices.length}`);

// For unlinked ones, check if there's receipt data with same date
let receiptLinked = 0;
invoices.forEach(inv => {
  if (inv.mrNo) return;
  // Try to find a receipt on same date
  const matchingReceipts = receipts.filter(r => r.date === inv.date && r.mrNo);
  if (matchingReceipts.length === 1) {
    inv.mrNo = matchingReceipts[0].mrNo;
    inv.patientName = matchingReceipts[0].patientName || patientMap[matchingReceipts[0].mrNo] || '';
    receiptLinked++;
  }
});

if (receiptLinked > 0) console.log(`  Additionally linked via receipts: ${receiptLinked}`);

const finalLinked = invoices.filter(i => i.mrNo).length;
const finalUnlinked = invoices.filter(i => !i.mrNo).length;
console.log(`\nFinal: ${finalLinked} linked, ${finalUnlinked} without patient info`);

// Save
db.invoices = invoices;
fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
console.log('\nSaved to clinic-data.json');

// Show some samples
console.log('\nSample linked invoices:');
invoices.filter(i => i.mrNo).slice(0, 5).forEach(i => {
  console.log(`  ${i.invoiceNo} | ${i.date} | MR:${i.mrNo} | ${i.patientName.substring(0,30)} | Dr:${i.doctor}`);
});

// Check C-1058 specifically
const c1058 = invoices.find(i => i.invoiceNo === 'C-1058');
if (c1058) {
  console.log('\n  C-1058:', JSON.stringify({mrNo: c1058.mrNo, patientName: c1058.patientName, date: c1058.date, doctor: c1058.doctor, total: c1058.total}));
}
