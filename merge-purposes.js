/**
 * Merge purpose data from 48MB file into existing appointments
 * Uses the appointment table from shanthiayur_db2.sql which has app_Purpose field
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
  console.log('Extracting purposes from shanthiayur_db2.sql...');
  
  // Read purposes from 48MB file appointment table
  const rl = readline.createInterface({input:fs.createReadStream('shanthiayur_db2.sql','utf8'),crlfDelay:Infinity});
  let apptCols=[], purposeMap={}, ct='', lineNum=0;

  for await (const line of rl) {
    lineNum++;
    const im = line.match(/^insert\s+into\s+`appointment`\s*\((.+)\)\s*values/i);
    if (im) { ct='appointment'; apptCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='appointment' && line.startsWith("('")) {
      const vals = parseRow(line);
      const get=(col)=>{const i=apptCols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};
      const docNo = get('app_DocNo');
      const purpose = get('app_Purpose');
      const patDocNo = get('app_PatDocNo');
      if (docNo) purposeMap[docNo] = { purpose: purpose || '', patDocNo };
    }
  }

  console.log('  Appointments with purpose data:', Object.keys(purposeMap).length);
  const withPurpose = Object.values(purposeMap).filter(v=>v.purpose);
  console.log('  With actual purpose value:', withPurpose.length);

  // Load current DB
  const db = JSON.parse(fs.readFileSync('clinic-data.json','utf8'));
  console.log('  Current appointments:', db.appointments.length);

  // Match by apptDocNo (stored during import) or by mrNo + date
  // Since apptDocNo was deleted, we need to match by patient MR + approximate time
  // Let's re-import with purpose from both files combined

  // Actually let's just assign purposes based on the appointment -> patientvisit link
  // The app_patientvisit has vst_app_DocNo which links to appointment.app_DocNo
  // Re-read 62MB to get vst_app_DocNo mapping
  
  const rl2 = readline.createInterface({input:fs.createReadStream('shanthiayur_db.sql','utf8'),crlfDelay:Infinity});
  let visitCols=[], visitToAppt={}, lineNum2=0;

  for await (const line of rl2) {
    lineNum2++;
    const im = line.match(/^insert\s+into\s+`app_patientvisit`\s*\((.+)\)\s*values/i);
    if (im) { ct='visit'; visitCols=im[1].split(',').map(c=>c.trim().replace(/`/g,'')); continue; }
    if (line.startsWith('/*')||line.startsWith('DROP')||line.startsWith('CREATE')){ct='';continue;}
    if (ct==='visit' && line.startsWith("('")) {
      const vals = parseRow(line);
      const get=(col)=>{const i=visitCols.indexOf(col);return i>=0&&i<vals.length?vals[i]:'';};
      const vstDocNo = get('vst_DocNo');
      const apptDocNo = get('vst_app_DocNo');
      const patDocNo = get('vst_PatientDocNo');
      const startTime = get('vst_EncounterStart') || get('vst_CreatedTime');
      if (vstDocNo && apptDocNo) visitToAppt[vstDocNo] = { apptDocNo, patDocNo, startTime };
    }
  }

  console.log('  Visit-to-appointment links:', Object.keys(visitToAppt).length);

  // Now match: for each appointment in our DB, find the visit link, then get purpose
  let matched = 0, unmatched = 0;
  
  // Build a lookup by patDocNo + time
  const apptByPatTime = {};
  db.appointments.forEach((a, idx) => {
    const key = (a.mrNo || '') + '|' + (a.date || '') + '|' + (a.time || '');
    apptByPatTime[key] = idx;
  });

  // For each visit link, find the purpose and assign it
  Object.values(visitToAppt).forEach(link => {
    if (link.apptDocNo && purposeMap[link.apptDocNo]) {
      const purpose = purposeMap[link.apptDocNo].purpose;
      if (!purpose) return;
      
      // Find matching appointment by patient + time
      const pat = link.patDocNo;
      // Try to find in appointments array
      const found = db.appointments.find(a => a.mrNo === pat && !a.purpose);
      if (found) {
        found.purpose = purpose.charAt(0).toUpperCase() + purpose.slice(1).toLowerCase();
        matched++;
      }
    }
  });

  // For remaining without purpose, try matching from 48MB appointment data directly
  db.appointments.forEach(a => {
    if (a.purpose) return;
    // Find in purposeMap by patient MR
    const matches = Object.values(purposeMap).filter(v => v.patDocNo === a.mrNo && v.purpose);
    if (matches.length > 0) {
      a.purpose = matches[0].purpose.charAt(0).toUpperCase() + matches[0].purpose.slice(1).toLowerCase();
      matched++;
    }
  });

  console.log('  Purposes assigned:', matched);

  // Final count
  const purposes = {};
  db.appointments.forEach(a => { purposes[a.purpose||'Unknown'] = (purposes[a.purpose||'Unknown']||0)+1; });
  console.log('  Final purposes:', JSON.stringify(purposes));

  fs.writeFileSync('clinic-data.json', JSON.stringify(db, null, 2), 'utf8');
  console.log('\n  ✅ Saved with updated purposes');
}

main().catch(e => console.error('ERROR:', e));
