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
