/**
 * PATIENT DATA IMPORT SCRIPT
 * ===========================
 * Imports patient records from Excel/CSV into clinic-data.json
 *
 * Usage:
 *   1. Export your Excel file as CSV (comma or tab separated)
 *      - In Excel: File → Save As → CSV UTF-8 (Comma delimited)
 *   2. Place the CSV file in this folder as: patients-import.csv
 *   3. Run: node import-patients.js
 *      OR to preview without saving: node import-patients.js --dry-run
 *
 * Expected CSV columns (from Excel export):
 *   BRANCH, FILE, FIRST NAME, LAST NAME, GENDER, MOBILE, TELEPHONE,
 *   DATE OF BIRTH, EMAIL, EMIRATES ID, PASSPORT, NATIONALITY, DATE CREATED
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────
const CSV_FILE    = path.join(__dirname, 'patients-import.csv');
const DB_FILE     = path.join(__dirname, 'clinic-data.json');
const BACKUP_FILE = path.join(__dirname, 'clinic-data.backup.' + Date.now() + '.json');
const DRY_RUN     = process.argv.includes('--dry-run');
const TARGET_BRANCH = 'shanthi medical center'; // case-insensitive match

// ── Helpers ──────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

/** Parse a date string in various formats → DD/MMM/YYYY */
function parseDate(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === 'na') return '';
  const s = raw.trim();

  // Detect "1-Jan-1900" (invalid sentinel) → skip
  if (s.includes('1900') || s.includes('1899')) return '';

  // Try DD-Mon-YYYY  e.g. "15-Mar-1985"
  const m1 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (m1) return pad2(m1[1]) + '/' + capitalize(m1[2]) + '/' + m1[3];

  // Try YYYY-MM-DD  e.g. "1985-03-15"
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[parseInt(m2[2]) - 1] || '';
    return pad2(parseInt(m2[3])) + '/' + mon + '/' + m2[1];
  }

  // Try DD/MM/YYYY
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[parseInt(m3[2]) - 1] || '';
    return pad2(parseInt(m3[1])) + '/' + mon + '/' + m3[3];
  }

  // Try DD-MM-YYYY
  const m4 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m4) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[parseInt(m4[2]) - 1] || '';
    return pad2(parseInt(m4[1])) + '/' + mon + '/' + m4[3];
  }

  return ''; // unrecognised format
}

/** Parse registration date → DD-MM-YYYY */
function parseRegDate(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === 'na') return '';
  const s = raw.trim();

  // YYYY-MM-DD HH:MM:SS  (common DB export)
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return pad2(parseInt(m1[3])) + '-' + m1[2] + '-' + m1[1];

  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return pad2(parseInt(m2[1])) + '-' + pad2(parseInt(m2[2])) + '-' + m2[3];

  // DD/MM/YYYY
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return pad2(parseInt(m3[1])) + '-' + pad2(parseInt(m3[2])) + '-' + m3[3];

  return '';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }

function clean(v) {
  if (!v) return '';
  const t = v.trim();
  // treat "na", "N/A", "n/a", "NA", "-" as empty
  if (['na','n/a','na.','n.a','-','none','null','undefined'].includes(t.toLowerCase())) return '';
  // common junk email sentinel
  if (t.toLowerCase() === 'info@na.com') return '';
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
  // Remove spaces / dashes
  return t.replace(/[\s\-]/g, '');
}

// ── Parse CSV ────────────────────────────────────────────────────

