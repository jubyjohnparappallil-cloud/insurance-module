/**
 * IMPORT DIRECTLY FROM EXCEL FILE
 * Reads patients-data.txt.xlsx (or any .xlsx) and imports
 * only "Shanthi Medical Center" patients into clinic-data.json
 *
 * Usage:
 *   node import-excel-direct.js              (run import)
 *   node import-excel-direct.js --dry-run    (preview only)
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────
const DB_FILE      = path.join(__dirname, 'clinic-data.json');
const DRY_RUN      = process.argv.includes('--dry-run');
const TARGET_BRANCH = 'shanthi medical center';

// Find the Excel file
const POSSIBLE = [
  'patients-data.txt.xlsx',
  'patients-data.xlsx',
  'patients-data.txt',
  'SHANTHI MEDICAL CENTER PATIENT DATA (2).xlsx',
  'SHANTHI MEDICAL CENTER PATIENT DATA.xlsx',
];

// ── Helpers ──────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }

function clean(v) {
  if (v === null || v === undefined) return '';
  const t = String(v).trim();
  const junk = ['na','n/a','-','none','null','info@na.com','nil@gmail.com',
                 'nil','0','#n/a','999-9999-9999999-9'];
  if (junk.includes(t.toLowerCase())) return '';
  if (t.toLowerCase().endsWith('@na.com')) return '';
  return t;
}

function normalizeGender(v) {
  const t = (v || '').toString().trim().toUpperCase();
  if (t === 'M' || t === 'MALE')   return 'Male';
  if (t === 'F' || t === 'FEMALE') return 'Female';
  return '';
}

function normalizeMobile(v) {
  const t = clean(v);
  return t ? t.replace(/[\s\-\(\)\.]/g, '') : '';
}

function normalizeNationality(v) {
  const t = clean(v);
  // These are placeholder nationalities in old data
  const placeholders = ['i-kiribati','yemeni'];
  if (!t || placeholders.includes(t.toLowerCase())) return '';
  return t;
}

function parseExcelDate(v) {
  if (v === null || v === undefined || v === '') return '';
  
  // If xlsx gives us a Date object
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900 || v.getFullYear() > 2030) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return pad2(v.getDate()) + '/' + months[v.getMonth()] + '/' + v.getFullYear();
  }
  
  // If it's a number (Excel serial date)
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d || d.y <= 1900 || d.y > 2030) return '';
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return pad2(d.d) + '/' + months[d.m - 1] + '/' + d.y;
    } catch(e) { return ''; }
  }
  
  // String date
  const s = String(v).trim();
  if (!s || s.includes('1900') || s.includes('1899')) return '';
  
  // DD-Mon-YYYY e.g. "15-Mar-1985"
  const m1 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (m1) {
    const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return pad2(parseInt(m1[1])) + '/' + cap(m1[2]) + '/' + m1[3];
  }
  
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (parseInt(m2[1]) <= 1900) return '';
    return pad2(parseInt(m2[3])) + '/' + months[parseInt(m2[2]) - 1] + '/' + m2[1];
  }

  return '';
}

function parseRegDate(v) {
  if (!v) return '';
  
  // Excel serial number
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return '';
      return pad2(d.d) + '-' + pad2(d.m) + '-' + d.y;
    } catch(e) { return ''; }
  }
  
  if (v instanceof Date) {
    return pad2(v.getDate()) + '-' + pad2(v.getMonth() + 1) + '-' + v.getFullYear();
  }
  
  const s = String(v).trim();
  if (!s) return '';
  
  // DD-Mon-YYYY  e.g. "18-Feb-2015"
  const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const mon = months[m1[2].toLowerCase()] || '01';
    return pad2(parseInt(m1[1])) + '-' + mon + '-' + m1[3];
  }
  
  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return pad2(parseInt(m2[1])) + '-' + pad2(parseInt(m2[2])) + '-' + m2[3];
  
  // YYYY-MM-DD
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return pad2(parseInt(m3[3])) + '-' + m3[2] + '-' + m3[1];

  return '';
}

function todayStr() {
  const d = new Date();
  return pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear();
}

// ── Main ──────────────────────────────────────────────────────────
function main() {
  // Find file
  let excelFile = null;
  for (const fn of POSSIBLE) {
    const fp = path.join(__dirname, fn);
    if (fs.existsSync(fp)) { excelFile = fp; break; }
  }

  if (!excelFile) {
    console.error('\n❌  Excel file not found in:', __dirname);
    console.error('Expected one of:');
    POSSIBLE.forEach(f => console.error('   -', f));
    process.exit(1);
  }

  console.log(`\n📂  Reading: ${path.basename(excelFile)}`);

  // Read Excel
  const workbook = XLSX.readFile(excelFile, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  console.log(`    Sheet: "${sheetName}"`);

  const sheet = workbook.Sheets[sheetName];
  
  // Convert to array of arrays (raw rows)
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  console.log(`    Total rows: ${rawRows.length}`);

  // Find header row
  let headerIdx = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const row = rawRows[i].map(c => String(c || '').toUpperCase().trim());
    if (row.includes('BRANCH') && row.includes('FILE')) {
      headerIdx = i;
      headers = row;
      break;
    }
  }

  if (headerIdx === -1) {
    // Use positional: col0=empty, col1=empty, col2=BRANCH, col3=FILE, col4=FIRST NAME...
    console.log('    No header row found — using positional mapping');
    headers = ['','','BRANCH','FILE','FIRST NAME','LAST NAME','GENDER','MOBILE',
               'TELEPHONE','DATE OF BIRTH','EMAIL','EMIRATES ID','PASSPORT',
               'NATIONALITY','DATE CREATED'];
    headerIdx = -1;
  } else {
    console.log(`    Headers at row ${headerIdx + 1}`);
    // Show column positions for key fields
    ['BRANCH','FILE','FIRST NAME','LAST NAME','GENDER','MOBILE','DATE OF BIRTH'].forEach(h => {
      const idx = headers.indexOf(h);
      if (idx >= 0) process.stdout.write(`    ${h}=col${idx}  `);
    });
    console.log('');
  }

  const startRow = headerIdx === -1 ? 0 : headerIdx + 1;
  const dataRows = rawRows.slice(startRow).filter(r => r.some(c => c !== ''));

  console.log(`    Data rows: ${dataRows.length}\n`);

  // Load DB
  let db = { patients: [], nextIds: { patient: 1 } };
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch(e) { console.error('⚠️  Bad clinic-data.json:', e.message); process.exit(1); }
  }
  if (!db.patients) db.patients = [];

  // Backup
  if (!DRY_RUN) {
    const bak = path.join(__dirname, `clinic-data.backup.${Date.now()}.json`);
    fs.writeFileSync(bak, JSON.stringify(db, null, 2));
    console.log(`💾  Backup: ${path.basename(bak)}`);
  }

  // Existing MR numbers
  const existingMrNos = new Set(db.patients.map(p => String(p.mrNo).trim()));
  const usedMrNos = new Set(existingMrNos);

  let nextMr = (db.nextIds && db.nextIds.patient) ? db.nextIds.patient : 1;
  db.patients.forEach(p => {
    const n = parseInt(p.mrNo);
    if (!isNaN(n) && n >= nextMr) nextMr = n + 1;
  });

  // Process
  let added = 0, skippedBranch = 0, skippedDup = 0, skippedInvalid = 0;
  const newPatients = [];

  function col(row, name) {
    const idx = headers.indexOf(name.toUpperCase());
    return idx >= 0 ? String(row[idx] || '') : '';
  }

  for (const row of dataRows) {
    const branch = col(row, 'BRANCH').toLowerCase().trim();
    if (!branch.includes(TARGET_BRANCH)) { skippedBranch++; continue; }

    // MR Number
    const mrRaw = clean(col(row, 'FILE'));
    const mrNum = parseInt(mrRaw);
    let mrNo;
    if (!mrRaw || isNaN(mrNum) || mrNum === 0) {
      mrNo = String(nextMr++);
    } else {
      mrNo = String(mrNum);
    }

    if (usedMrNos.has(mrNo)) { skippedDup++; continue; }
    usedMrNos.add(mrNo);

    const firstName = clean(col(row, 'FIRST NAME')) || '(Unknown)';
    const lastName  = clean(col(row, 'LAST NAME'));

    if (firstName === '(Unknown)' && !lastName) { skippedInvalid++; continue; }

    const gender      = normalizeGender(col(row, 'GENDER'));
    const mobile      = normalizeMobile(col(row, 'MOBILE'));
    const homeTel     = normalizeMobile(col(row, 'TELEPHONE'));
    const dob         = parseExcelDate(row[headers.indexOf('DATE OF BIRTH')] || col(row, 'DATE OF BIRTH'));
    const email       = clean(col(row, 'EMAIL'));
    let   emiratesId  = clean(col(row, 'EMIRATES ID'));
    const passport    = clean(col(row, 'PASSPORT'));
    const nationality = normalizeNationality(col(row, 'NATIONALITY'));
    const regDate     = parseRegDate(row[headers.indexOf('DATE CREATED')] || col(row, 'DATE CREATED')) || todayStr();

    // Remove scientific notation from Emirates ID
    if (emiratesId && (emiratesId.includes('E+') || emiratesId.includes('e+'))) emiratesId = '';
    // Remove placeholder EID
    if (emiratesId === '999-9999-9999999-9') emiratesId = '';

    newPatients.push({
      mrNo,
      recordNo:       '',
      firstName,
      middleName:     '',
      lastName,
      mobile,
      city:           '',
      area:           '',
      address:        '',
      poBox:          '',
      emirate:        '',
      status:         'Active',
      eid:            emiratesId,
      language:       'English',
      category:       'General',
      dob,
      years:          '',
      months:         '',
      days:           '',
      gender,
      regDate,
      religion:       'Not Specified',
      email,
      passport,
      marital:        '',
      nationality,
      job:            '',
      company:        '',
      whatsapp:       '',
      homeTel,
      referral:       '',
      notes:          '',
      know:           'Imported',
      packageName:    'None',
      packageStart:   '',
      packageVisits:  '0',
      packageBalance: '0',
      policyName:     '',
      policyExpiry:   '',
      insuranceLimit: '0',
      insuranceCoPay: '0',
      emergencyName:  '',
      emergencyPhone: '',
      relationship:   '',
      noOfChildren:   '0',
      eidExpiry:      '',
      vip:            false,
      pregnant:       false,
      medication:     false,
      importedFrom:   'Excel Import - Shanthi Medical Center'
    });
    added++;
  }

  // Summary
  console.log('📊  Import Summary:');
  console.log(`    Total rows read       : ${dataRows.length}`);
  console.log(`    ✅  Ready to import    : ${added}`);
  console.log(`    ⏭️   Duplicate MR skip  : ${skippedDup}`);
  console.log(`    🏥  Other branch skip  : ${skippedBranch}`);
  console.log(`    ⚠️   Invalid skip       : ${skippedInvalid}`);

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN — no changes saved.');
    console.log('\nFirst 5 patients to be imported:');
    newPatients.slice(0, 5).forEach(p => {
      console.log(`  MR:${String(p.mrNo).padEnd(6)} ${(p.firstName+' '+p.lastName).substring(0,25).padEnd(26)} ${p.gender.padEnd(7)} DOB:${p.dob||'N/A'}  Reg:${p.regDate}`);
    });
    return;
  }

  if (added === 0) {
    console.log('\n⚠️  Nothing to import.');
    return;
  }

  // Save — new patients first, then existing
  db.patients = [...newPatients, ...db.patients];
  db.nextIds  = db.nextIds || {};
  db.nextIds.patient = nextMr;

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log(`\n✅  Done! Imported ${added} patients.`);
  console.log(`    Total patients in DB now: ${db.patients.length}`);
  console.log('\n🔁  Restart server:  node server.js\n');
}

main();
