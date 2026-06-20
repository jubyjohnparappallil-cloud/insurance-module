/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   IMPORT — Shanthi Wellness Ayurvedic Medical Center LLC     ║
 * ║   Output: wellness-data.json                                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node import-wellness.js            ← run import
 *   node import-wellness.js --dry-run  ← preview only, nothing saved
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────
const BRANCH_MATCH = 'shanthi wellness ayurvedic medical center';
const DB_FILE      = path.join(__dirname, 'wellness-data.json');
const DRY_RUN      = process.argv.includes('--dry-run');

const EXCEL_FILES = [
  'SHANTHI MEDICAL CENTER PATIENT DATA (2).xlsx',
  'SHANTHI MEDICAL CENTER PATIENT DATA.xlsx',
  'patients-data.txt.xlsx',
  'patients-data.xlsx',
  'patients-data.txt',
  'patients-data.csv',
];

// ── Helpers ───────────────────────────────────────────────────────
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
  if (!t || ['i-kiribati','yemeni'].includes(t.toLowerCase())) return '';
  return t;
}

function parseExcelDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900 || v.getFullYear() > 2030) return '';
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return pad2(v.getDate()) + '/' + mo[v.getMonth()] + '/' + v.getFullYear();
  }
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d || d.y <= 1900 || d.y > 2030) return '';
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return pad2(d.d) + '/' + mo[d.m - 1] + '/' + d.y;
    } catch(e) { return ''; }
  }
  const s = String(v).trim();
  if (!s || s.includes('1900') || s.includes('1899')) return '';
  const m1 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (m1) {
    const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return pad2(parseInt(m1[1])) + '/' + cap(m1[2]) + '/' + m1[3];
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (parseInt(m2[1]) <= 1900) return '';
    return pad2(parseInt(m2[3])) + '/' + mo[parseInt(m2[2]) - 1] + '/' + m2[1];
  }
  return '';
}

