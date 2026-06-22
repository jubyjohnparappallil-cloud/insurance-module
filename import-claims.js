/**
 * Import Insurance Claims from ayurins_claim + ayurins_claimdetails tables
 * Usage: node import-claims.js
 */
const fs = require('fs');
const readline = require('readline');

const SQL_FILE = 'shanthiayur_db.sql';
const DB_FILE = 'clinic-data.json';

function parseRow(line) {
  let s = line.trim();
  if (s.startsWith('(')) s = s.substring(1);
  if (s.endsWith('),')) s = s.slice(0, -2);
  else if (s.endsWith(');')) s = s.slice(0, -2);
  else if (s.endsWith(')')) s = s.slice(0, -1);
  const values = []; let i = 0, val = '', inQ = false;
  while (i < s.length) {
    const ch = s[i];
    if (inQ) {
      if (ch === '\\') { val += s[i+1] || ''; i += 2; continue; }
      if (ch === "'") { if (s[i+1] === "'") { val += "'"; i += 2; continue; } inQ = false; i++; continue; }
      val += ch; i++;
    } else {
      if (ch === "'") { inQ = true; i++; }
      else if (ch === ',') { values.push(val.trim() === 'NULL' ? '' : val.trim()); val = ''; i++; }
      else { val += ch; i++; }
    }
  }
  values.push(val.trim() === 'NULL' ? '' : val.trim());
  return values;
}

async function main() {
  console.log('Importing insurance claims from', SQL_FILE);
  const rl = readline.createInterface({ input: fs.createReadStream(SQL_FILE, 'utf8'), crlfDelay: Infinity });

  let claimCols = [], detCols = [], claims = [], details = [];
  let currentTable = '', lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 100000 === 0) process.stdout.write('\r  Lines: ' + lineNum + '...');

    // Detect INSERT
    const im = line.match(/^insert\s+into\s+`(\w+)`\s*\((.+)\)\s*values/i);
    if (im) {
      currentTable = im[1].toLowerCase();
      const cols = im[2].split(',').map(c => c.trim().replace(/`/g, ''));
      if (currentTable === 'ayurins_claim') claimCols = cols;
      else if (currentTable === 'ayurins_claimdetails') detCols = cols;
      continue;
    }

    if (line.startsWith('/*') || line.startsWith('DROP') || line.startsWith('CREATE')) {
      currentTable = '';
      continue;
    }

    if (!line.startsWith("('")) continue;

    if (currentTable === 'ayurins_claim' && claimCols.length) {
      const v = parseRow(line);
      const get = (col) => { const i = claimCols.indexOf(col); return i >= 0 && i < v.length ? v[i] : ''; };
      claims.push({
        claimId: get('ClaimHD_DocNo'),
        startDate: get('ClaimHD_StartDate'),
        endDate: get('ClaimHD_EndDate'),
        mrNo: get('ClaimHD_Pat_DocNo'),
        amount: get('ClaimHD_Amount'),
        receivedAmount: get('ClaimHD_ReceivedAmount'),
        netAmount: get('ClaimHD_NetAmount'),
        notes: get('ClaimHD_Notes') || get('ClaimHD_Examination') || '',
        createdAt: get('ClaimHD_CreatedDate') || get('ClaimHD_ClaimCreatedDate') || '',
        isDeleted: get('ClaimHD_isDeleted')
      });
    }
    else if (currentTable === 'ayurins_claimdetails' && detCols.length) {
      const v = parseRow(line);
      const get = (col) => { const i = detCols.indexOf(col); return i >= 0 && i < v.length ? v[i] : ''; };
      details.push({
        detailId: get('ClaimDet_DocNo'),
        claimId: get('ClaimDetHD_DocNo'),
        amount: get('ClaimDet_Amount'),
        totalAmount: get('ClaimDet_TotalAmount'),
        quantity: get('ClaimDet_Quantity'),
        gross: get('ClaimDet_Gross'),
        discPer: get('ClaimDet_DisPer'),
        discAmount: get('ClaimDet_DisAmount'),
        vatPer: get('ClaimDet_VatPer'),
        vatAmount: get('ClaimDet_VatAmount'),
        netAmount: get('ClaimDet_NetAmount'),
        treatDate: get('ClaimDet_TreatmentDate') || '',
        progress: get('ClaimDet_TreatProgress') || '',
        inTime: get('ClaimDet_InTime') || '',
        outTime: get('ClaimDet_OutTime') || '',
        description: get('ClaimDet_Description') || ''
      });
    }
  }

  // Filter out deleted claims
  claims = claims.filter(c => c.isDeleted !== '1');
  claims.forEach(c => delete c.isDeleted);

  console.log('\r  Lines: ' + lineNum + ' ✓');
  console.log('\n  Insurance Claims: ' + claims.length);
  console.log('  Claim Details:    ' + details.length);
  if (claims.length) console.log('  Sample claim:', JSON.stringify(claims[0]));
  if (details.length) console.log('  Sample detail:', JSON.stringify(details[0]));

  // Load DB and add claims
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.insuranceClaims = claims;
  db.insuranceClaimDetails = details;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');

  console.log('\n  ✅ Saved ' + claims.length + ' claims + ' + details.length + ' details to clinic-data.json');
}

main().catch(e => console.error('ERROR:', e));
