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
    if (inQ) { if (ch==='\\') { val+=s[i+1]||''; i+=2; continue; } if (ch==="'") { if(s[i+1]==="'"){val+="'";i+=2;continue;} inQ=false; i++; continue; } val+=ch; i++; }
    else { if (ch==="'") { inQ=true; i++; } else if (ch===',') { values.push(val.trim()==='NULL'?'':val.trim()); val=''; i++; } else { val+=ch; i++; } }
  }
  values.push(val.trim()==='NULL'?'':val.trim());
  return values;
}

async function main() {
  console.log('Importing diagnoses and procedures for consultations...');
  const rl = readline.createInterface({input:fs.createReadStream('shanthiayur_db.sql','utf8'),crlfDelay:Infinity});
  let diagCols=[], procCols=[], diags=[], procs=[], ct='';

  for await (const line of rl) {
    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) { ct=im[1].toLowerCase(); const cols=im[2].split(',').map(c=>c.trim().replace(/`/g,''));
      if (ct==='treat_diagnosis') diagCols=cols;
      if (ct==='tt_proceduredetails') procCols=cols;
      continue;
    }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (!line.startsWith("('")) continue;

    if (ct==='treat_diagnosis' && diagCols.length) {
      const v = parseRow(line);
      const get=(col)=>{const i=diagCols.indexOf(col);return i>=0&&i<v.length?v[i]:'';};
      if (get('tDiag_isSDeleted')==='1') continue;
      diags.push({ visitDocNo: get('tDiag_Vst_DocNo'), code: get('tDiag_ICDCode'), description: get('tDiag_Diagnosis'), diagType: get('tDiag_DiagType') });
    }
    if (ct==='tt_proceduredetails' && procCols.length) {
      const v = parseRow(line);
      const get=(col)=>{const i=procCols.indexOf(col);return i>=0&&i<v.length?v[i]:'';};
      if (get('ttprodet_isDeleted')==='1') continue;
      procs.push({ headerDocNo: get('ttprodet_ttproh_DocNo'), code: get('ttprodet_MeidcalCode'), description: get('ttprodet_ProcedureName'), qty: get('ttprodet_Qty'), price: get('ttprodet_Price'), netAmount: get('ttprodet_NetAmount'), instructions: get('ttprodet_Instructions') });
    }
  }

  console.log('  Diagnoses:', diags.length, 'Procedures:', procs.length);

  // Now we need to link procedures to visits via tt_proceduresheader
  // Read procedure headers to get visit doc numbers
  const rl2 = readline.createInterface({input:fs.createReadStream('shanthiayur_db.sql','utf8'),crlfDelay:Infinity});
  let phCols=[], procHeaderMap={};

  for await (const line of rl2) {
    const im = line.match(/^insert\s+into\s+`tt_proceduresheader`\s*\((.+)\)\s*values/i);
    if (im) { ct='ph'; phCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='ph' && line.startsWith("('") && phCols.length) {
      const v = parseRow(line);
      const get=(col)=>{const i=phCols.indexOf(col);return i>=0&&i<v.length?v[i]:'';};
      procHeaderMap[get('ttproh_DocNo')] = get('ttproh_VistDocNo') || get('ttproh_VisitDocNo');
    }
  }
  console.log('  Procedure headers:', Object.keys(procHeaderMap).length);

  // Link procedures to visit doc numbers
  procs.forEach(p => { p.visitDocNo = procHeaderMap[p.headerDocNo] || ''; });

  // Group by visit
  const diagByVisit = {};
  diags.forEach(d => { if (!diagByVisit[d.visitDocNo]) diagByVisit[d.visitDocNo]=[]; diagByVisit[d.visitDocNo].push({code:d.code, description:d.description, diagType:d.diagType}); });
  const procByVisit = {};
  procs.forEach(p => { if (p.visitDocNo) { if (!procByVisit[p.visitDocNo]) procByVisit[p.visitDocNo]=[]; procByVisit[p.visitDocNo].push({code:p.code, description:p.description, sessions:p.qty, price:p.price, amount:p.netAmount||p.price, instructions:p.instructions}); }});

  // Update consultations
  const db = JSON.parse(fs.readFileSync('clinic-data.json','utf8'));
  let linked = 0;
  db.consultations.forEach(c => {
    if (c.visitDocNo) {
      if (diagByVisit[c.visitDocNo]) { c.diagnoses = diagByVisit[c.visitDocNo]; linked++; }
      if (procByVisit[c.visitDocNo]) { c.procedures = procByVisit[c.visitDocNo]; }
    }
  });

  const withDiag = db.consultations.filter(c=>c.diagnoses&&c.diagnoses.length>0);
  const withProc = db.consultations.filter(c=>c.procedures&&c.procedures.length>0);
  console.log('  Consultations with diagnoses:', withDiag.length);
  console.log('  Consultations with procedures:', withProc.length);
  if (withDiag.length) console.log('  Sample diag:', JSON.stringify(withDiag[0].diagnoses[0]));
  if (withProc.length) console.log('  Sample proc:', JSON.stringify(withProc[0].procedures[0]));

  fs.writeFileSync('clinic-data.json', JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved consultations with diagnoses and procedures');
}

main().catch(e => console.error('ERROR:', e));
