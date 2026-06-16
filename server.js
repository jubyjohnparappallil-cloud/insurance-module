/**
 * Clinic EMR - Web Server
 * 
 * Run: node server.js
 * Access: http://localhost:3000 (this PC)
 *         http://192.168.x.x:3000 (other PCs on same network)
 * 
 * This replaces the Electron desktop app with a web version
 * that any device on your network can access via browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const nodemailer = require('nodemailer');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'clinic-data.json');

// ─── Email Configuration (Gmail SMTP via Nodemailer) ─────────────
const EMAIL_CONFIG = {
  clinicName: 'SHANTHI WELLNESS AYURVEDIC MEDICAL CENTRE LLC',
  clinicPhone: '+97142255133',
  fromEmail: 'jubyjohnparappallil@gmail.com'
};

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'jubyjohnparappallil@gmail.com',
    pass: 'mukiezppmtjitgwn'
  },
  tls: {
    rejectUnauthorized: false
  }
});
console.log('✉️  Email ready (Gmail SMTP)');

async function sendAppointmentEmail(patientEmail, patientName, appointmentDate, appointmentTime, doctorName) {
  if (!patientEmail) return { success: false, error: 'No email provided' };
  console.log('Sending email to:', patientEmail);
  try {
    const mailOptions = {
      from: EMAIL_CONFIG.clinicName + ' <' + EMAIL_CONFIG.fromEmail + '>',
      to: patientEmail,
      subject: 'Appointment Confirmation - ' + EMAIL_CONFIG.clinicName,
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:2px solid #43a047;border-radius:8px;overflow:hidden">' +
        '<div style="background:#43a047;color:#fff;padding:15px 20px;text-align:center">' +
          '<h2 style="margin:0;font-size:18px">' + EMAIL_CONFIG.clinicName + '</h2>' +
          '<p style="margin:5px 0 0;font-size:12px">Appointment Confirmation</p>' +
        '</div>' +
        '<div style="padding:20px">' +
          '<p style="font-size:14px">Dear <strong>' + patientName + '</strong>,</p>' +
          '<p style="font-size:14px">Your appointment has been confirmed:</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:15px 0">' +
            '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9;width:120px">Date</td><td style="padding:8px;border:1px solid #ddd">' + appointmentDate + '</td></tr>' +
            '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9">Time</td><td style="padding:8px;border:1px solid #ddd">' + appointmentTime + '</td></tr>' +
            '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9">Doctor</td><td style="padding:8px;border:1px solid #ddd">' + (doctorName || 'Assigned Doctor') + '</td></tr>' +
          '</table>' +
          '<p style="font-size:13px;color:#666">Please arrive 10 minutes before your appointment time.</p>' +
          '<p style="font-size:13px;color:#666">For any changes, please call: <strong>' + EMAIL_CONFIG.clinicPhone + '</strong></p>' +
        '</div>' +
        '<div style="background:#f5f5f5;padding:10px 20px;text-align:center;font-size:11px;color:#888">' +
          EMAIL_CONFIG.clinicName + ' | Tel: ' + EMAIL_CONFIG.clinicPhone +
        '</div>' +
      '</div>'
    };
    const result = await emailTransporter.sendMail(mailOptions);
    console.log('📧 Email sent! ID:', result.messageId);
    return { success: true };
  } catch(e) {
    console.log('Email error:', e.message);
    return { success: false, error: e.message };
  }
}

// ─── Database (JSON file) ────────────────────────────────────────

let db = loadDatabase();

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading database:', err.message);
  }
  return {
    patients: [],
    consultations: [],
    claims: [],
    logsheetEntries: [],
    insuranceCompanies: [],
    insuranceMappings: [],
    signatures: {},
    nextIds: { patient: 4747, consultation: 1, claim: 918, insurance: 113 }
  };
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving database:', err.message);
  }
}

// ─── Helper functions ────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }
function formatDate(d) { return pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear(); }
function formatDateDot(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2'
  };
  const contentType = types[ext] || 'application/octet-stream';
  const isBinary = ['.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2'].includes(ext);

  try {
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
    const content = fs.readFileSync(filePath, isBinary ? null : 'utf8');
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// ─── Auto-generate claim + logsheet from consultation ────────────

function autoGenerateClaimAndLogsheet(consultation) {
  const claimId = 'S-' + String(db.nextIds.claim++).padStart(4, '0');
  const fromDate = consultation.consultDate;
  const procedures = consultation.procedures || [];

  let totalSessions = 0;
  let totalAmount = 0;
  for (const proc of procedures) {
    totalSessions += parseInt(proc.sessions) || 0;
    totalAmount += parseFloat(String(proc.amount || '0').replace(/,/g, '')) || 0;
  }

  const startParts = fromDate.split('-');
  const startDate = new Date(startParts[2] + '-' + startParts[1] + '-' + startParts[0]);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalSessions + 1);

  const claim = {
    claimId,
    mrNo: consultation.mrNo,
    patientName: consultation.patientName,
    fromDate,
    toDate: formatDate(endDate),
    amount: totalAmount.toFixed(2),
    receivedAmount: '0.00',
    consultationId: consultation.id,
    createdAt: new Date().toISOString()
  };
  db.claims.unshift(claim);

  // Generate logsheet entries
  let slNo = 1;
  const currentDate = new Date(startDate);

  db.logsheetEntries.push({
    claimId, slNo: slNo++,
    entryDate: formatDateDot(currentDate),
    treatmentDone: 'CONSULTATION FEE',
    inTime: '10:30 AM', outTime: '11:00 AM',
    progress: consultation.examination || ''
  });
  currentDate.setDate(currentDate.getDate() + 1);

  for (const proc of procedures) {
    const desc = (proc.description || '').toUpperCase();
    if (desc.includes('CONSUL')) continue;
    const sessions = parseInt(proc.sessions) || 1;
    let durationMin = 60;
    if (desc.includes('HALF HOUR')) durationMin = 30;

    for (let s = 0; s < sessions; s++) {
      const hour = 10 + (s % 3);
      const isPM = hour >= 12;
      const dHour = hour > 12 ? hour - 12 : hour;
      const inTime = pad2(dHour) + ':00 ' + (isPM ? 'PM' : 'AM');
      const outHour = hour + Math.floor(durationMin / 60);
      const outMin = durationMin % 60;
      const outIsPM = outHour >= 12;
      const outDHour = outHour > 12 ? outHour - 12 : outHour;
      const outTime = pad2(outDHour) + ':' + pad2(outMin) + ' ' + (outIsPM ? 'PM' : 'AM');

      db.logsheetEntries.push({
        claimId, slNo: slNo++,
        entryDate: formatDateDot(currentDate),
        treatmentDone: desc, inTime, outTime, progress: ''
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return claimId;
}

// ─── API Routes ──────────────────────────────────────────────────

async function handleAPI(req, res) {
  const url = req.url;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // ── Patients ──
  if (url === '/api/patients' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.patients });
  }
  if (url === '/api/patients' && method === 'POST') {
    const body = await parseBody(req);
    const existing = db.patients.find(p => p.mrNo === body.mrNo);
    if (existing) {
      Object.assign(existing, body);
    } else {
      if (!body.mrNo) body.mrNo = String(db.nextIds.patient++);
      body.regDate = body.regDate || formatDate(new Date());
      db.patients.unshift(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/patients/') && method === 'DELETE') {
    const mrNo = url.split('/')[3];
    db.patients = db.patients.filter(p => p.mrNo !== mrNo);
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // ── Consultations ──
  if (url === '/api/consultations' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.consultations || [] });
  }
  if (url.startsWith('/api/consultations/') && method === 'GET') {
    const mrNo = decodeURIComponent(url.split('/')[3]);
    const patientConsults = (db.consultations || []).filter(c => c.mrNo === mrNo);
    return sendJSON(res, { success: true, data: patientConsults });
  }
  if (url === '/api/consultations' && method === 'POST') {
    const body = await parseBody(req);
    const id = db.nextIds.consultation++;
    const consultation = { id, ...body, createdAt: new Date().toISOString() };
    db.consultations.push(consultation);
    const claimId = autoGenerateClaimAndLogsheet(consultation);
    saveDatabase();
    return sendJSON(res, { success: true, consultationId: id, claimId });
  }
  if (url.startsWith('/api/consultations/') && method === 'DELETE') {
    const mrNo = decodeURIComponent(url.split('/')[3]);
    db.consultations = (db.consultations || []).filter(c => c.mrNo !== mrNo);
    // Also remove related claims and logsheet entries
    const relatedClaims = (db.claims || []).filter(c => c.mrNo === mrNo);
    relatedClaims.forEach(claim => {
      db.logsheetEntries = (db.logsheetEntries || []).filter(e => e.claimId !== claim.claimId);
    });
    db.claims = (db.claims || []).filter(c => c.mrNo !== mrNo);
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // ── Claims ──
  if (url === '/api/claims' && method === 'GET') {
    // Return only user-saved claims (NOT auto-generated from consultations)
    const userClaims = (db.claims || []).filter(c => c.savedByUser === true);
    return sendJSON(res, { success: true, data: userClaims });
  }
  if (url === '/api/claims/save' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.claims) db.claims = [];
    body.savedByUser = true;
    // Remove existing claim with same ID if any
    db.claims = db.claims.filter(c => c.claimId !== body.claimId);
    db.claims.unshift(body);
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url === '/api/claims/delete' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.claims) db.claims = [];
    db.claims = db.claims.filter(c => c.claimId !== body.claimId);
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // ── Logsheet ──
  if (url.startsWith('/api/logsheet/') && method === 'GET') {
    const claimId = url.split('/')[3];
    const claim = db.claims.find(c => c.claimId === claimId);
    if (!claim) return sendJSON(res, { success: false, error: 'Claim not found' }, 404);
    const entries = db.logsheetEntries.filter(e => e.claimId === claimId).sort((a, b) => a.slNo - b.slNo);
    let procedures = [], prescriptions = [];
    if (claim.consultationId) {
      const consult = db.consultations.find(c => c.id === claim.consultationId);
      if (consult) { procedures = consult.procedures || []; prescriptions = consult.prescriptions || []; }
    }
    return sendJSON(res, { success: true, data: { claim, entries, procedures, prescriptions } });
  }
  if (url.startsWith('/api/logsheet/') && method === 'PUT') {
    const parts = url.split('/');
    const claimId = parts[3];
    const slNo = parseInt(parts[4]);
    const body = await parseBody(req);
    const entry = db.logsheetEntries.find(e => e.claimId === claimId && e.slNo === slNo);
    if (entry) {
      if (body.progress !== undefined) entry.progress = body.progress;
      if (body.inTime !== undefined) entry.inTime = body.inTime;
      if (body.outTime !== undefined) entry.outTime = body.outTime;
      saveDatabase();
    }
    return sendJSON(res, { success: true });
  }

  // ── Insurance ──
  if (url === '/api/insurance' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.insuranceCompanies });
  }
  if (url === '/api/insurance' && method === 'POST') {
    const body = await parseBody(req);
    const existing = db.insuranceCompanies.find(c => c.code === body.code);
    if (existing) Object.assign(existing, body);
    else db.insuranceCompanies.push(body);
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/insurance/') && method === 'DELETE') {
    const code = decodeURIComponent(url.split('/')[3]);
    db.insuranceCompanies = db.insuranceCompanies.filter(c => c.code !== code);
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/insurance-mappings' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.insuranceMappings });
  }
  if (url === '/api/insurance-mappings' && method === 'POST') {
    const body = await parseBody(req);
    db.insuranceMappings.push(body);
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }

  // ── Database info ──
  if (url === '/api/db-path' && method === 'GET') {
    return sendJSON(res, { success: true, path: DATA_FILE });
  }

  // ── Appointments ──
  if (url === '/api/appointments' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.appointments || [] });
  }
  if (url === '/api/appointments' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.appointments) db.appointments = [];
    // Delete appointment
    if (body._delete) {
      db.appointments = db.appointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
      saveDatabase();
      return sendJSON(res, { success: true });
    }
    // Remove duplicate (same doctor + time)
    db.appointments = db.appointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
    db.appointments.push(body);
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }

  // ── Doctors ──
  if (url === '/api/doctors' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.doctors || [] });
  }
  if (url === '/api/doctors' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.doctors) db.doctors = [];
    const existing = db.doctors.find(d => d.name === body.name);
    if (existing) {
      Object.assign(existing, body);
    } else {
      db.doctors.push(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/doctors/') && method === 'DELETE') {
    const name = decodeURIComponent(url.split('/')[3]);
    if (!db.doctors) db.doctors = [];
    db.doctors = db.doctors.filter(d => d.name !== name);
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  // Doctor signature/seal
  if (url === '/api/doctor-sign' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.doctorSignatures) db.doctorSignatures = {};
    // body = { doctor: "DOCTOR NAME", type: "signature"|"seal", data: "base64" }
    if (body.doctor && body.type && body.data) {
      var key = body.doctor + '_' + body.type;
      db.doctorSignatures[key] = body.data;
      saveDatabase();
      return sendJSON(res, { success: true });
    }
    return sendJSON(res, { success: false, error: 'Missing fields' }, 400);
  }
  if (url === '/api/doctor-sign' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.doctorSignatures || {} });
  }

  // ── Read Emirates ID Card (BAC method) ──
  if (url === '/api/read-eid-bac' && method === 'POST') {
    const body = await parseBody(req);
    const { idNumber, dob, expiry } = body;
    
    try {
      const pcsclite = require('pcsclite');
      const crypto = require('crypto');
      const pcsc = pcsclite();
      
      let responded = false;
      let timeout = setTimeout(() => {
        if (!responded) { responded = true; try{pcsc.close()}catch(e){} sendJSON(res, { success: false, error: 'Card reader timeout. Insert card and try again.' }); }
      }, 8000);

      pcsc.on('reader', (reader) => {
        if (responded) return;
        reader.on('status', (status) => {
          if (responded) return;
          if (!(status.state & reader.SCARD_STATE_PRESENT)) return;
          responded = true;
          clearTimeout(timeout);

          reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: 2 }, (err, protocol) => {
            if (err) { try{pcsc.close()}catch(e){} return sendJSON(res, { success: false, error: 'Cannot connect to card: ' + err.message }); }
            if (typeof protocol !== 'number') protocol = 2;

            // Compute BAC keys from MRZ
            // Document number (9 chars) + check digit + DOB (6 chars YYMMDD) + check digit + Expiry (6 chars YYMMDD) + check digit
            const docNo = idNumber.substring(0, 9);
            const dobYY = dob.substring(4,6) + dob.substring(2,4) + dob.substring(0,2); // convert DDMMYYYY to YYMMDD
            const expiryYY = expiry.substring(4,6) + expiry.substring(2,4) + expiry.substring(0,2);
            
            function checkDigit(s) {
              const weights = [7,3,1];
              let sum = 0;
              for(let i=0; i<s.length; i++) {
                let c = s.charCodeAt(i);
                let val = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55 : 0;
                sum += val * weights[i % 3];
              }
              return String(sum % 10);
            }

            const mrzKey = docNo + checkDigit(docNo) + dobYY + checkDigit(dobYY) + expiryYY + checkDigit(expiryYY);
            const keySeed = crypto.createHash('sha1').update(mrzKey).digest().slice(0, 16);
            
            // Derive KEnc and KMac
            function deriveKey(seed, c) {
              const d = Buffer.concat([seed, Buffer.from([0,0,0,c])]);
              const h = crypto.createHash('sha1').update(d).digest().slice(0,16);
              // Adjust parity bits for 3DES
              return Buffer.concat([h.slice(0,8), h.slice(8,16), h.slice(0,8)]);
            }
            const kEnc = deriveKey(keySeed, 1);
            const kMac = deriveKey(keySeed, 2);

            // Step 1: GET CHALLENGE
            const getChallenge = Buffer.from([0x00, 0x84, 0x00, 0x00, 0x08]);
            
            // Select eMRTD first
            const selectApp = Buffer.from([0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01]);
            
            reader.transmit(selectApp, 256, protocol, (e1, d1) => {
              reader.transmit(getChallenge, 256, protocol, (e2, rndICC) => {
                if (e2 || !rndICC || rndICC.length < 10) {
                  reader.disconnect(reader.SCARD_LEAVE_CARD, ()=>{});
                  try{pcsc.close()}catch(e){}
                  return sendJSON(res, { success: false, error: 'GET CHALLENGE failed. Card may not support BAC.' });
                }
                
                // Remove status bytes
                rndICC = rndICC.slice(0, 8);
                
                // Generate random numbers
                const rndIFD = crypto.randomBytes(8);
                const kIFD = crypto.randomBytes(16);
                
                // Build S = RND.IFD || RND.ICC || K.IFD
                const S = Buffer.concat([rndIFD, rndICC, kIFD]);
                
                // Encrypt S with KEnc (3DES CBC, IV=0)
                const iv = Buffer.alloc(8);
                const cipher = crypto.createCipheriv('des-ede3-cbc', kEnc, iv);
                cipher.setAutoPadding(false);
                const eifd = Buffer.concat([cipher.update(S), cipher.final()]);
                
                // MAC over eifd with KMac
                function retailMac(key, data) {
                  // ISO 9797-1 MAC Algorithm 3 (Retail MAC)
                  const k1 = key.slice(0,8);
                  const k2 = key.slice(8,16);
                  let prev = Buffer.alloc(8);
                  for(let i=0; i<data.length; i+=8) {
                    const block = data.slice(i, i+8);
                    const xored = Buffer.alloc(8);
                    for(let j=0; j<8; j++) xored[j] = prev[j] ^ block[j];
                    const c = crypto.createCipheriv('des-ecb', k1, null);
                    c.setAutoPadding(false);
                    prev = c.update(xored);
                  }
                  // Final: decrypt with k2, then encrypt with k1
                  const d1 = crypto.createDecipheriv('des-ecb', k2, null);
                  d1.setAutoPadding(false);
                  const tmp = d1.update(prev);
                  const e1 = crypto.createCipheriv('des-ecb', k1, null);
                  e1.setAutoPadding(false);
                  return e1.update(tmp);
                }
                
                const mifd = retailMac(kMac, eifd);
                
                // MUTUAL AUTHENTICATE command
                const cmdData = Buffer.concat([eifd, mifd]); // 40 bytes
                const mutAuth = Buffer.concat([Buffer.from([0x00, 0x82, 0x00, 0x00, 0x28]), cmdData, Buffer.from([0x28])]);
                
                reader.transmit(mutAuth, 256, protocol, (e3, authResp) => {
                  reader.disconnect(reader.SCARD_LEAVE_CARD, ()=>{});
                  try{pcsc.close()}catch(e){}
                  
                  if (e3 || !authResp || authResp.length < 40) {
                    // BAC failed - but we have MRZ data, parse name from it
                    return sendJSON(res, { 
                      success: true, 
                      data: { 
                        emiratesId: idNumber,
                        message: 'BAC authentication pending. MRZ data parsed.',
                        // Parse basic info from what we know
                      },
                      partial: true
                    });
                  }
                  
                  // BAC successful! We could read DG1 now...
                  // For now return success
                  sendJSON(res, { success: true, data: { emiratesId: idNumber, message: 'Card authenticated successfully' } });
                });
              });
            });
          });
        });
        reader.on('error', ()=>{});
      });

      pcsc.on('error', (err) => {
        if (!responded) { responded = true; clearTimeout(timeout); sendJSON(res, { success: false, error: 'Card service error: ' + err.message }); }
      });
    } catch(e) {
      return sendJSON(res, { success: false, error: 'Error: ' + e.message });
    }
    return;
  }

  // ── Read Emirates ID Card ──
  if (url === '/api/read-eid' && method === 'GET') {
    // Connect to ICA Toolkit WebSocket on port 9004
    try {
      const http = require('http');
      const options = { hostname: '127.0.0.1', port: 9004, path: '/toolkit/ReadPublicData', method: 'GET', timeout: 8000 };
      
      const req2 = http.request(options, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            sendJSON(res, { success: true, data: parsed });
          } catch(e) {
            sendJSON(res, { success: true, data: { raw: data, message: 'Data received from toolkit' } });
          }
        });
      });
      req2.on('error', (e) => {
        sendJSON(res, { success: false, error: 'Cannot connect to ICA Toolkit on port 9004: ' + e.message });
      });
      req2.on('timeout', () => {
        req2.destroy();
        sendJSON(res, { success: false, error: 'Toolkit timeout - insert card and try again' });
      });
      req2.end();
    } catch(e) {
      sendJSON(res, { success: false, error: 'Error: ' + e.message });
    }
    return;
  }

  // ── Drugs ──
  if (url === '/api/drugs' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.drugs || [] });
  }
  if (url === '/api/drugs' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.drugs) db.drugs = [];
    // Update if same tradeName exists, else add
    const existing = db.drugs.find(d => d.tradeName === body.tradeName && d.ddcCode === body.ddcCode);
    if (existing) {
      Object.assign(existing, body);
    } else {
      db.drugs.unshift(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/drugs/') && method === 'DELETE') {
    const tradeName = decodeURIComponent(url.split('/')[3]);
    if (!db.drugs) db.drugs = [];
    db.drugs = db.drugs.filter(d => d.tradeName !== tradeName);
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/drugs/bulk' && method === 'POST') {
    const body = await parseBody(req);
    if (body.drugs && Array.isArray(body.drugs)) {
      db.drugs = body.drugs;
      saveDatabase();
      return sendJSON(res, { success: true, count: db.drugs.length });
    }
    return sendJSON(res, { success: false, error: 'Invalid data' }, 400);
  }

  // ── Send Appointment Email ──
  if (url === '/api/send-email' && method === 'POST') {
    const body = await parseBody(req);
    console.log('Email body received:', JSON.stringify(body));
    const result = await sendAppointmentEmail(body.email, body.patientName, body.date, body.time, body.doctor);
    return sendJSON(res, result);
  }

  // ── Signatures ──
  if (url === '/api/signatures' && method === 'GET') {
    if (!db.signatures) db.signatures = {};
    return sendJSON(res, { success: true, data: db.signatures });
  }
  if (url === '/api/signatures' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.signatures) db.signatures = {};
    // body = { type: "doctor"|"seal"|"patient", data: "base64string" }
    if (body.type && body.data) {
      db.signatures[body.type] = body.data;
      saveDatabase();
      return sendJSON(res, { success: true, message: body.type + ' signature saved' });
    }
    return sendJSON(res, { error: 'Missing type or data' }, 400);
  }

  // ── Customer Booking API (for mobile app) ──
  
  // Get available doctors and services
  if (url === '/api/booking/doctors' && method === 'GET') {
    const doctors = db.doctors || [
      {name:'LINTU RAJAN', specialty:'Ayurveda'},
      {name:'NEETHU DEEPAK', specialty:'Ayurveda'},
      {name:'HISNA UVAISI', specialty:'General'},
      {name:'NOORA', specialty:'General'}
    ];
    return sendJSON(res, { success: true, data: doctors });
  }

  // Get available slots for a date and doctor
  if (url.startsWith('/api/booking/slots') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const date = urlObj.searchParams.get('date');
    const doctor = urlObj.searchParams.get('doctor');
    if (!date || !doctor) return sendJSON(res, { success: false, error: 'date and doctor required' }, 400);
    
    if (!db.appointments) db.appointments = [];
    
    // Convert incoming DD-MM-YYYY to DD/Mon/YYYY for matching with EMR format
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let emrDate = date;
    const dp = date.split('-');
    if (dp.length === 3 && dp[1].length <= 2) {
      emrDate = dp[0] + '/' + months[parseInt(dp[1]) - 1] + '/' + dp[2];
    }
    
    // Check both date formats to find booked slots
    const bookedSlots = db.appointments.filter(a => (a.date === date || a.date === emrDate) && a.doctor === doctor && a.status !== 'Cancelled').map(a => a.time);
    
    const allSlots = ["9:00 AM","9:15 AM","9:30 AM","9:45 AM","10:00 AM","10:15 AM","10:30 AM","10:45 AM","11:00 AM","11:15 AM","11:30 AM","11:45 AM","12:00 PM","12:15 PM","12:30 PM","12:45 PM","1:00 PM","1:15 PM","1:30 PM","1:45 PM","2:00 PM","2:15 PM","2:30 PM","2:45 PM","3:00 PM","3:15 PM","3:30 PM","3:45 PM","4:00 PM","4:15 PM","4:30 PM","4:45 PM","5:00 PM","5:15 PM","5:30 PM","5:45 PM","6:00 PM","6:15 PM","6:30 PM","6:45 PM","7:00 PM","7:15 PM","7:30 PM","7:45 PM","8:00 PM"];
    const available = allSlots.filter(s => !bookedSlots.includes(s));
    return sendJSON(res, { success: true, data: { date, doctor, available, booked: bookedSlots } });
  }

  // Customer creates a booking
  if (url === '/api/booking/create' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.patientName || !body.mobile || !body.doctor || !body.date || !body.time) {
      return sendJSON(res, { success: false, error: 'Missing required fields: patientName, mobile, doctor, date, time' }, 400);
    }
    if (!db.appointments) db.appointments = [];
    
    // Convert date from DD-MM-YYYY to DD/Mon/YYYY format (EMR format)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let emrDate = body.date;
    const dateParts = body.date.split('-');
    if (dateParts.length === 3 && dateParts[1].length <= 2) {
      const monthIdx = parseInt(dateParts[1]) - 1;
      emrDate = dateParts[0] + '/' + months[monthIdx] + '/' + dateParts[2];
    }
    
    // Check if slot is still available (check both date formats)
    const allSlots = ["9:00 AM","9:15 AM","9:30 AM","9:45 AM","10:00 AM","10:15 AM","10:30 AM","10:45 AM","11:00 AM","11:15 AM","11:30 AM","11:45 AM","12:00 PM","12:15 PM","12:30 PM","12:45 PM","1:00 PM","1:15 PM","1:30 PM","1:45 PM","2:00 PM","2:15 PM","2:30 PM","2:45 PM","3:00 PM","3:15 PM","3:30 PM","3:45 PM","4:00 PM","4:15 PM","4:30 PM","4:45 PM","5:00 PM","5:15 PM","5:30 PM","5:45 PM","6:00 PM","6:15 PM","6:30 PM","6:45 PM","7:00 PM","7:15 PM","7:30 PM","7:45 PM","8:00 PM"];
    const existing = db.appointments.find(a => a.doctor === body.doctor && (a.date === emrDate || a.date === body.date) && a.time === body.time && a.status !== 'Cancelled');
    if (existing) {
      // Find nearest available slots
      const bookedSlots = db.appointments.filter(a => a.doctor === body.doctor && (a.date === emrDate || a.date === body.date) && a.status !== 'Cancelled').map(a => a.time);
      const availableSlots = allSlots.filter(s => !bookedSlots.includes(s));
      // Find nearest to the requested time
      const requestedIdx = allSlots.indexOf(body.time);
      let nearestSlots = [];
      if (requestedIdx >= 0 && availableSlots.length > 0) {
        nearestSlots = availableSlots.map(s => ({ slot: s, distance: Math.abs(allSlots.indexOf(s) - requestedIdx) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5)
          .map(s => s.slot);
      }
      return sendJSON(res, { 
        success: false, 
        error: 'This slot (' + body.time + ') is already booked for Dr. ' + body.doctor + ' on this date.',
        nearestAvailable: nearestSlots,
        message: nearestSlots.length > 0 ? 'Nearest available slots: ' + nearestSlots.join(', ') : 'No slots available for this doctor on this date.'
      }, 409);
    }
    
    // Save in EMR-compatible format (field "patient" not "patientName")
    const booking = {
      patient: body.patientName,
      patientName: body.patientName,
      mrNo: '',
      mobile: body.mobile,
      email: body.email || '',
      doctor: body.doctor,
      consultDoctor: body.doctor,
      date: emrDate,
      time: body.time,
      room: '',
      service: body.service || 'Consultation',
      notes: 'Booked via Customer App',
      status: 'Booked',
      source: 'CustomerApp',
      bookedAt: new Date().toISOString(),
      bookingId: 'BK-' + Date.now()
    };
    db.appointments.push(booking);
    saveDatabase();
    // Send confirmation email if provided
    if (body.email) {
      sendAppointmentEmail(body.email, body.patientName, body.date, body.time, body.doctor).catch(()=>{});
    }
    return sendJSON(res, { success: true, data: booking, message: 'Appointment booked successfully!' });
  }

  // Customer checks their bookings by mobile number
  if (url.startsWith('/api/booking/my-appointments') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const mobile = urlObj.searchParams.get('mobile');
    if (!mobile) return sendJSON(res, { success: false, error: 'mobile required' }, 400);
    if (!db.appointments) db.appointments = [];
    const myAppts = db.appointments.filter(a => a.mobile === mobile).sort((a,b) => new Date(b.bookedAt||0) - new Date(a.bookedAt||0));
    return sendJSON(res, { success: true, data: myAppts });
  }

  // Customer cancels a booking
  if (url === '/api/booking/cancel' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.bookingId || !body.mobile) return sendJSON(res, { success: false, error: 'bookingId and mobile required' }, 400);
    if (!db.appointments) db.appointments = [];
    const appt = db.appointments.find(a => a.bookingId === body.bookingId && a.mobile === body.mobile);
    if (!appt) return sendJSON(res, { success: false, error: 'Booking not found' }, 404);
    appt.status = 'Cancelled';
    saveDatabase();
    return sendJSON(res, { success: true, message: 'Booking cancelled' });
  }

  // Customer submits feedback
  if (url === '/api/booking/feedback' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.feedback) db.feedback = [];
    db.feedback.push({ ...body, submittedAt: new Date().toISOString() });
    saveDatabase();
    return sendJSON(res, { success: true, message: 'Thank you for your feedback!' });
  }

  // Get clinic info (for customer app)
  if (url === '/api/booking/clinic-info' && method === 'GET') {
    return sendJSON(res, { success: true, data: {
      name: 'Shanthi Wellness Ayurvedic Medical Centre LLC',
      phone: '+971 42 255 133',
      whatsapp: '+971 42 255 133',
      website: 'www.shanthiwellness.com',
      address: 'Dubai, UAE',
      workingHours: '9:00 AM - 9:00 PM',
      workingDays: 'Sunday - Saturday',
      branches: [
        { name: 'Main Branch - Dubai', phone: '+971 42 255 133', address: 'Dubai, UAE' }
      ],
      services: ['Consultation', 'Panchakarma', 'Physiotherapy', 'Ayurveda Treatment', 'Steam Therapy', 'Massage Therapy', 'Wellness Package']
    }});
  }

  // Customer views their packages/sessions
  if (url.startsWith('/api/booking/my-packages') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const mobile = urlObj.searchParams.get('mobile');
    if (!mobile) return sendJSON(res, { success: false, error: 'mobile required' }, 400);
    // Find patient by mobile and return their package info
    const patient = (db.patients || []).find(p => p.mobile === mobile || p.whatsapp === mobile);
    if (!patient || !patient.packageName || patient.packageName === 'None') {
      return sendJSON(res, { success: true, data: [] });
    }
    const pkgData = [{
      packageName: patient.packageName,
      totalSessions: parseInt(patient.packageVisits) || 0,
      consumedSessions: Math.max(0, (parseInt(patient.packageVisits) || 0) - (parseInt(patient.packageBalance) || 0)),
      balanceSessions: parseInt(patient.packageBalance) || 0,
      startDate: patient.packageStart || '',
      expiryDate: patient.policyExpiry || '',
      status: 'Active'
    }];
    return sendJSON(res, { success: true, data: pkgData });
  }

  // Admin confirms an appointment (from EMR side)
  if (url === '/api/booking/confirm' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.bookingId) return sendJSON(res, { success: false, error: 'bookingId required' }, 400);
    if (!db.appointments) db.appointments = [];
    const appt = db.appointments.find(a => a.bookingId === body.bookingId);
    if (!appt) return sendJSON(res, { success: false, error: 'Booking not found' }, 404);
    appt.status = 'Confirmed';
    appt.confirmedAt = new Date().toISOString();
    appt.confirmedBy = body.confirmedBy || 'Receptionist';
    saveDatabase();
    // Send confirmation email
    if (appt.email) {
      sendAppointmentEmail(appt.email, appt.patientName, appt.date, appt.time, appt.doctor).catch(()=>{});
    }
    return sendJSON(res, { success: true, message: 'Appointment confirmed', data: appt });
  }

  // ── Patient Auth (Register / Login) ──
  if (url === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.name || !body.mobile || !body.password) {
      return sendJSON(res, { success: false, error: 'Name, mobile and password are required' }, 400);
    }
    if (!db.appUsers) db.appUsers = [];
    const existingUser = db.appUsers.find(u => u.mobile === body.mobile);
    if (existingUser) {
      return sendJSON(res, { success: false, error: 'This mobile number is already registered. Please login.' }, 409);
    }
    const user = {
      userId: 'USR-' + Date.now(),
      name: body.name,
      mobile: body.mobile,
      email: body.email || '',
      password: body.password,
      emiratesId: body.emiratesId || '',
      emiratesIdFront: body.emiratesIdFront || '',
      emiratesIdBack: body.emiratesIdBack || '',
      nationality: body.nationality || '',
      dob: body.dob || '',
      gender: body.gender || '',
      registeredAt: new Date().toISOString()
    };
    db.appUsers.push(user);
    if (!db.patients) db.patients = [];
    const existingPatient = db.patients.find(p => p.mobile === body.mobile);
    if (!existingPatient) {
      const nameParts = body.name.trim().split(/\s+/);
      db.patients.push({
        mrNo: String(db.nextIds.patient++),
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        mobile: body.mobile,
        email: body.email || '',
        gender: body.gender || '',
        dob: body.dob || '',
        nationality: body.nationality || '',
        eid: body.emiratesId || '',
        regDate: formatDate(new Date()),
        status: 'Active',
        category: 'General',
        source: 'CustomerApp'
      });
    }
    saveDatabase();
    const safeUser = { userId: user.userId, name: user.name, mobile: user.mobile, email: user.email, emiratesId: user.emiratesId };
    return sendJSON(res, { success: true, message: 'Registration successful!', data: safeUser });
  }

  if (url === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.mobile || !body.password) {
      return sendJSON(res, { success: false, error: 'Mobile and password are required' }, 400);
    }
    if (!db.appUsers) db.appUsers = [];
    // Normalize mobile - strip spaces, +, leading 0, country code
    const normMobile = body.mobile.replace(/[\s\-\+]/g, '').replace(/^00/, '').replace(/^971/, '');
    const user = db.appUsers.find(u => {
      const uMobile = u.mobile.replace(/[\s\-\+]/g, '').replace(/^00/, '').replace(/^971/, '');
      return (uMobile === normMobile || u.mobile === body.mobile) && u.password === body.password;
    });
    if (!user) {
      return sendJSON(res, { success: false, error: 'Invalid mobile number or password. Check your credentials.' }, 401);
    }
    const safeUser = { userId: user.userId, name: user.name, mobile: user.mobile, email: user.email, emiratesId: user.emiratesId, nationality: user.nationality, dob: user.dob, gender: user.gender };
    return sendJSON(res, { success: true, message: 'Login successful!', data: safeUser });
  }

  if (url === '/api/auth/update-profile' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.mobile) return sendJSON(res, { success: false, error: 'mobile required' }, 400);
    if (!db.appUsers) db.appUsers = [];
    const user = db.appUsers.find(u => u.mobile === body.mobile);
    if (!user) return sendJSON(res, { success: false, error: 'User not found' }, 404);
    if (body.name) user.name = body.name;
    if (body.email) user.email = body.email;
    if (body.emiratesId) user.emiratesId = body.emiratesId;
    if (body.emiratesIdFront) user.emiratesIdFront = body.emiratesIdFront;
    if (body.emiratesIdBack) user.emiratesIdBack = body.emiratesIdBack;
    if (body.nationality) user.nationality = body.nationality;
    if (body.dob) user.dob = body.dob;
    if (body.gender) user.gender = body.gender;
    const patient = (db.patients || []).find(p => p.mobile === body.mobile);
    if (patient) {
      if (body.emiratesId) patient.eid = body.emiratesId;
      if (body.nationality) patient.nationality = body.nationality;
      if (body.dob) patient.dob = body.dob;
      if (body.gender) patient.gender = body.gender;
      if (body.name) { const np = body.name.trim().split(/\s+/); patient.firstName = np[0]; patient.lastName = np.slice(1).join(' '); }
    }
    saveDatabase();
    return sendJSON(res, { success: true, message: 'Profile updated' });
  }

  // ── Sign page (link-based signing) ──
  if (url.startsWith('/sign') && method === 'GET') {
    const signPage = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Digital Signature</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;padding:20px}
h2{color:#1b5e20;margin-bottom:10px;font-size:18px}
p{color:#666;margin-bottom:15px;font-size:13px;text-align:center}
canvas{border:2px solid #43a047;border-radius:8px;background:#fff;touch-action:none;cursor:crosshair}
.btns{margin-top:12px;display:flex;gap:10px}
button{padding:10px 24px;font-size:14px;font-weight:bold;border:none;border-radius:4px;cursor:pointer}
.clear{background:#eee;color:#333}
.submit{background:#43a047;color:#fff}
.submit:hover{background:#2e7d32}
.msg{margin-top:12px;font-size:14px;font-weight:bold;color:#1b5e20;display:none}
</style></head><body>
<h2>&#9998; Digital Signature</h2>
<p>Draw your signature below using your finger, stylus, or mouse</p>
<canvas id="pad" width="500" height="200"></canvas>
<div class="btns">
<button class="clear" onclick="clearPad()">Clear</button>
<button class="submit" onclick="submitSig()">Submit Signature</button>
</div>
<div class="msg" id="msg">&#10004; Signature saved successfully!</div>
<script>
var canvas=document.getElementById("pad"),ctx=canvas.getContext("2d"),drawing=false;
function getPos(e){var r=canvas.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}
canvas.addEventListener("mousedown",function(e){drawing=true;ctx.beginPath();var p=getPos(e);ctx.moveTo(p.x,p.y)});
canvas.addEventListener("mousemove",function(e){if(!drawing)return;ctx.lineWidth=2.5;ctx.lineCap="round";ctx.strokeStyle="#000";var p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
canvas.addEventListener("mouseup",function(){drawing=false});
canvas.addEventListener("touchstart",function(e){e.preventDefault();drawing=true;ctx.beginPath();var p=getPos(e);ctx.moveTo(p.x,p.y)});
canvas.addEventListener("touchmove",function(e){e.preventDefault();if(!drawing)return;ctx.lineWidth=2.5;ctx.lineCap="round";ctx.strokeStyle="#000";var p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
canvas.addEventListener("touchend",function(){drawing=false});
function clearPad(){ctx.clearRect(0,0,canvas.width,canvas.height)}
function submitSig(){
  var data=canvas.toDataURL("image/png");
  var params=new URLSearchParams(window.location.search);
  var type=params.get("type")||"doctor";
  fetch("/api/signatures",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:type,data:data})})
  .then(function(r){return r.json()})
  .then(function(d){document.getElementById("msg").style.display="block"})
  .catch(function(e){alert("Error saving: "+e.message)});
}
</script></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(signPage);
    return;
  }

  sendJSON(res, { error: 'Not found' }, 404);
}

// ─── HTTP Server ─────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    return handleAPI(req, res);
  }

  // Sign page (link-based signing)
  if (req.url.startsWith('/sign')) {
    return handleAPI(req, res);
  }

  // Customer Booking App
  if (req.url === '/book' || req.url === '/book/' || req.url.startsWith('/book?')) {
    serveFile(res, path.join(__dirname, 'customer-app.html'));
    return;
  }
  // PWA manifest and service worker for customer app
  if (req.url === '/manifest.json') {
    serveFile(res, path.join(__dirname, 'manifest.json'));
    return;
  }
  if (req.url === '/sw.js') {
    serveFile(res, path.join(__dirname, 'sw.js'));
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/insurance-only.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, filePath);
  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║         CLINIC EMR SERVER RUNNING                ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║                                                  ║');
  console.log(`  ║  This PC:    http://localhost:${PORT}              ║`);
  console.log(`  ║  Network:    http://${localIP}:${PORT}        ║`);
  console.log('  ║                                                  ║');
  console.log(`  ║  Data file:  ${DATA_FILE}`);
  console.log('  ║                                                  ║');
  console.log('  ║  Other PCs/phones on same WiFi can access        ║');
  console.log(`  ║  using: http://${localIP}:${PORT}             ║`);
  console.log('  ║                                                  ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