/**
 * Robust CSV parser – handles quoted fields, commas inside quotes,
 * and also tab-separated files.
 */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];

  // Auto-detect delimiter: count tabs vs commas in header line
  const header = lines[0];
  const tabCount   = (header.match(/\t/g) || []).length;
  const commaCount = (header.match(/,/g)  || []).length;
  const delim = tabCount >= commaCount ? '\t' : ',';

  console.log(`Detected delimiter: ${delim === '\t' ? 'TAB' : 'COMMA'}`);

  function splitLine(line) {
    if (delim === '\t') return line.split('\t').map(c => c.trim());
    // Comma: respect quoted fields
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

  const headers = splitLine(lines[0]).map(h => h.replace(/"/g, '').toUpperCase().trim());
  console.log('Headers found:', headers.join(' | '));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); });
    rows.push(obj);
  }
  return rows;
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  // 1. Check CSV file exists
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`\n❌  CSV file not found: ${CSV_FILE}`);
    console.error('Please export your Excel file as CSV and save it as "patients-import.csv" in this folder.\n');
    process.exit(1);
  }

  // 2. Load CSV
  console.log(`\n📂  Reading: ${CSV_FILE}`);
  const csvText = fs.readFileSync(CSV_FILE, 'utf8');
  const rows    = parseCSV(csvText);
  console.log(`    Total rows in CSV: ${rows.length}`);

  // 3. Load existing DB
  let db = { patients: [], nextIds: { patient: 1 } };
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch(e) { console.error('⚠️  Could not parse clinic-data.json:', e.message); process.exit(1); }
  }
  if (!db.patients) db.patients = [];

  // Back up DB
  if (!DRY_RUN) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(db, null, 2));
    console.log(`💾  Backup saved: ${path.basename(BACKUP_FILE)}`);
  }

  // 4. Build set of existing MR numbers for duplicate detection
  const existingMrNos = new Set(db.patients.map(p => String(p.mrNo).trim()));

  // 5. Process rows
  let added = 0, skipped = 0, duplicate = 0, invalidBranch = 0;
  const usedMrNos = new Set(existingMrNos); // track within this import too

  // Determine next MR number to auto-assign if FILE is blank/0
  let nextMr = db.nextIds && db.nextIds.patient ? db.nextIds.patient : 1;
  // Make sure nextMr is above any existing
  db.patients.forEach(p => {
    const n = parseInt(p.mrNo);
    if (!isNaN(n) && n >= nextMr) nextMr = n + 1;
  });

  const newPatients = [];

  for (const row of rows) {
    // ── Branch filter ───────────────────────────────────────────
    const branch = (row['BRANCH'] || '').toLowerCase().trim();
    if (!branch.includes(TARGET_BRANCH)) {
      invalidBranch++;
      continue;
    }

    // ── MR Number ───────────────────────────────────────────────
    let mrNo = clean(row['FILE'] || row['MR NO'] || row['MR NUMBER'] || '');
    const mrNum = parseInt(mrNo);

    // If MR is 0, blank, or "0" → auto-assign
    if (!mrNo || mrNum === 0) {
      mrNo = String(nextMr++);
    } else {
      mrNo = String(mrNum); // normalise e.g. "0045" → "45"
    }

    // Skip duplicate MR numbers
    if (usedMrNos.has(mrNo)) {
      duplicate++;
      // If you want to UPDATE instead of skip, change this logic
      continue;
    }
    usedMrNos.add(mrNo);

    // ── Map fields ───────────────────────────────────────────────
    const firstName  = clean(row['FIRST NAME']  || row['FIRSTNAME']  || '');
    const lastName   = clean(row['LAST NAME']   || row['LASTNAME']   || '');
    const gender     = normalizeGender(row['GENDER'] || '');
    const mobile     = normalizeMobile(row['MOBILE'] || '');
    const homeTel    = normalizeMobile(row['TELEPHONE'] || '');
    const dob        = parseDate(row['DATE OF BIRTH'] || row['DOB'] || '');
    const email      = clean(row['EMAIL'] || '');
    const emiratesId = clean(row['EMIRATES ID'] || row['EID'] || '');
    const passport   = clean(row['PASSPORT'] || '');
    const nationality= clean(row['NATIONALITY'] || '');
    const regDate    = parseRegDate(row['DATE CREATED'] || row['REG DATE'] || '') ||
                       new Date().toLocaleDateString('en-GB').split('/').join('-'); // fallback today

    // ── Build patient object ─────────────────────────────────────
    const patient = {
      mrNo,
      recordNo:        '',
      firstName:       firstName || '(Unknown)',
      middleName:      '',
      lastName:        lastName,
      mobile:          mobile,
      city:            '',
      area:            '',
      address:         '',
      poBox:           '',
      emirate:         '',
      status:          'Active',
      eid:             emiratesId,
      language:        'English',
      category:        'General',
      dob:             dob,
      years:           '',
      months:          '',
      days:            '',
      gender:          gender,
      regDate:         regDate,
      religion:        'Not Specified',
      email:           email,
      passport:        passport,
      marital:         '',
      nationality:     nationality,
      job:             '',
      company:         '',
      whatsapp:        '',
      homeTel:         homeTel,
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
      importedFrom:    'Excel Import'
    };

    newPatients.push(patient);
    added++;
  }

  // 6. Stats
  console.log('\n📊  Import Summary:');
  console.log(`    Rows processed  : ${rows.length}`);
  console.log(`    ✅  To add       : ${added}`);
  console.log(`    ⏭️   Duplicates   : ${duplicate}  (skipped - MR already exists)`);
  console.log(`    🏥  Other branch : ${invalidBranch}  (filtered out)`);

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN mode – no changes saved.');
    if (newPatients.length > 0) {
      console.log('\nFirst 3 patients that would be added:');
      newPatients.slice(0, 3).forEach(p => {
        console.log(`  MR:${p.mrNo}  ${p.firstName} ${p.lastName}  ${p.gender}  DOB:${p.dob}  Mobile:${p.mobile}`);
      });
    }
    return;
  }

  if (added === 0) {
    console.log('\n⚠️  Nothing to import.');
    return;
  }

  // 7. Prepend new patients (newest first) and save
  // Prepend so they appear at the top; existing patients stay below
  db.patients = [...newPatients, ...db.patients];
  db.nextIds  = db.nextIds || {};
  db.nextIds.patient = nextMr;

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n✅  Done! Added ${added} patients to clinic-data.json`);
  console.log(`    Total patients now: ${db.patients.length}`);
  console.log('\n🎉  Restart the server (node server.js) to see the imported patients.\n');
}

main();