function parseRegDate(v) {
  if (!v) return '';
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
  const mons = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) return pad2(parseInt(m1[1])) + '-' + (mons[m1[2].toLowerCase()]||'01') + '-' + m1[3];
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return pad2(parseInt(m2[1])) + '-' + pad2(parseInt(m2[2])) + '-' + m2[3];
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
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   IMPORT: Shanthi Wellness Ayurvedic LLC → wellness-data.json ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN (nothing will be saved)' : '🟢 LIVE');

  // Find Excel file
  let excelFile = null;
  for (const fn of EXCEL_FILES) {
    const fp = path.join(__dirname, fn);
    if (fs.existsSync(fp)) { excelFile = fp; break; }
  }
  if (!excelFile) {
    console.error('\n❌  Excel file not found. Place one of these in:', __dirname);
    EXCEL_FILES.forEach(f => console.error('   •', f));
    process.exit(1);
  }
  console.log('\n📂  File:', path.basename(excelFile));

  // Read Excel
  const wb      = XLSX.readFile(excelFile, { cellDates: true, raw: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1, raw: false, defval: ''
  });
  console.log('    Rows in sheet:', rawRows.length);

  // Find header row
  let headerIdx = -1, headers = [];
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const r = rawRows[i].map(c => String(c || '').toUpperCase().trim());
    if (r.includes('BRANCH') && r.includes('FILE')) { headerIdx = i; headers = r; break; }
  }
  if (headerIdx === -1) {
    headers = ['','','BRANCH','FILE','FIRST NAME','LAST NAME','GENDER','MOBILE',
               'TELEPHONE','DATE OF BIRTH','EMAIL','EMIRATES ID','PASSPORT',
               'NATIONALITY','DATE CREATED'];
  }

  const dataRows = rawRows.slice(headerIdx === -1 ? 0 : headerIdx + 1)
                          .filter(r => r.some(c => c !== ''));
  console.log('    Data rows:', dataRows.length);

  // Load existing Wellness DB (or create fresh)
  let db = {
    patients: [], consultations: [], claims: [], logsheetEntries: [],
    insuranceCompanies: [], insuranceMappings: [], signatures: {},
    nextIds: { patient: 1, consultation: 1, claim: 1, insurance: 1 }
  };
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch(e) { console.error('⚠️  Cannot read wellness-data.json:', e.message); process.exit(1); }
  } else {
    console.log('    wellness-data.json not found — will be created fresh.');
  }
  if (!db.patients) db.patients = [];

  // Backup before writing
  if (!DRY_RUN && fs.existsSync(DB_FILE)) {
    const bak = path.join(__dirname, `wellness-data.backup.${Date.now()}.json`);
    fs.writeFileSync(bak, JSON.stringify(db, null, 2));
    console.log('💾  Backup:', path.basename(bak));
  }

  // Track existing MR numbers
  const usedMrNos = new Set(db.patients.map(p => String(p.mrNo).trim()));
  let nextMr = (db.nextIds && db.nextIds.patient) || 1;
  db.patients.forEach(p => {
    const n = parseInt(p.mrNo);
    if (!isNaN(n) && n >= nextMr) nextMr = n + 1;
  });

  function col(row, name) {
    const idx = headers.indexOf(name.toUpperCase());
    return idx >= 0 ? String(row[idx] || '') : '';
  }

  let added = 0, skippedBranch = 0, skippedDup = 0, skippedInvalid = 0;
  const newPatients = [];

  for (const row of dataRows) {
    // ── Branch filter: ONLY Wellness ──
    const branch = col(row, 'BRANCH').toLowerCase().trim();
    if (!branch.includes(BRANCH_MATCH)) { skippedBranch++; continue; }

    // ── MR Number ──
    const mrRaw = clean(col(row, 'FILE'));
    const mrNum = parseInt(mrRaw);
    let mrNo = (!mrRaw || isNaN(mrNum) || mrNum === 0) ? String(nextMr++) : String(mrNum);
    if (usedMrNos.has(mrNo)) { skippedDup++; continue; }
    usedMrNos.add(mrNo);

    // ── Name ──
    const firstName = clean(col(row, 'FIRST NAME')) || '(Unknown)';
    const lastName  = clean(col(row, 'LAST NAME'));
    if (firstName === '(Unknown)' && !lastName) { skippedInvalid++; continue; }

    // ── All fields ──
    const gender   = normalizeGender(col(row, 'GENDER'));
    const mobile   = normalizeMobile(col(row, 'MOBILE'));
    const homeTel  = normalizeMobile(col(row, 'TELEPHONE'));
    const dobIdx   = headers.indexOf('DATE OF BIRTH');
    const dob      = parseExcelDate(dobIdx >= 0 ? row[dobIdx] : col(row, 'DATE OF BIRTH'));
    const email    = clean(col(row, 'EMAIL'));
    let   eid      = clean(col(row, 'EMIRATES ID'));
    const passport = clean(col(row, 'PASSPORT'));
    const nat      = normalizeNationality(col(row, 'NATIONALITY'));
    const regIdx   = headers.indexOf('DATE CREATED');
    const regDate  = parseRegDate(regIdx >= 0 ? row[regIdx] : col(row, 'DATE CREATED')) || todayStr();

    // Clean scientific notation from Emirates ID
    if (eid && (eid.includes('E+') || eid.includes('e+'))) eid = '';

    newPatients.push({
      mrNo, recordNo: '', firstName, middleName: '', lastName,
      mobile, city: '', area: '', address: '', poBox: '', emirate: '',
      status: 'Active', eid, language: 'English', category: 'General',
      dob, years: '', months: '', days: '', gender, regDate,
      religion: 'Not Specified', email, passport, marital: '',
      nationality: nat, job: '', company: '', whatsapp: '', homeTel,
      referral: '', notes: '', know: 'Imported',
      packageName: 'None', packageStart: '', packageVisits: '0', packageBalance: '0',
      policyName: '', policyExpiry: '', insuranceLimit: '0', insuranceCoPay: '0',
      emergencyName: '', emergencyPhone: '', relationship: '',
      noOfChildren: '0', eidExpiry: '',
      vip: false, pregnant: false, medication: false,
      importedFrom: 'Excel Import - Shanthi Wellness LLC'
    });
    added++;
  }

  // ── Summary ──
  console.log('\n📊  Results:');
  console.log(`    ✅  Wellness patients imported       : ${added}`);
  console.log(`    ⏭️   Duplicate MR skipped              : ${skippedDup}`);
  console.log(`    🏥  Medical Center branch skipped    : ${skippedBranch}`);
  console.log(`    ⚠️   Invalid (no name) skipped         : ${skippedInvalid}`);

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN — nothing saved.');
    if (newPatients.length > 0) {
      console.log('\nPreview (first 5):');
      newPatients.slice(0, 5).forEach(p => {
        console.log(`  MR:${String(p.mrNo).padEnd(6)} ${(p.firstName+' '+p.lastName).substring(0,26).padEnd(26)} ${p.gender.padEnd(7)} ${p.regDate}`);
      });
    }
    return;
  }

  if (added === 0) {
    console.log('\n⚠️  Nothing to import. wellness-data.json unchanged.');
    return;
  }

  // Save
  db.patients = [...newPatients, ...db.patients];
  if (!db.nextIds) db.nextIds = {};
  db.nextIds.patient = nextMr;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log(`\n✅  Saved ${added} Wellness patients to wellness-data.json`);
  console.log(`    Total patients in file: ${db.patients.length}`);
  console.log('\n▶️   Start Wellness server:  node server.js --wellness\n');
}

main();
