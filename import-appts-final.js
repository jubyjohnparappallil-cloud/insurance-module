/**
 * FINAL Appointment Import - uses appointment table from 48MB file (newest data)
 * PLUS app_patientvisit from 62MB file (more visits)
 * Deduplicates and keeps the best data
 */
const fs = require('fs');
const readline = require('readline');
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
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const doctorMap = {
  'EM0057':'LINTU RAJAN','EM0058':'NEETHU DEEPAK','EM0059':'MISNA UVAISE',
  'EM0060':'KEERTHI PURUSHOTHAMAN','EM0061':'AMARNATH','EM0062':'ASHISH',
  'EM0063':'ANEESH','EM0064':'RESHMI','EM0065':'LINTU','EM0066':'NEETHU',
  'EM0067':'SHILPA','EM0068':'RENJU','EM0069':'NOORA HOSBET UMMER',
  'EM0070':'DR. NOORA HOSBET UMMER','EM0071':'ANJNA NADAKKAVIL CHANDRAN',
  'EM0072':'ANJANA','EM0073':'ANJANA'
};
const roomMap = {
  '00000043':'CONSULTATION ROOM','00000044':'ROOM 1','00000045':'HOMEO ROOM',
  '00000046':'ROOM 2','00000047':'ROOM 3','00000048':'ROOM 4','00000049':'PHYSIO ROOM'
};

function parseTime(startStr) {
  if (!startStr) return {date:'',time:''};
  const m = startStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return {date:'',time:''};
  const date = pad2(parseInt(m[3]))+'/'+MONTHS[parseInt(m[2])-1]+'/'+m[1];
  let h=parseInt(m[4]),mi=parseInt(m[5]);
  // Round to nearest 15 min
  mi=Math.round(mi/15)*15; if(mi===60){mi=0;h++;}
  const ampm=h>=12?'PM':'AM'; if(h>12)h-=12; if(h===0)h=12;
  const time = h+':'+pad2(mi)+' '+ampm;
  return {date,time};
}

async function main() {
  console.log('=== FINAL APPOINTMENT IMPORT ===');
  console.log('Using 48MB file (appointment table - newest, has Purpose)');
  console.log('+ 62MB file (app_patientvisit - more visits)\n');

  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const patients = db.patients || [];
  const patMap = {};
  patients.forEach(p => { patMap[p.mrNo] = p; });

  // Step 1: Read all appointments from 48MB file (has Purpose + patient names)
  let apptCols=[], appointments=[], ct='';
  const rl1 = readline.createInterface({input:fs.createReadStream('shanthiayur_db2.sql','utf8'),crlfDelay:Infinity});
  
  for await (const line of rl1) {
    const im = line.match(/^insert\s+into\s+`appointment`\s*\((.+)\)\s*values/i);
    if (im) { ct='appointment'; apptCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='appointment' && line.startsWith("('")) {
      const vals = parseRow(line);
      const get=(col)=>{const i=apptCols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};
      const isDeleted = get('app_isDeleted');
      if (isDeleted==='1') continue;
      
      const startStr = get('app_Start');
      const {date,time} = parseTime(startStr);
      const patName = get('app_PatName');
      if (!date && !patName) continue;

      const mrNo = get('app_PatDocNo');
      const dctrCode = get('app_dctrDocNo');
      const therapistCode = get('app_TherapistDocNo');
      const roomCode = get('app_Room_DocNo');
      const purpose = get('app_Purpose');
      const mobile = get('app_PatMob').replace(/[_\s]/g,'');

      appointments.push({
        date, time,
        doctor: doctorMap[dctrCode] || dctrCode || '',
        therapist: doctorMap[therapistCode] || therapistCode || '',
        room: roomMap[roomCode] || roomCode || '',
        patient: patName,
        patientName: patName,
        mrNo,
        mobile: mobile || (patMap[mrNo]?.mobile || ''),
        status: 'Arrived',
        purpose: purpose ? purpose.charAt(0).toUpperCase() + purpose.slice(1).toLowerCase() : '',
        notes: get('app_Notes') || ''
      });
    }
  }
  console.log('  From 48MB appointment table:', appointments.length);

  // Step 2: Read app_patientvisit from 62MB file for additional visits
  let visitCols=[];
  const existingKeys = new Set();
  appointments.forEach(a => { existingKeys.add(a.mrNo+'|'+a.date+'|'+a.time); });

  const rl2 = readline.createInterface({input:fs.createReadStream('shanthiayur_db.sql','utf8'),crlfDelay:Infinity});
  let extraVisits = 0;
  
  for await (const line of rl2) {
    const im = line.match(/^insert\s+into\s+`app_patientvisit`\s*\((.+)\)\s*values/i);
    if (im) { ct='visit'; visitCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='visit' && line.startsWith("('")) {
      const vals = parseRow(line);
      const get=(col)=>{const i=visitCols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};
      const isDeleted = get('vst_IsDeleted');
      if (isDeleted==='1') continue;

      const mrNo = get('vst_PatientDocNo');
      const startTime = get('vst_EncounterStart') || get('vst_CreatedTime');
      const {date,time} = parseTime(startTime);
      
      const key = mrNo+'|'+date+'|'+time;
      if (existingKeys.has(key)) continue; // already have this appointment
      existingKeys.add(key);

      const doctorCode = get('vst_DoctorDocNo');
      const therapistCode = get('vst_TherapistDocNo');
      const roomCode = get('vst_RoomDocNo');
      const status = get('vst_VisitStatus');
      const pat = patMap[mrNo];

      appointments.push({
        date, time,
        doctor: doctorMap[doctorCode] || doctorCode || '',
        therapist: doctorMap[therapistCode] || therapistCode || '',
        room: roomMap[roomCode] || roomCode || '',
        patient: pat ? (pat.firstName + ' ' + pat.lastName).trim() : mrNo,
        patientName: pat ? (pat.firstName + ' ' + pat.lastName).trim() : mrNo,
        mrNo,
        mobile: pat ? pat.mobile : '',
        status: status || 'Booked',
        purpose: '',
        notes: ''
      });
      extraVisits++;
    }
  }
  console.log('  Extra from 62MB visits:', extraVisits);
  console.log('  TOTAL appointments:', appointments.length);

  // Stats
  const purposes = {};
  appointments.forEach(a => { purposes[a.purpose||'Unknown'] = (purposes[a.purpose||'Unknown']||0)+1; });
  console.log('  Purposes:', JSON.stringify(purposes));

  const byYear = {};
  appointments.forEach(a => { const y = a.date?.split('/')[2]||'?'; byYear[y]=(byYear[y]||0)+1; });
  console.log('  By year:', JSON.stringify(byYear));

  // Save
  db.appointments = appointments;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved', appointments.length, 'appointments');

  // Verify June 19
  const j19 = appointments.filter(a=>a.date==='19/Jun/2026');
  console.log('\n  June 19, 2026:', j19.length, 'appointments');
  j19.slice(0,5).forEach(a=>console.log('   ',a.time,a.mrNo,a.patient?.substring(0,25),a.doctor,a.purpose));
}

main().catch(e => console.error('ERROR:', e));
