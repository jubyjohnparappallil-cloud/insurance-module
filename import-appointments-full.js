/**
 * FULL Appointment Import using app_patientvisit + appointment tables
 * This gets ALL visits with doctor, therapist, room, date/time, patient
 * Usage: node import-appointments-full.js
 */
const fs = require('fs');
const readline = require('readline');
const SQL_FILE = 'shanthiayur_db2.sql';
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

async function main() {
  console.log('Full appointment import from app_patientvisit + appointment...');
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const patients = db.patients || [];
  
  // Doctor map
  const doctorMap = {
    'EM0057':'LINTU RAJAN','EM0058':'NEETHU DEEPAK','EM0059':'MISNA UVAISE',
    'EM0060':'KEERTHI PURUSHOTHAMAN','EM0061':'AMARNATH','EM0062':'ASHISH',
    'EM0063':'ANEESH','EM0064':'RESHMI','EM0065':'LINTU','EM0066':'NEETHU',
    'EM0067':'SHILPA','EM0068':'RENJU','EM0069':'NOORA HOSBET UMMER',
    'EM0070':'DR. NOORA HOSBET UMMER','EM0071':'ANJNA NADAKKAVIL CHANDRAN',
    'EM0072':'ANJANA','EM0073':'ANJANA'
  };
  // Room map
  const roomMap = {
    '00000043':'CONSULTATION ROOM','00000044':'ROOM 1','00000045':'HOMEO ROOM',
    '00000046':'ROOM 2','00000047':'ROOM 3','00000048':'ROOM 4','00000049':'PHYSIO ROOM'
  };

  const rl = readline.createInterface({input:fs.createReadStream(SQL_FILE,'utf8'),crlfDelay:Infinity});
  
  let visitCols=[], apptCols=[];
  let visits=[], apptMap={};
  let ct='', lineNum=0;

  for await (const line of rl) {
    lineNum++;
    if(lineNum%100000===0) process.stdout.write('\r  Lines: '+lineNum+'...');

    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) {
      ct = im[1].toLowerCase();
      const cols = im[2].split(',').map(c=>c.trim().replace(/`/g,''));
      if (ct==='app_patientvisit') visitCols=cols;
      else if (ct==='appointment') apptCols=cols;
      continue;
    }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (!line.startsWith("('")) continue;

    const vals = parseRow(line);
    const get=(cols,col)=>{const i=cols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};

    if (ct==='app_patientvisit' && visitCols.length) {
      const isDeleted = get(visitCols,'vst_IsDeleted');
      if (isDeleted==='1') continue;
      
      const mrNo = get(visitCols,'vst_PatientDocNo');
      const doctorCode = get(visitCols,'vst_DoctorDocNo');
      const therapistCode = get(visitCols,'vst_TherapistDocNo');
      const roomCode = get(visitCols,'vst_RoomDocNo');
      const status = get(visitCols,'vst_VisitStatus');
      const startTime = get(visitCols,'vst_EncounterStart') || get(visitCols,'vst_CreatedTime');
      const apptDocNo = get(visitCols,'vst_app_DocNo');
      const visitDocNo = get(visitCols,'vst_DocNo');

      let date = '', time = '';
      if (startTime) {
        const m = startTime.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (m) {
          date = pad2(parseInt(m[3]))+'/'+MONTHS[parseInt(m[2])-1]+'/'+m[1];
          let h=parseInt(m[4]),mi=parseInt(m[5]);
          mi=Math.round(mi/15)*15; if(mi===60){mi=0;h++;}
          const ampm=h>=12?'PM':'AM'; if(h>12)h-=12; if(h===0)h=12;
          time = h+':'+pad2(mi)+' '+ampm;
        }
      }

      const pat = patients.find(p => p.mrNo === mrNo);
      const patientName = pat ? (pat.firstName + ' ' + pat.lastName).trim() : mrNo;

      visits.push({
        date, time,
        doctor: doctorMap[doctorCode] || doctorCode || '',
        therapist: doctorMap[therapistCode] || therapistCode || '',
        room: roomMap[roomCode] || roomCode || '',
        patient: patientName,
        patientName: patientName,
        mrNo,
        mobile: pat ? pat.mobile : '',
        status: status || 'Booked',
        notes: '',
        visitDocNo,
        apptDocNo
      });
    }
    else if (ct==='appointment' && apptCols.length) {
      const isDeleted = get(apptCols,'app_isDeleted');
      if (isDeleted==='1') continue;
      const docNo = get(apptCols,'app_DocNo');
      const patName = get(apptCols,'app_PatName');
      const mobile = get(apptCols,'app_PatMob').replace(/[_\s]/g,'');
      const notes = get(apptCols,'app_Notes');
      const purpose = get(apptCols,'app_Purpose');
      const therapistCode = get(apptCols,'app_TherapistDocNo');
      const roomCode = get(apptCols,'app_Room_DocNo');
      apptMap[docNo] = { patientName: patName, mobile, notes, purpose, therapistCode, roomCode };
    }
  }

  console.log('\r  Lines: '+lineNum+' ✓\n');
  console.log('  Patient Visits: '+visits.length);
  console.log('  Appointment refs: '+Object.keys(apptMap).length);

  // Enrich visits with appointment data (patient name, mobile, notes, purpose)
  let enriched = 0;
  visits.forEach(v => {
    if (v.apptDocNo && apptMap[v.apptDocNo]) {
      const a = apptMap[v.apptDocNo];
      if (!v.patient || v.patient === v.mrNo) v.patient = a.patientName;
      if (!v.patientName || v.patientName === v.mrNo) v.patientName = a.patientName;
      if (!v.mobile && a.mobile) v.mobile = a.mobile;
      if (!v.notes && a.notes) v.notes = a.notes;
      if (a.purpose) v.purpose = a.purpose.charAt(0).toUpperCase() + a.purpose.slice(1).toLowerCase();
      if (!v.therapist && a.therapistCode) v.therapist = doctorMap[a.therapistCode] || a.therapistCode;
      if (!v.room && a.roomCode) v.room = roomMap[a.roomCode] || a.roomCode;
      enriched++;
    }
    if (!v.purpose) v.purpose = '';
    // Cleanup internal fields
    delete v.visitDocNo;
    delete v.apptDocNo;
  });

  // Count purposes
  const purposes = {};
  visits.forEach(v => { purposes[v.purpose || 'Unknown'] = (purposes[v.purpose || 'Unknown']||0)+1; });
  console.log('  Purposes:', JSON.stringify(purposes));

  console.log('  Enriched from appointment table: '+enriched);

  // Count by date
  const byDate = {};
  visits.forEach(v => { byDate[v.date] = (byDate[v.date]||0)+1; });
  const dates = Object.keys(byDate).sort();
  console.log('  Date range: '+dates[0]+' to '+dates[dates.length-1]);
  console.log('  Unique dates: '+dates.length);
  console.log('  Avg per day: '+(visits.length/dates.length).toFixed(1));

  // With doctors assigned
  const withDoc = visits.filter(v => v.doctor && !v.doctor.startsWith('EM'));
  console.log('  With doctor name: '+withDoc.length+' / '+visits.length);

  // Save
  db.appointments = visits;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved '+visits.length+' appointments to clinic-data.json');
  console.log('  Sample:', JSON.stringify(visits[0]));
}

main().catch(e => console.error('ERROR:', e));
