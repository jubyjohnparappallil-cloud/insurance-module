/**
 * Import ALL data from Kaizenstar SQL dump
 * Usage: node import-from-sql.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SQL_FILE = path.join(__dirname, 'shanthiayur_db.sql');
const CLINIC_FILE = path.join(__dirname, 'clinic-data.json');
const WELLNESS_FILE = path.join(__dirname, 'wellness-data.json');

function pad2(n) { return String(n).padStart(2, '0'); }

function cleanVal(v) {
  if (v === null || v === undefined || v === 'NULL') return '';
  let s = String(v).trim();
  if (s === 'NULL' || s === 'null') return '';
  return s;
}

function parseSqlDate(v) {
  const s = cleanVal(v);
  if (!s || s.startsWith('0000') || s.startsWith('0001')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
    if (y < 1900 || y > 2030 || mo === 0 || d === 0) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return pad2(d) + '/' + months[mo-1] + '/' + y;
  }
  return '';
}

function parseSqlRegDate(v) {
  const s = cleanVal(v);
  if (!s || s.startsWith('0000') || s.startsWith('0001')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
    if (y < 1900 || y > 2030) return '';
    return pad2(d) + '-' + pad2(mo) + '-' + y;
  }
  return '';
}

function normalizeGender(v) {
  const s = cleanVal(v).toLowerCase();
  if (s === 'm' || s === 'male') return 'Male';
  if (s === 'f' || s === 'female') return 'Female';
  return '';
}

// Parse a single SQL row like ('val1','val2',NULL,3,...)
function parseRow(line) {
  // Remove leading ( and trailing ), or ),
  let s = line.trim();
  if (s.startsWith('(')) s = s.substring(1);
  if (s.endsWith('),')) s = s.slice(0, -2);
  else if (s.endsWith(');')) s = s.slice(0, -2);
  else if (s.endsWith(')')) s = s.slice(0, -1);

  const values = [];
  let i = 0;
  let val = '';
  let inQuote = false;

  while (i < s.length) {
    const ch = s[i];
    if (inQuote) {
      if (ch === '\\') {
        val += s[i+1] || '';
        i += 2;
        continue;
      }
      if (ch === "'") {
        if (s[i+1] === "'") { val += "'"; i += 2; continue; }
        inQuote = false;
        i++;
        continue;
      }
      val += ch;
      i++;
    } else {
      if (ch === "'") {
        inQuote = true;
        i++;
      } else if (ch === ',') {
        values.push(val.trim() === 'NULL' ? '' : val.trim());
        val = '';
        i++;
      } else {
        val += ch;
        i++;
      }
    }
  }
  values.push(val.trim() === 'NULL' ? '' : val.trim());
  return values;
}

async function main() {
  console.log('\n=== IMPORTING FROM KAIZENSTAR SQL ===');
  console.log('File:', SQL_FILE, '(' + (fs.statSync(SQL_FILE).size/1048576).toFixed(1) + ' MB)');
  const t0 = Date.now();

  const rl = readline.createInterface({ input: fs.createReadStream(SQL_FILE, 'utf8'), crlfDelay: Infinity });

  let patientCols = [], apptCols = [], doctorCols = [], insCols = [];
  let patients = [], appointments = [], doctors = [], insuranceList = [];

  let currentTable = '';
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 50000 === 0) process.stdout.write('\r  Lines: ' + lineNum + '...');

    // Detect insert line with columns
    const insertMatch = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (insertMatch) {
      currentTable = insertMatch[1].toLowerCase();
      const cols = insertMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
      if (currentTable === 'patients') patientCols = cols;
      else if (currentTable === 'appointment') apptCols = cols;
      else if (currentTable === 'dctr_doctor') doctorCols = cols;
      else if (currentTable === 'ins_insurance') insCols = cols;
      continue;
    }

    // Data row - starts with ('
    if (line.startsWith("('") || line.startsWith("('") || line.match(/^\s*\('/)) {
      if (currentTable === 'patients' && patientCols.length > 0) {
        const vals = parseRow(line);
        const get = (col) => { const idx = patientCols.indexOf(col); return idx >= 0 && idx < vals.length ? vals[idx] : ''; };
        
        const isDeleted = get('Pat_isDeleted');
        const firstName = cleanVal(get('Pat_FirstName'));
        if (isDeleted === '1' || !firstName) continue;

        patients.push({
          mrNo: cleanVal(get('Pat_MRNO')) || cleanVal(get('Pat_DocNo')),
          recordNo: '',
          firstName: firstName,
          middleName: cleanVal(get('Pat_MiddleName')),
          lastName: cleanVal(get('Pat_Lastname')),
          mobile: cleanVal(get('Pat_Mobile')).replace(/[_\s\-]/g, ''),
          city: cleanVal(get('Pat_City')),
          area: '',
          address: cleanVal(get('Pat_Address')),
          poBox: cleanVal(get('Pat_PoBox')),
          emirate: cleanVal(get('Pat_Emirate')),
          status: cleanVal(get('Pat_Status')) || 'Active',
          eid: cleanVal(get('Pat_EmiratesIdNo')),
          language: 'English',
          category: cleanVal(get('Pat_Category')) || 'General',
          dob: parseSqlDate(get('Pat_Dob')),
          years: '', months: '', days: '',
          gender: normalizeGender(get('Pat_Gender')),
          regDate: parseSqlRegDate(get('Pat_CreatedTime')),
          religion: cleanVal(get('Pat_Religion')) || 'Not Specified',
          email: cleanVal(get('Pat_Email')),
          passport: cleanVal(get('Pat_PassportNo')),
          marital: cleanVal(get('Pat_MartialStatus')),
          nationality: cleanVal(get('Pat_NationalId')) || cleanVal(get('Pat_NationalityId')),
          job: cleanVal(get('Pat_JobTitle')),
          company: cleanVal(get('Pat_Company')),
          whatsapp: cleanVal(get('Pat_WhatsAppNo')),
          homeTel: cleanVal(get('Pat_HomeTel')),
          referral: '',
          notes: '',
          know: cleanVal(get('Pat_KnowAbout')) || 'Imported',
          packageName: 'None', packageStart: '', packageVisits: '0', packageBalance: '0',
          policyName: cleanVal(get('Pat_InsurancePolicyName')),
          policyExpiry: parseSqlRegDate(get('Pat_Insurance_ExpiryDate')),
          insuranceLimit: cleanVal(get('Pat_Insurance_Max_limit')) || '0',
          insuranceCoPay: cleanVal(get('Pat_Insurance_Co_Pay')) || '0',
          emergencyName: cleanVal(get('Pat_EmergencyName')),
          emergencyPhone: cleanVal(get('Pat_EmergencyPhone')),
          relationship: cleanVal(get('Pat_RelationShip')),
          noOfChildren: cleanVal(get('Pat_NoOfChildren')) || '0',
          eidExpiry: parseSqlRegDate(get('Pat_EmiratesIdExpiryDate')),
          vip: get('Pat_isVip') === '1',
          pregnant: false, medication: false,
          _docType: cleanVal(get('Pat_DocType'))
        });
      }
      else if (currentTable === 'appointment' && apptCols.length > 0) {
        const vals = parseRow(line);
        const get = (col) => { const idx = apptCols.indexOf(col); return idx >= 0 && idx < vals.length ? vals[idx] : ''; };
        
        const isDeleted = get('app_isDeleted');
        if (isDeleted === '1') continue;

        const startStr = cleanVal(get('app_Start'));
        let date = '', time = '';
        if (startStr) {
          const m = startStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
          if (m) {
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            date = pad2(parseInt(m[3])) + '/' + months[parseInt(m[2])-1] + '/' + m[1];
            let h = parseInt(m[4]), mi = parseInt(m[5]);
            mi = Math.round(mi/15)*15; if(mi===60){mi=0;h++;}
            const ampm = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12; if (h === 0) h = 12;
            time = h + ':' + pad2(mi) + ' ' + ampm;
          }
        }

        const patName = cleanVal(get('app_PatName'));
        if (!patName && !date) continue;

        const dctrCode = cleanVal(get('app_dctrDocNo'));

        appointments.push({
          date, time,
          doctor: dctrCode,
          patient: patName,
          patientName: patName,
          mrNo: cleanVal(get('app_PatDocNo')),
          mobile: cleanVal(get('app_PatMob')).replace(/[_\s]/g, ''),
          status: 'Confirmed',
          notes: cleanVal(get('app_Notes')),
          room: '',
          _docType: cleanVal(get('app_DocType'))
        });
      }
      else if (currentTable === 'dctr_doctor' && doctorCols.length > 0) {
        const vals = parseRow(line);
        const get = (col) => { const idx = doctorCols.indexOf(col); return idx >= 0 && idx < vals.length ? vals[idx] : ''; };
        const name = cleanVal(get('dctr_DoctorName'));
        const isDeleted = get('dctr_isDeleted');
        if (!name || isDeleted === '1') continue;
        doctors.push({
          name,
          specialty: cleanVal(get('dctr_Description')),
          licence: cleanVal(get('dctr_DoctorLisenseNo')),
          dha: cleanVal(get('dctr_DHACode')),
          _code: cleanVal(get('dctr_DocNo'))
        });
      }
      else if (currentTable === 'ins_insurance' && insCols.length > 0) {
        const vals = parseRow(line);
        const get = (col) => { const idx = insCols.indexOf(col); return idx >= 0 && idx < vals.length ? vals[idx] : ''; };
        const name = cleanVal(get('Ins_InsuranceName'));
        const isDeleted = get('Ins_isDeleted');
        if (!name || isDeleted === '1') continue;
        insuranceList.push({
          code: cleanVal(get('Ins_DocNo')) || cleanVal(get('Ins_CompanyCode')),
          name,
          phone: cleanVal(get('Ins_Phone')),
          email: ''
        });
      }
    }
    // If we hit a new table structure or comment, reset current table
    else if (line.startsWith('/*') || line.startsWith('DROP TABLE') || line.startsWith('CREATE TABLE')) {
      currentTable = '';
    }
  }

  console.log('\r  Lines: ' + lineNum + ' ✓');
  console.log('  Time: ' + ((Date.now()-t0)/1000).toFixed(1) + 's');
  console.log('\n  Patients:     ' + patients.length);
  console.log('  Appointments: ' + appointments.length);
  console.log('  Doctors:      ' + doctors.length);
  console.log('  Insurance:    ' + insuranceList.length);

  // Build doctor code -> name map
  const doctorMap = {};
  doctors.forEach(d => { if (d._code) doctorMap[d._code] = d.name; });
  console.log('\n  Doctor map:', JSON.stringify(doctorMap));

  // Map doctor codes to names in appointments
  let mapped = 0, unmapped = 0;
  appointments.forEach(a => {
    if (a.doctor && doctorMap[a.doctor]) {
      a.doctor = doctorMap[a.doctor];
      mapped++;
    } else {
      unmapped++;
    }
    delete a._docType;
  });
  console.log('  Appts with doctor mapped: ' + mapped + ', unmapped: ' + unmapped);

  // Clean _code from doctors
  doctors.forEach(d => delete d._code);

  // Split by DocType
  const types = {};
  patients.forEach(p => { types[p._docType] = (types[p._docType]||0) + 1; });
  console.log('\n  Patient DocTypes:', JSON.stringify(types));

  // Clean up _docType field
  patients.forEach(p => delete p._docType);

  // Sort by MR
  patients.sort((a,b) => (parseInt(a.mrNo)||0) - (parseInt(b.mrNo)||0));

  const maxMr = Math.max(0, ...patients.map(p => parseInt(p.mrNo)||0));

  // Backup
  if (fs.existsSync(CLINIC_FILE)) {
    const bak = CLINIC_FILE.replace('.json', '.backup.' + Date.now() + '.json');
    fs.copyFileSync(CLINIC_FILE, bak);
    console.log('\n  Backup:', path.basename(bak));
  }

  const db = {
    patients,
    consultations: [],
    claims: [],
    logsheetEntries: [],
    insuranceCompanies: insuranceList,
    insuranceMappings: [],
    appointments,
    doctors,
    signatures: {},
    nextIds: { patient: maxMr + 1, consultation: 1, claim: 1, insurance: insuranceList.length + 1 }
  };

  fs.writeFileSync(CLINIC_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\n✅ Saved clinic-data.json');
  console.log('   Patients: ' + patients.length);
  console.log('   Appointments: ' + appointments.length);
  console.log('   Doctors: ' + doctors.length);
  console.log('   Insurance: ' + insuranceList.length);
  console.log('   Next MR No: ' + (maxMr+1));
  console.log('\n▶️  Run: node server.js\n');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
