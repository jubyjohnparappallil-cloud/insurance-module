/**
 * Import Master Data: ICD Diagnosis codes, Drugs/Medicines, Procedures/Tariff
 * Usage: node import-masters.js
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

async function main() {
  console.log('Importing master data (ICD codes, drugs, procedures)...');
  const rl = readline.createInterface({input:fs.createReadStream(SQL_FILE,'utf8'),crlfDelay:Infinity});

  let diagCols=[], drugCols=[], tariffCols=[];
  let diagnoses=[], drugs=[], procedures=[];
  let ct='', lineNum=0;

  for await (const line of rl) {
    lineNum++;
    if(lineNum%100000===0) process.stdout.write('\r  Lines: '+lineNum+'...');

    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) {
      ct = im[1].toLowerCase();
      const cols = im[2].split(',').map(c=>c.trim().replace(/`/g,''));
      if (ct==='diagnosismaster') diagCols=cols;
      else if (ct==='drugmaster') drugCols=cols;
      else if (ct==='tariff_headerdetails') tariffCols=cols;
      continue;
    }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (!line.startsWith("('")) continue;

    const vals = parseRow(line);
    const get=(cols,col)=>{const i=cols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};

    if (ct==='diagnosismaster' && diagCols.length) {
      const code = get(diagCols,'diagm_ICDCode');
      const desc = get(diagCols,'diagm_Description');
      const isDeleted = get(diagCols,'diagm_IsDeleted');
      if (isDeleted==='1' || !code) continue;
      diagnoses.push({ code, description: desc });
    }
    else if (ct==='drugmaster' && drugCols.length) {
      const tradeName = get(drugCols,'drugm_Tradename');
      const sciName = get(drugCols,'drugm_Scient_Name');
      const ddcCode = get(drugCols,'drugm_DddcCode');
      const route = get(drugCols,'drugm_Route_DocNo');
      const price = get(drugCols,'drugm_Pack_Price');
      const isDeleted = get(drugCols,'drugm_isDeleted');
      if (isDeleted==='1' || !tradeName) continue;
      drugs.push({ tradeName, scientificName: sciName, ddcCode, route, price: parseFloat(price)||0 });
    }
    else if (ct==='tariff_headerdetails' && tariffCols.length) {
      const code = get(tariffCols,'TAdet_InternationalCodeValue') || get(tariffCols,'TAdet_DocNo');
      const desc = get(tariffCols,'TAdet_Description');
      const price = get(tariffCols,'TAdet_CostPrice');
      const isDeleted = get(tariffCols,'TAdet_isDeleted');
      if (isDeleted==='1' || !desc) continue;
      procedures.push({ code, description: desc, price: parseFloat(price)||0 });
    }
  }

  console.log('\r  Lines: '+lineNum+' ✓\n');
  console.log('  ICD Diagnosis Codes: '+diagnoses.length);
  console.log('  Drugs/Medicines:     '+drugs.length);
  console.log('  Procedures/Tariff:   '+procedures.length);

  // Remove duplicates
  const uniqueDiag = [...new Map(diagnoses.map(d=>[d.code,d])).values()];
  const uniqueDrugs = [...new Map(drugs.map(d=>[d.tradeName,d])).values()];
  const uniqueProc = [...new Map(procedures.map(p=>[p.code+p.description,p])).values()];

  console.log('\n  After dedup:');
  console.log('  ICD Codes:    '+uniqueDiag.length);
  console.log('  Drugs:        '+uniqueDrugs.length);
  console.log('  Procedures:   '+uniqueProc.length);

  // Save to DB
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.diagnosisMaster = uniqueDiag;
  db.drugs = uniqueDrugs;
  db.proceduresMaster = uniqueProc;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n  ✅ All master data saved to clinic-data.json');
  console.log('\n  Samples:');
  console.log('  Diagnosis:', uniqueDiag.slice(0,3));
  console.log('  Drug:', uniqueDrugs.slice(0,3));
  console.log('  Procedure:', uniqueProc.slice(0,3));
}

main().catch(e => console.error('ERROR:', e));
