/**
 * Import Consultations from treatmentconsultation + treat_diagnosis + tt_proceduredetails
 * Usage: node import-consultations.js
 */
const fs = require('fs');
const readline = require('readline');

const SQL_FILE = 'shanthiayur_db.sql';
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
function fmtDate(s){
  if(!s||s.startsWith('0000')||s.startsWith('0001'))return'';
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m){const y=parseInt(m[1]),mo=parseInt(m[2]),d=parseInt(m[3]);if(y<1900||y>2030)return'';return pad2(d)+'-'+pad2(mo)+'-'+y;}
  return'';
}

async function main() {
  console.log('Importing consultations from', SQL_FILE);
  const rl = readline.createInterface({input:fs.createReadStream(SQL_FILE,'utf8'),crlfDelay:Infinity});

  let consultCols=[], diagCols=[], procCols=[];
  let consultations=[], diagnoses=[], procedures=[];
  let ct='', lineNum=0;

  for await (const line of rl) {
    lineNum++;
    if(lineNum%100000===0) process.stdout.write('\r  Lines: '+lineNum+'...');

    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) {
      ct = im[1].toLowerCase();
      const cols = im[2].split(',').map(c=>c.trim().replace(/`/g,''));
      if (ct==='treatmentconsultation') consultCols=cols;
      else if (ct==='treat_diagnosis') diagCols=cols;
      else if (ct==='tt_proceduredetails') procCols=cols;
      continue;
    }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (!line.startsWith("('")) continue;

    const vals = parseRow(line);
    const get=(cols,col)=>{const i=cols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};

    if (ct==='treatmentconsultation' && consultCols.length) {
      const chiefComplaints = get(consultCols,'treatconsultation_Cheifcomplaints');
      const history = get(consultCols,'treatconsultation_HistoryofPresentIllness');
      const treatmentPlan = get(consultCols,'treatconsultation_TreatmentPlan');
      const clinicalNotes = get(consultCols,'treatconsultation_ClinicalNotes');
      const visitDocNo = get(consultCols,'treatconsultation_VisitDocNo');
      const examination = get(consultCols,'treatconsultation_Examination');
      const advice = get(consultCols,'treatconsultation_Advice');
      const docNo = get(consultCols,'treatconsultation_DocNo');
      const isDeleted = get(consultCols,'treatconsultation_IsDelete');
      if (isDeleted==='1') continue;
      consultations.push({
        id: docNo,
        visitDocNo,
        chiefComplaints: chiefComplaints.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'),
        history: history.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'),
        treatmentPlan: treatmentPlan.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'),
        clinicalNotes: clinicalNotes==='null'?'':clinicalNotes,
        examination: examination.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'),
        advice: advice.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n'),
        createdBy: get(consultCols,'treatconsultation_CreatedUser')
      });
    }
    else if (ct==='treat_diagnosis' && diagCols.length) {
      const visitDocNo = get(diagCols,'treatdiag_VisitDocNo');
      const code = get(diagCols,'treatdiag_DiagCode');
      const desc = get(diagCols,'treatdiag_DiagDescription');
      const diagType = get(diagCols,'treatdiag_DiagType');
      const isDeleted = get(diagCols,'treatdiag_isDeleted');
      if (isDeleted==='1') continue;
      diagnoses.push({ visitDocNo, code, description: desc, diagType });
    }
    else if (ct==='tt_proceduredetails' && procCols.length) {
      const visitDocNo = get(procCols,'ttpd_VisitDocNo') || get(procCols,'ttpd_AppDocNo');
      const desc = get(procCols,'ttpd_Description') || get(procCols,'ttpd_TariffDescription');
      const amount = get(procCols,'ttpd_Amount');
      const sessions = get(procCols,'ttpd_Sessions') || get(procCols,'ttpd_Quantity');
      const price = get(procCols,'ttpd_Price') || get(procCols,'ttpd_Rate');
      const isDeleted = get(procCols,'ttpd_isDeleted');
      if (isDeleted==='1') continue;
      procedures.push({ visitDocNo, description: desc, amount, sessions, price });
    }
  }

  console.log('\r  Lines: '+lineNum+' ✓\n');
  console.log('  Consultations:  '+consultations.length);
  console.log('  Diagnoses:      '+diagnoses.length);
  console.log('  Procedures:     '+procedures.length);

  // Link diagnoses and procedures to consultations via visitDocNo
  const diagByVisit = {};
  diagnoses.forEach(d => { if(!diagByVisit[d.visitDocNo])diagByVisit[d.visitDocNo]=[]; diagByVisit[d.visitDocNo].push(d); });
  const procByVisit = {};
  procedures.forEach(p => { if(!procByVisit[p.visitDocNo])procByVisit[p.visitDocNo]=[]; procByVisit[p.visitDocNo].push(p); });

  // Build final consultations
  const finalConsults = consultations.map((c, idx) => ({
    id: idx + 1,
    consultDate: '',
    mrNo: '',
    visitDocNo: c.visitDocNo,
    chiefComplaints: c.chiefComplaints,
    history: c.history,
    treatmentPlan: c.treatmentPlan,
    examination: c.examination,
    advice: c.advice,
    createdBy: c.createdBy,
    diagnoses: (diagByVisit[c.visitDocNo] || []).map(d => ({ code: d.code, description: d.description, type: d.diagType })),
    procedures: (procByVisit[c.visitDocNo] || []).map(p => ({ description: p.description, amount: p.amount, sessions: p.sessions, price: p.price }))
  }));

  const withData = finalConsults.filter(c => c.chiefComplaints || c.examination || c.treatmentPlan);
  console.log('  With actual content: '+withData.length);

  // Save to DB
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.consultations = withData;
  db.nextIds.consultation = withData.length + 1;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved '+withData.length+' consultations to clinic-data.json');
  if (withData.length > 0) {
    console.log('\n  Sample:', JSON.stringify(withData[0], null, 2).substring(0, 400));
  }
}

main().catch(e => console.error('ERROR:', e));
