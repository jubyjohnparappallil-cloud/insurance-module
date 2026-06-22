/**
 * FULL IMPORT from Kaizenstar SQL dump (shanthiayur_db.sql - 48MB, more tables)
 * Imports: patients, appointments, doctors, insurance, bills/claims, consultations
 * Usage: node import-full.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SQL_FILE = path.join(__dirname, 'shanthiayur_db.sql');
const CLINIC_FILE = path.join(__dirname, 'clinic-data.json');

function pad2(n) { return String(n).padStart(2, '0'); }
function cleanVal(v) { if (!v || v === 'NULL' || v === 'null') return ''; return String(v).trim(); }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseSqlDateDMY(v) {
  const s = cleanVal(v);
  if (!s || s.startsWith('0000') || s.startsWith('0001') || s.startsWith('1900')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const y=parseInt(m[1]),mo=parseInt(m[2]),d=parseInt(m[3]); if(y<1900||y>2030||!mo||!d)return''; return pad2(d)+'/'+MONTHS[mo-1]+'/'+y; }
  return '';
}
function parseSqlRegDate(v) {
  const s = cleanVal(v);
  if (!s || s.startsWith('0000') || s.startsWith('0001') || s.startsWith('1900')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const y=parseInt(m[1]),mo=parseInt(m[2]),d=parseInt(m[3]); if(y<1900||y>2030)return''; return pad2(d)+'-'+pad2(mo)+'-'+y; }
  return '';
}
function normalizeGender(v) { const s=cleanVal(v).toLowerCase(); if(s==='m'||s==='male')return'Male'; if(s==='f'||s==='female')return'Female'; return''; }

function parseRow(line) {
  let s = line.trim();
  if (s.startsWith('(')) s = s.substring(1);
  if (s.endsWith('),')) s = s.slice(0,-2);
  else if (s.endsWith(');')) s = s.slice(0,-2);
  else if (s.endsWith(')')) s = s.slice(0,-1);
  const values = []; let i=0, val='', inQuote=false;
  while (i < s.length) {
    const ch = s[i];
    if (inQuote) {
      if (ch==='\\') { val += s[i+1]||''; i+=2; continue; }
      if (ch==="'") { if(s[i+1]==="'"){val+="'";i+=2;continue;} inQuote=false; i++; continue; }
      val += ch; i++;
    } else {
      if (ch==="'") { inQuote=true; i++; }
      else if (ch===',') { values.push(val.trim()==='NULL'?'':val.trim()); val=''; i++; }
      else { val+=ch; i++; }
    }
  }
  values.push(val.trim()==='NULL'?'':val.trim());
  return values;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  FULL IMPORT: Kaizenstar SQL → clinic-data.json');
  console.log('══════════════════════════════════════════════════════');
  console.log('File:', path.basename(SQL_FILE), '('+(fs.statSync(SQL_FILE).size/1048576).toFixed(1)+' MB)');

  const t0 = Date.now();
  const rl = readline.createInterface({ input: fs.createReadStream(SQL_FILE, 'utf8'), crlfDelay: Infinity });

  // Column arrays
  let patCols=[], apptCols=[], doctorCols=[], insCols=[], billHdrCols=[], billDtlCols=[], billInsHdrCols=[], billInsDtlCols=[];
  // Data arrays
  let patients=[], appointments=[], doctors=[], insurance=[], bills=[], billsIns=[];
  let currentTable='', lineNum=0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum%100000===0) process.stdout.write('\r  Lines: '+lineNum+'...');

    // Detect INSERT with columns
    const insertMatch = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (insertMatch) {
      currentTable = insertMatch[1].toLowerCase();
      const cols = insertMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
      if (currentTable === 'patients') patCols = cols;
      else if (currentTable === 'appointment') apptCols = cols;
      else if (currentTable === 'dctr_doctor') doctorCols = cols;
      else if (currentTable === 'ins_insurance') insCols = cols;
      else if (currentTable === 'bill_header') billHdrCols = cols;
      else if (currentTable === 'bill_detail') billDtlCols = cols;
      else if (currentTable === 'bill_header_insurance') billInsHdrCols = cols;
      else if (currentTable === 'bill_detail_insurance') billInsDtlCols = cols;
      continue;
    }

    // Data row
    if (!line.startsWith("('") && !line.match(/^\s*\('/)) {
      if (line.startsWith('/*') || line.startsWith('DROP') || line.startsWith('CREATE')) currentTable = '';
      continue;
    }

    const vals = parseRow(line);
    const get = (cols, col) => { const idx=cols.indexOf(col); return idx>=0&&idx<vals.length?vals[idx]:''; };

    if (currentTable === 'patients' && patCols.length) {
      if (get(patCols,'Pat_isDeleted')==='1') continue;
      const fn = cleanVal(get(patCols,'Pat_FirstName'));
      if (!fn) continue;
      patients.push({
        mrNo: cleanVal(get(patCols,'Pat_MRNO'))||cleanVal(get(patCols,'Pat_DocNo')),
        recordNo:'', firstName:fn, middleName:cleanVal(get(patCols,'Pat_MiddleName')),
        lastName:cleanVal(get(patCols,'Pat_Lastname')),
        mobile:cleanVal(get(patCols,'Pat_Mobile')).replace(/[_\s\-]/g,''),
        city:cleanVal(get(patCols,'Pat_City')), area:'', address:cleanVal(get(patCols,'Pat_Address')),
        poBox:cleanVal(get(patCols,'Pat_PoBox')), emirate:cleanVal(get(patCols,'Pat_Emirate')),
        status:cleanVal(get(patCols,'Pat_Status'))||'Active',
        eid:cleanVal(get(patCols,'Pat_EmiratesIdNo')), language:'English',
        category:cleanVal(get(patCols,'Pat_Category'))||'General',
        dob:parseSqlDateDMY(get(patCols,'Pat_Dob')),
        years:'',months:'',days:'',
        gender:normalizeGender(get(patCols,'Pat_Gender')),
        regDate:parseSqlRegDate(get(patCols,'Pat_CreatedTime')),
        religion:cleanVal(get(patCols,'Pat_Religion'))||'Not Specified',
        email:cleanVal(get(patCols,'Pat_Email')),
        passport:cleanVal(get(patCols,'Pat_PassportNo')),
        marital:cleanVal(get(patCols,'Pat_MartialStatus')),
        nationality:cleanVal(get(patCols,'Pat_NationalId'))||cleanVal(get(patCols,'Pat_NationalityId')),
        job:cleanVal(get(patCols,'Pat_JobTitle')), company:cleanVal(get(patCols,'Pat_Company')),
        whatsapp:cleanVal(get(patCols,'Pat_WhatsAppNo')), homeTel:cleanVal(get(patCols,'Pat_HomeTel')),
        referral:'', notes:'', know:cleanVal(get(patCols,'Pat_KnowAbout'))||'Imported',
        packageName:'None',packageStart:'',packageVisits:'0',packageBalance:'0',
        policyName:cleanVal(get(patCols,'Pat_InsurancePolicyName')),
        policyExpiry:parseSqlRegDate(get(patCols,'Pat_Insurance_ExpiryDate')),
        insuranceLimit:cleanVal(get(patCols,'Pat_Insurance_Max_limit'))||'0',
        insuranceCoPay:cleanVal(get(patCols,'Pat_Insurance_Co_Pay'))||'0',
        emergencyName:cleanVal(get(patCols,'Pat_EmergencyName')),
        emergencyPhone:cleanVal(get(patCols,'Pat_EmergencyPhone')),
        relationship:cleanVal(get(patCols,'Pat_RelationShip')),
        noOfChildren:cleanVal(get(patCols,'Pat_NoOfChildren'))||'0',
        eidExpiry:parseSqlRegDate(get(patCols,'Pat_EmiratesIdExpiryDate')),
        vip:get(patCols,'Pat_isVip')==='1', pregnant:false, medication:false,
        _docType:cleanVal(get(patCols,'Pat_DocType'))
      });
    }
    else if (currentTable === 'appointment' && apptCols.length) {
      if (get(apptCols,'app_isDeleted')==='1') continue;
      const startStr = cleanVal(get(apptCols,'app_Start'));
      let date='',time='';
      if (startStr) {
        const m = startStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (m) {
          date = pad2(parseInt(m[3]))+'/'+MONTHS[parseInt(m[2])-1]+'/'+m[1];
          let h=parseInt(m[4]),mi=parseInt(m[5]);
          mi=Math.round(mi/15)*15; if(mi===60){mi=0;h++;}
          const ampm=h>=12?'PM':'AM'; if(h>12)h-=12; if(h===0)h=12;
          time = h+':'+pad2(mi)+' '+ampm;
        }
      }
      const patName = cleanVal(get(apptCols,'app_PatName'));
      if (!patName && !date) continue;
      appointments.push({
        date,time,
        doctor:cleanVal(get(apptCols,'app_dctrDocNo')),
        patient:patName, patientName:patName,
        mrNo:cleanVal(get(apptCols,'app_PatDocNo')),
        mobile:cleanVal(get(apptCols,'app_PatMob')).replace(/[_\s]/g,''),
        status:'Confirmed', notes:cleanVal(get(apptCols,'app_Notes')), room:''
      });
    }
    else if (currentTable === 'dctr_doctor' && doctorCols.length) {
      if (get(doctorCols,'dctr_isDeleted')==='1') continue;
      const name = cleanVal(get(doctorCols,'dctr_DoctorName'));
      if (!name) continue;
      doctors.push({ name, specialty:cleanVal(get(doctorCols,'dctr_Description')),
        licence:cleanVal(get(doctorCols,'dctr_DoctorLisenseNo')),
        dha:cleanVal(get(doctorCols,'dctr_DHACode')),
        _code:cleanVal(get(doctorCols,'dctr_DocNo'))
      });
    }
    else if (currentTable === 'ins_insurance' && insCols.length) {
      if (get(insCols,'Ins_isDeleted')==='1') continue;
      const name = cleanVal(get(insCols,'Ins_InsuranceName'));
      if (!name) continue;
      insurance.push({ code:cleanVal(get(insCols,'Ins_DocNo'))||cleanVal(get(insCols,'Ins_CompanyCode')),
        name, phone:cleanVal(get(insCols,'Ins_Phone')), email:'' });
    }
    else if (currentTable === 'bill_header' && billHdrCols.length) {
      const billNo = cleanVal(get(billHdrCols,'BillHD_DocNo'));
      const billDate = parseSqlRegDate(get(billHdrCols,'BillHD_Date'));
      const total = cleanVal(get(billHdrCols,'BillHD_TotalAmount'));
      const discount = cleanVal(get(billHdrCols,'BillHD_DiscountAmt'));
      const tax = cleanVal(get(billHdrCols,'BillHD_TaxAmount'));
      const subtotal = cleanVal(get(billHdrCols,'BillHD_SubtotalAmt'));
      const cash = cleanVal(get(billHdrCols,'BillHD_PayModeCash'));
      const card = cleanVal(get(billHdrCols,'BillHD_PayModeCard'));
      const doctorCode = cleanVal(get(billHdrCols,'BillHD_doctr_DocNo'));
      if (!billNo) continue;
      bills.push({ billNo, date:billDate, subtotal, discount, tax, total, cash, card, doctorCode, type:'Cash' });
    }
    else if (currentTable === 'bill_header_insurance' && billInsHdrCols.length) {
      const billNo = cleanVal(get(billInsHdrCols,'BillHD_DocNo'));
      const billDate = parseSqlRegDate(get(billInsHdrCols,'BillHD_Date'));
      const total = cleanVal(get(billInsHdrCols,'BillHD_TotalAmount'));
      const discount = cleanVal(get(billInsHdrCols,'BillHD_DiscountAmt'));
      const insDocNo = cleanVal(get(billInsHdrCols,'BillHD_InsDocNo'));
      const doctorCode = cleanVal(get(billInsHdrCols,'BillHD_doctr_DocNo'));
      if (!billNo) continue;
      billsIns.push({ billNo, date:billDate, total, discount, insuranceCode:insDocNo, doctorCode, type:'Insurance' });
    }
  }

  console.log('\r  Lines: '+lineNum+' ✓');
  console.log('  Time: '+((Date.now()-t0)/1000).toFixed(1)+'s\n');

  // Doctor mapping
  const doctorMap = {};
  doctors.forEach(d => { if(d._code) doctorMap[d._code] = d.name; });

  // Map doctor codes in appointments
  let mapped=0;
  appointments.forEach(a => { if(a.doctor && doctorMap[a.doctor]){a.doctor=doctorMap[a.doctor];mapped++;} });

  // Map doctor codes in bills
  bills.forEach(b => { b.doctor = doctorMap[b.doctorCode]||b.doctorCode; delete b.doctorCode; });
  billsIns.forEach(b => { b.doctor = doctorMap[b.doctorCode]||b.doctorCode; delete b.doctorCode; });

  // Clean doctors
  doctors.forEach(d => delete d._code);
  patients.forEach(p => delete p._docType);

  // Sort patients by MR
  patients.sort((a,b) => (parseInt(a.mrNo)||0) - (parseInt(b.mrNo)||0));

  const maxMr = Math.max(0, ...patients.map(p => parseInt(p.mrNo)||0));

  console.log('  ═══ RESULTS ═══');
  console.log('  Patients:      '+patients.length);
  console.log('  Appointments:  '+appointments.length+' ('+mapped+' with doctor mapped)');
  console.log('  Doctors:       '+doctors.length);
  console.log('  Insurance Co:  '+insurance.length);
  console.log('  Bills (Cash):  '+bills.length);
  console.log('  Bills (Ins):   '+billsIns.length);
  console.log('  Next MR No:    '+(maxMr+1));

  // Backup
  if (fs.existsSync(CLINIC_FILE)) {
    const bak = CLINIC_FILE.replace('.json','.backup.'+Date.now()+'.json');
    fs.copyFileSync(CLINIC_FILE, bak);
    console.log('\n  Backup: '+path.basename(bak));
  }

  // Build final DB
  const db = {
    patients,
    consultations: [],
    claims: [...bills, ...billsIns],
    logsheetEntries: [],
    insuranceCompanies: insurance,
    insuranceMappings: [],
    appointments,
    doctors,
    bills,
    billsInsurance: billsIns,
    signatures: {},
    nextIds: { patient: maxMr+1, consultation:1, claim: Math.max(bills.length,billsIns.length)+1, insurance: insurance.length+1 }
  };

  fs.writeFileSync(CLINIC_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved clinic-data.json');
  console.log('     ALL DATA IMPORTED SUCCESSFULLY');
  console.log('\n  ▶️  Run: node server.js\n');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
