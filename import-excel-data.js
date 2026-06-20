/**
 * IMPORT SHANTHI MEDICAL CENTER PATIENTS FROM EXCEL DATA
 * ========================================================
 * This script reads from the tab-separated Excel export file
 * and imports only "Shanthi Medical Center" patients.
 *
 * HOW TO USE:
 * 1. Export your Excel file as TSV (Tab Separated Values) or CSV
 *    - In Excel: File → Save As → "Text (Tab delimited) (*.txt)" 
 *      OR "CSV UTF-8 (Comma delimited) (*.csv)"
 * 2. Save it as "patients-data.txt" or "patients-data.csv" in this folder
 * 3. Run: node import-excel-data.js
 * 4. For dry run (preview only): node import-excel-data.js --dry-run
 * 5. For CSV format: node import-excel-data.js --csv
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────
const DB_FILE       = path.join(__dirname, 'clinic-data.json');
const BACKUP_PREFIX = path.join(__dirname, 'clinic-data.backup.');
const DRY_RUN       = process.argv.includes('--dry-run');
const USE_CSV       = process.argv.includes('--csv');

// Try multiple file names
const POSSIBLE_FILES = [
  'patients-data.txt',
  'patients-data.csv',
  'patients-import.txt',
  'patients-import.csv',
  'SHANTHI MEDICAL CENTER PATIENT DATA.txt',
  'SHANTHI MEDICAL CENTER PATIENT DATA.csv',
];

const TARGET_BRANCH = 'shanthi medical center';

// ── Helpers ──────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDate(raw) {
  if (!raw) return '';
  const s = raw.toString().trim();
  if (!s || ['na','n/a','-','none','null'].includes(s.toLowerCase())) return '';
  if (s.includes('1900') || s.includes('1899')) return '';

  // DD-Mon-YYYY  e.g. "15-Mar-1985" or "1-Jan-2000"
  const m1 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (m1) return pad2(parseInt(m1[1])) + '/' + capitalize(m1[2]) + '/' + m1[3];

  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return pad2(parseInt(m2[3])) + '/' + months[parseInt(m2[2]) - 1] + '/' + m2[1];
  }

  // DD/MM/YYYY or DD-MM-YYYY (numeric month)
  const m3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m3) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[parseInt(m3[2]) - 1] || '';
    return pad2(parseInt(m3[1])) + '/' + mon + '/' + m3[3];
  }

  return '';
}

function parseRegDate(raw) {
  if (!raw) return '';
  const s = raw.toString().trim();
  if (!s || ['na','n/a','-'].includes(s.toLowerCase())) return '';

  // YYYY-MM-DD HH:MM:SS
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return pad2(parseInt(m1[3])) + '-' + m1[2] + '-' + m1[1];

  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return pad2(parseInt(m2[1])) + '-' + pad2(parseInt(m2[2])) + '-' + m2[3];

  // DD/MM/YYYY
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return pad2(parseInt(m3[1])) + '-' + pad2(parseInt(m3[2])) + '-' + m3[3];

  // D-Mon-YYYY  e.g. "18-Feb-2015"
  const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const m4 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m4) {
    const mon = months[m4[2].toLowerCase()] || '01';
    return pad2(parseInt(m4[1])) + '-' + mon + '-' + m4[3];
  }

  return '';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function clean(v) {
  if (v === null || v === undefined) return '';
  const t = v.toString().trim();
  const junk = ['na','n/a','na.','n.a','-','none','null','undefined','info@na.com',
                 'nil@gmail.com','nil','0'];
  if (junk.includes(t.toLowerCase())) return '';
  // Also skip clearly invalid emails
  if (t.toLowerCase().endsWith('@na.com')) return '';
  // Skip placeholder EID
  if (t === '999-9999-9999999-9') return '';
  if (t === '7.84') return ''; // scientific notation artefact
  return t;
}

function normalizeGender(v) {
  const t = (v || '').trim().toUpperCase();
  if (t === 'M' || t === 'MALE')   return 'Male';
  if (t === 'F' || t === 'FEMALE') return 'Female';
  return '';
}

function normalizeMobile(v) {
  const t = clean(v);
  if (!t) return '';
  // Remove spaces, dashes, parentheses
  return t.replace(/[\s\-\(\)]/g, '');
}

function normalizeNationality(v) {
  const t = clean(v);
  // "I-Kiribati" and "Yemeni" are placeholder nationalities in old data
  if (!t || t.toLowerCase() === 'i-kiribati' || t.toLowerCase() === 'yemeni') return '';
  return t;
}

function todayStr() {
  const d = new Date();
  return pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear();
}

// ── Parse the tab-separated or CSV file ──────────────────────────

function parseDataFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Auto-detect delimiter
  const header = lines[0] || '';
  const tabCount   = (header.match(/\t/g) || []).length;
  const commaCount = (header.match(/,/g)  || []).length;
  const delim = (USE_CSV || commaCount > tabCount) ? ',' : '\t';

  console.log(`📄  File: ${path.basename(filePath)}`);
  console.log(`    Delimiter: ${delim === '\t' ? 'TAB' : 'COMMA'}`);
  console.log(`    Total lines: ${lines.length}`);

  function splitLine(line) {
    if (delim === '\t') return line.split('\t').map(c => c.trim());
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  // Find header row (look for BRANCH column)
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = splitLine(lines[i]).map(h => h.replace(/"/g, '').toUpperCase().trim());
    if (cols.includes('BRANCH') && cols.includes('FILE')) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }

  if (headerIdx === -1) {
    // No header found - use positional mapping based on known format:
    // col0=empty, col1=empty, col2=BRANCH, col3=FILE, col4=FIRST NAME, col5=LAST NAME,
    // col6=GENDER, col7=MOBILE, col8=TELEPHONE, col9=DOB, col10=EMAIL,
    // col11=EMIRATES ID, col12=PASSPORT, col13=NATIONALITY, col14=DATE CREATED
    console.log('    No header row found - using positional mapping');
    headers = ['','','BRANCH','FILE','FIRST NAME','LAST NAME','GENDER','MOBILE',
               'TELEPHONE','DATE OF BIRTH','EMAIL','EMIRATES ID','PASSPORT',
               'NATIONALITY','DATE CREATED'];
    headerIdx = -1;
  } else {
    console.log(`    Headers found at line ${headerIdx + 1}: ${headers.slice(0, 6).join(' | ')} ...`);
  }

  const rows = [];
  const startLine = headerIdx === -1 ? 0 : headerIdx + 1;
  for (let i = startLine; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = splitLine(lines[i]);
    if (cols.length < 4) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim();
    });
    rows.push(obj);
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  // Find data file
  let dataFile = null;
  for (const fn of POSSIBLE_FILES) {
    const fp = path.join(__dirname, fn);
    if (fs.existsSync(fp)) { dataFile = fp; break; }
  }

  if (!dataFile) {
    console.error('\n❌  No data file found!');
    console.error('Please save your Excel data as one of these files in:', __dirname);
    POSSIBLE_FILES.forEach(f => console.error('   -', f));
    console.error('\nIn Excel: File → Save As → "Text (Tab delimited) (*.txt)"');
    process.exit(1);
  }

  // Load and parse
  const rows = parseDataFile(dataFile);
  console.log(`    Data rows: ${rows.length}\n`);

  // Load existing DB
  let db = { patients: [], nextIds: { patient: 1 } };
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch(e) { console.error('⚠️  Could not parse clinic-data.json:', e.message); process.exit(1); }
  }
  if (!db.patients) db.patients = [];

  // Backup
  if (!DRY_RUN) {
    const backupFile = BACKUP_PREFIX + Date.now() + '.json';
    fs.writeFileSync(backupFile, JSON.stringify(db, null, 2));
    console.log(`💾  Backup saved: ${path.basename(backupFile)}`);
  }

  // Existing MR numbers
  const existingMrNos = new Set(db.patients.map(p => String(p.mrNo).trim()));
  const usedMrNos = new Set(existingMrNos);

  // Next MR number
  let nextMr = (db.nextIds && db.nextIds.patient) ? db.nextIds.patient : 1;
  db.patients.forEach(p => {
    const n = parseInt(p.mrNo);
    if (!isNaN(n) && n >= nextMr) nextMr = n + 1;
  });

  // Process rows
  let added = 0, skippedBranch = 0, skippedDuplicate = 0, skippedInvalid = 0;
  const newPatients = [];

  for (const row of rows) {
    const branch = (row['BRANCH'] || '').toLowerCase().trim();

    // Branch filter - only Shanthi Medical Center
    if (!branch.includes(TARGET_BRANCH)) {
      skippedBranch++;
      continue;
    }

    // MR Number
    let mrRaw = clean(row['FILE'] || row['MR NO'] || row['MR NUMBER'] || '');
    const mrNum = parseInt(mrRaw);

    let mrNo;
    if (!mrRaw || isNaN(mrNum) || mrNum === 0) {
      mrNo = String(nextMr++);
    } else {
      mrNo = String(mrNum);
    }

    // Skip duplicate MR
    if (usedMrNos.has(mrNo)) {
      skippedDuplicate++;
      continue;
    }
    usedMrNos.add(mrNo);

    // Extract fields
    const firstNameRaw = clean(row['FIRST NAME'] || row['FIRSTNAME'] || '');
    const lastNameRaw  = clean(row['LAST NAME']  || row['LASTNAME']  || '');
    const gender       = normalizeGender(row['GENDER'] || '');
    const mobile       = normalizeMobile(row['MOBILE'] || '');
    const homeTel      = normalizeMobile(row['TELEPHONE'] || '');
    const dob          = parseDate(row['DATE OF BIRTH'] || row['DOB'] || '');
    const email        = clean(row['EMAIL'] || '');
    let   emiratesId   = clean(row['EMIRATES ID'] || row['EID'] || '');
    const passport     = clean(row['PASSPORT'] || '');
    const nationality  = normalizeNationality(row['NATIONALITY'] || '');
    const regDate      = parseRegDate(row['DATE CREATED'] || row['REG DATE'] || '') || todayStr();

    // Clean up Emirates ID - remove scientific notation
    if (emiratesId && emiratesId.includes('E+')) emiratesId = '';

    // Skip if no name at all
    if (!firstNameRaw && !lastNameRaw) {
      skippedInvalid++;
      continue;
    }

    // Split first name - some have full name in FIRST NAME column
    let firstName = firstNameRaw || '(Unknown)';
    let lastName  = lastNameRaw;

    // Build patient
    const patient = {
      mrNo,
      recordNo:        '',
      firstName,
      middleName:      '',
      lastName,
      mobile,
      city:            '',
      area:            '',
      address:         '',
      poBox:           '',
      emirate:         '',
      status:          'Active',
      eid:             emiratesId,
      language:        'English',
      category:        'General',
      dob,
      years:           '',
      months:          '',
      days:            '',
      gender,
      regDate,
      religion:        'Not Specified',
      email,
      passport,
      marital:         '',
      nationality,
      job:             '',
      company:         '',
      whatsapp:        '',
      homeTel,
      referral:        '',
      notes:           '',
      know:            'Imported',
      packageName:     'None',
      packageStart:    '',
      packageVisits:   '0',
      packageBalance:  '0',
      policyName:      '',
      policyExpiry:    '',
      insuranceLimit:  '0',
      insuranceCoPay:  '0',
      emergencyName:   '',
      emergencyPhone:  '',
      relationship:    '',
      noOfChildren:    '0',
      eidExpiry:       '',
      vip:             false,
      pregnant:        false,
      medication:      false,
      importedFrom:    'Excel - Shanthi Medical Center'
    };

    newPatients.push(patient);
    added++;
  }

  // Summary
  console.log('📊  Import Summary:');
  console.log(`    Total rows read      : ${rows.length}`);
  console.log(`    ✅  To import         : ${added}`);
  console.log(`    ⏭️   Duplicate MR skip : ${skippedDuplicate}`);
  console.log(`    🏥  Other branch skip : ${skippedBranch}`);
  console.log(`    ⚠️   Invalid rows skip : ${skippedInvalid}`);

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN - no changes saved.');
    if (newPatients.length > 0) {
      console.log('\nSample (first 5 patients):');
      newPatients.slice(0, 5).forEach(p => {
        console.log(`  MR:${p.mrNo.padEnd(6)} ${(p.firstName + ' ' + p.lastName).substring(0,25).padEnd(26)} ${p.gender.padEnd(7)} DOB:${p.dob || 'N/A'}`);
      });
    }
    return;
  }

  if (added === 0) {
    console.log('\n⚠️  Nothing to import.');
    return;
  }

  // Save
  db.patients = [...newPatients, ...db.patients];
  db.nextIds  = db.nextIds || {};
  db.nextIds.patient = nextMr;

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log(`\n✅  Done! Imported ${added} patients.`);
  console.log(`    Total patients now: ${db.patients.length}`);
  console.log('\n🔁  Restart the server (node server.js) to see the new patients.\n');
}

main();
