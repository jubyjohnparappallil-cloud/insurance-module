/**
 * Link consultations to patient MR numbers using app_patientvisit table
 * Usage: node link-consultations.js
 */
const fs = require('fs');
const readline = require('readline');

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

async function main() {
  console.log('Linking consultations to patients...');
  
  // Read visit-to-patient mapping from SQL
  const rl = readline.createInterface({input:fs.createReadStream('shanthiayur_db.sql','utf8'),crlfDelay:Infinity});
  let visitCols=[], visitMap={}, ct='';

  for await (const line of rl) {
    const im = line.match(/^insert\s+into\s+`app_patientvisit`\s*\((.+)\)\s*values/i);
    if (im) { ct='visit'; visitCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='visit' && line.startsWith("('")) {
      const vals = parseRow(line);
      const get=(col)=>{const i=visitCols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};
      const vstDocNo = get('vst_DocNo');
      const patDocNo = get('vst_PatientDocNo');
      const doctorCode = get('vst_DoctorDocNo');
      const startTime = get('vst_EncounterStart') || get('vst_CreatedTime');
      if (vstDocNo && patDocNo) {
        visitMap[vstDocNo] = { mrNo: patDocNo, doctorCode, date: startTime ? startTime.split(' ')[0] : '' };
      }
    }
  }

  console.log('  Visit mappings loaded:', Object.keys(visitMap).length);

  const doctorMap = {
    'EM0057':'LINTU RAJAN','EM0058':'NEETHU DEEPAK','EM0059':'MISNA UVAISE',
    'EM0060':'KEERTHI PURUSHOTHAMAN','EM0061':'AMARNATH','EM0062':'ASHISH',
    'EM0063':'ANEESH','EM0064':'RESHMI','EM0065':'LINTU','EM0066':'NEETHU',
    'EM0067':'SHILPA','EM0068':'RENJU','EM0069':'NOORA HOSBET UMMER',
    'EM0071':'ANJNA NADAKKAVIL CHANDRAN'
  };

  // Load DB and link
  const db = JSON.parse(fs.readFileSync('clinic-data.json','utf8'));
  const patients = db.patients || [];
  let linked = 0, unlinked = 0;

  db.consultations.forEach(c => {
    if (c.visitDocNo && visitMap[c.visitDocNo]) {
      const visit = visitMap[c.visitDocNo];
      c.mrNo = visit.mrNo;
      c.doctor = doctorMap[visit.doctorCode] || visit.doctorCode || '';
      if (visit.date) {
        const m = visit.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          c.consultDate = String(parseInt(m[3])).padStart(2,'0') + '-' + String(parseInt(m[2])).padStart(2,'0') + '-' + m[1];
        }
      }
      // Find patient name
      const pat = patients.find(p => p.mrNo === c.mrNo);
      if (pat) c.patientName = (pat.firstName + ' ' + pat.lastName).trim();
      linked++;
    } else {
      unlinked++;
    }
  });

  console.log('  Linked:', linked, 'Unlinked:', unlinked);
  console.log('  Sample linked:', JSON.stringify(db.consultations.find(c=>c.mrNo), null, 2).substring(0, 400));

  fs.writeFileSync('clinic-data.json', JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved consultations with patient links');
}

main().catch(e => console.error('ERROR:', e));
