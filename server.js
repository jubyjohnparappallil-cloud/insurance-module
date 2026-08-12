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

// Prevent server from crashing on unhandled errors
process.on('uncaughtException', (err) => { console.error('Uncaught:', err.message); });
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err && err.message ? err.message : err); });

// ── Branch Mode ───────────────────────────────────────────────────
// Run as Medical Center:  node server.js
// Run as Wellness:        node server.js --wellness
// Run as User Management: node server.js --usermgmt
const IS_WELLNESS = process.argv.includes('--wellness');
const IS_USERMGMT = process.argv.includes('--usermgmt');
const PORT        = IS_USERMGMT ? 3002 : IS_WELLNESS ? 3001 : 3000;
const DATA_FILE   = IS_USERMGMT
  ? path.join(__dirname, 'usermgmt-data.json')
  : IS_WELLNESS
    ? path.join(__dirname, 'wellness-data.json')
    : path.join(__dirname, 'clinic-data.json');
const HTML_FILE   = IS_USERMGMT ? 'user-management.html' : IS_WELLNESS ? 'clinic-emr.html' : 'insurance-only.html';

console.log('══════════════════════════════════════════════════');
if (IS_USERMGMT) {
  console.log('👤  Mode   : User Management System');
  console.log('📁  DB     : usermgmt-data.json');
} else if (IS_WELLNESS) {
  console.log('🌿  Branch : Shanthi Wellness Ayurvedic LLC');
  console.log('📁  DB     : wellness-data.json');
} else {
  console.log('🏥  Branch : Insurance System');
  console.log('📁  DB     : clinic-data.json');
}
console.log('🌐  Port   :', PORT);
console.log('══════════════════════════════════════════════════');

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
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
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
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({ host:'localhost', port:3306, user:'root', password:'null', database:'shanthiayur_new', connectionLimit:3 });
      const [rows] = await pool.execute(
        `SELECT Pat_DocNo, Pat_MRNO, Pat_FirstName, Pat_MiddleName, Pat_Lastname, Pat_Gender, Pat_Dob,
                Pat_Mobile, Pat_Email, Pat_EmiratesIdNo, Pat_Address, Pat_City,
                Pat_NationalityISOCode, Pat_CtryDocNo, Pat_Company, Pat_CreatedTime, Pat_Referal
         FROM patients
         WHERE Pat_isDeleted = 0 OR Pat_isDeleted IS NULL
         ORDER BY Pat_CreatedTime DESC`
      );
      await pool.end();
      const data = rows.map(r => ({
        mrNo: r.Pat_MRNO || r.Pat_DocNo,
        firstName: r.Pat_FirstName || '',
        middleName: r.Pat_MiddleName || '',
        lastName: r.Pat_Lastname || '',
        gender: r.Pat_Gender || '',
        dob: r.Pat_Dob ? new Date(r.Pat_Dob).toISOString().split('T')[0] : '',
        mobile: r.Pat_Mobile || '',
        email: r.Pat_Email || '',
        eid: r.Pat_EmiratesIdNo || '',
        nationality: r.Pat_NationalityISOCode || r.Pat_CtryDocNo || '',
        address: r.Pat_Address || '',
        city: r.Pat_City || '',
        company: r.Pat_Company || '',
        referral: r.Pat_Referal || '',
        regDate: r.Pat_CreatedTime ? new Date(r.Pat_CreatedTime).toLocaleDateString('en-GB') : ''
      }));
      return sendJSON(res, { success: true, data });
    } catch(e) {
      console.log('MySQL patients error:', e.message);
      return sendJSON(res, { success: true, data: db.patients || [] });
    }
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
    // Return user-saved claims + imported insurance claims
    const userClaims = (db.claims || []).filter(c => c.savedByUser === true);
    const importedClaims = (db.insuranceClaims || []).map(c => ({
      claimId: c.claimId,
      fromDate: c.startDate,
      toDate: c.endDate,
      mrNo: c.mrNo,
      patientName: (db.patients || []).find(p => p.mrNo === c.mrNo)?.firstName || c.mrNo,
      amount: c.amount,
      receivedAmount: c.receivedAmount || '0.00',
      notes: c.notes || '',
      savedByUser: true
    }));
    return sendJSON(res, { success: true, data: [...userClaims, ...importedClaims] });
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
    const claimId = decodeURIComponent(url.split('/')[3]);
    let claim = db.claims.find(c => c.claimId === claimId);
    
    // Check imported insurance claims if not found in regular claims
    if (!claim) {
      const insClaim = (db.insuranceClaims || []).find(c => c.claimId === claimId);
      if (insClaim) {
        const patient = (db.patients || []).find(p => p.mrNo === insClaim.mrNo);
        claim = { claimId: insClaim.claimId, mrNo: insClaim.mrNo, patientName: patient ? (patient.firstName + ' ' + patient.lastName).trim() : insClaim.mrNo, fromDate: insClaim.startDate, toDate: insClaim.endDate, amount: insClaim.amount };
        // Build logsheet entries from claim details
        const details = (db.insuranceClaimDetails || []).filter(d => d.claimId === claimId);
        const entries = details.map((d, i) => ({ claimId, slNo: i+1, entryDate: d.treatDate || insClaim.startDate, treatmentDone: d.description, inTime: d.inTime || '', outTime: d.outTime || '', progress: d.progress || '' }));
        const procedures = details.map(d => ({ description: d.description, price: d.amount, sessions: d.quantity || '1', amount: d.totalAmount || d.amount }));
        return sendJSON(res, { success: true, data: { claim, entries, procedures, prescriptions: [] } });
      }
      return sendJSON(res, { success: false, error: 'Claim not found' }, 404);
    }
    
    const entries = (db.logsheetEntries || []).filter(e => e.claimId === claimId).sort((a, b) => a.slNo - b.slNo);
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
    // Try MySQL first
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({ host:'localhost', port:3306, user:'root', password:'null', database:'shanthiayur_new', connectionLimit:3 });
      // Get employee names for mapping
      const [emps] = await pool.execute('SELECT dctr_DocNo, dctr_DoctorName, dctr_Description FROM dctr_doctor WHERE dctr_isDeleted=0 OR dctr_isDeleted IS NULL');
      const empMap = {};
      emps.forEach(e => { empMap[e.dctr_DocNo] = e.dctr_DoctorName; });
      
      const [rows] = await pool.execute(
        `SELECT app_DocNo, app_Start, app_End, app_PatName, app_PatMob, app_Notes,
                app_PatDocNo, app_dctrDocNo, app_TherapistDocNo, app_Therapist2DocNo,
                app_Room_DocNo, app_Purpose, app_AppointmentStatus
         FROM appointment
         WHERE (app_isDeleted = 0 OR app_isDeleted IS NULL)
         ORDER BY app_Start DESC
         LIMIT 8000`
      );
      await pool.end();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const statusMap = {0:'Scheduled',1:'Confirmed',12:'Scheduled',16:'Arrived',25:'Arrived',50:'Consulted',75:'Billed',100:'Cancelled'};
      const data = rows.map(a => {
        const startDt = a.app_Start ? new Date(a.app_Start) : null;
        let df = '', tf = '';
        if (startDt && !isNaN(startDt)) {
          df = String(startDt.getDate()).padStart(2,'0') + '/' + months[startDt.getMonth()] + '/' + startDt.getFullYear();
          let hr = startDt.getHours(); const min = String(startDt.getMinutes()).padStart(2,'0');
          const ampm = hr >= 12 ? 'PM' : 'AM';
          hr = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
          tf = hr + ':' + min + ' ' + ampm;
        }
        const doctor = empMap[a.app_dctrDocNo] || '';
        const therapist = empMap[a.app_TherapistDocNo] || '';
        const therapist2 = empMap[a.app_Therapist2DocNo] || '';
        return {
          id: a.app_DocNo || '', date: df, time: tf,
          patient: a.app_PatName || '', mobile: a.app_PatMob || '',
          mrNo: a.app_PatDocNo || '',
          doctor: doctor, therapist: therapist, therapist2: therapist2,
          room: a.app_Room_DocNo || '', 
          status: statusMap[a.app_AppointmentStatus] || 'Scheduled',
          notes: a.app_Notes || '', purpose: a.app_Purpose || '',
          consultDoctor: doctor || therapist
        };
      });
      return sendJSON(res, { success: true, data });
    } catch(e) {
      console.log('MySQL appointments error:', e.message);
    }
    // Fallback to file/JSON
    return sendJSON(res, { success: true, data: db.appointments || [] });
  }

  // ── Insurance-specific Appointments (separate from User Management) ──
  if (url === '/api/insurance-appointments' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.insuranceAppointments || [] });
  }
  if (url === '/api/insurance-appointments' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.insuranceAppointments) db.insuranceAppointments = [];
    if (body._delete) {
      db.insuranceAppointments = db.insuranceAppointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
    } else {
      // Remove existing at same slot
      db.insuranceAppointments = db.insuranceAppointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
      db.insuranceAppointments.push(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
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

  // ── Employees ──
  if (url === '/api/employees' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.employees || [] });
  }
  if (url === '/api/employees' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.employees) db.employees = [];
    if (!db.nextIds) db.nextIds = {};
    if (!db.nextIds.employee) db.nextIds.employee = 74;
    const existing = db.employees.find(e => e.empCode === body.empCode);
    if (existing) {
      Object.assign(existing, body);
    } else {
      if (!body.empCode) body.empCode = 'EM' + String(db.nextIds.employee++).padStart(4, '0');
      db.employees.push(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/employees/') && method === 'DELETE') {
    const empCode = decodeURIComponent(url.split('/')[3]);
    if (!db.employees) db.employees = [];
    db.employees = db.employees.filter(e => e.empCode !== empCode);
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

  // ── GlassReader HTTP GET ──
  if (url.startsWith('/api/glassreader/person') && method === 'GET') {
    const { fetchGlassReaderPersonData, mapCardholderRecord } = require('./eid-reader');
    const { spawn } = require('child_process');
    const glassPath = path.join(__dirname, 'clinic', 'GlassReader', 'bin', 'GlassReader.exe');
    
    // Check if GlassReader is already running and has data
    let existingData = null;
    try {
      const check = await fetchGlassReaderPersonData({ baseUrl: 'http://127.0.0.1:7208', timeoutMs: 2000 });
      if (check && check.success) existingData = check.data;
    } catch (e) { /* not running */ }

    // Use PCSC to detect current card UID (tells us if card changed)
    let currentCardUid = null;
    try {
      const { readCardOnce } = require('./eid-reader');
      const cardCheck = await readCardOnce({ timeoutMs: 3000 });
      if (cardCheck && cardCheck.success && cardCheck.data) {
        currentCardUid = cardCheck.data.uid || null;
      }
    } catch (e) { /* no card or reader error */ }

    // If GlassReader is running with data and NOT a refresh request, return cached
    if (existingData && existingData.emiratesId) {
      const forceRefresh = url.includes('refresh=1') || url.includes('force=1');
      if (!forceRefresh) {
        return sendJSON(res, { success: true, data: existingData, source: 'glassreader' });
      }
    }

    // New card read requested — restart GlassReader to read current card on reader

    // Different card or no data — restart GlassReader to read fresh
    spawn('taskkill', ['/F', '/IM', 'GlassReader.exe'], { stdio: 'ignore', detached: true }).unref();
    await new Promise(r => setTimeout(r, 1500));
    
    if (fs.existsSync(glassPath)) {
      spawn(glassPath, [], { stdio: 'ignore', detached: true, windowsHide: true, cwd: path.dirname(glassPath) }).unref();
    }

    // Wait for GlassReader to start and read card
    await new Promise(r => setTimeout(r, 6000));

    // Fetch fresh data with retries
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await fetchGlassReaderPersonData({ baseUrl: 'http://127.0.0.1:7208', timeoutMs: 4000 });
        if (result && result.success) {
          return sendJSON(res, { success: true, data: result.data, source: 'glassreader' });
        }
      } catch (e) { /* retry */ }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }

    // Fetch card data with retries
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await fetchGlassReaderPersonData({ baseUrl: 'http://127.0.0.1:7208', timeoutMs: 4000 });
        if (result && result.success) {
          return sendJSON(res, { success: true, data: result.data, source: 'glassreader' });
        }
      } catch (e) { /* retry */ }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }

    // Try fetching data with retries (GlassReader may need extra time)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await fetchGlassReaderPersonData({ baseUrl: 'http://127.0.0.1:7208', timeoutMs: 5000 });
        if (result && result.success) {
          return sendJSON(res, { success: true, data: result.data, source: 'glassreader' });
        }
      } catch (e) { /* GlassReader not responding yet */ }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }

    // Fallback - read from MySQL cardholder table (last known card)
    try {
      const mysql2 = require('mysql2/promise');
      const conn = await mysql2.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'clinic_emr', connectTimeout: 3000 });
      const [rows] = await conn.execute(
        'SELECT idNumber, firstNameEnglish, middleNameEnglish, lastNameEnglish, dateOfBirth, gender, nationalityEnglish, expiryDate FROM cardholder ORDER BY idCardHolder DESC LIMIT 1'
      );
      await conn.end();
      if (rows.length > 0) {
        const mapped = mapCardholderRecord(rows[0]);
        if (mapped && (mapped.emiratesId || mapped.firstName)) {
          mapped.message = 'Card data loaded from database.';
          return sendJSON(res, { success: true, data: mapped, source: 'database' });
        }
      }
    } catch (dbErr) {
      console.log('MySQL cardholder read error:', dbErr.code || dbErr.message);
    }

    return sendJSON(res, { 
      success: false, 
      error: 'No card data available. Place the Emirates ID card on the reader and try again.' 
    });
  }

  // ── Read card by Emirates ID from MySQL cardholder table ──
  if (url.startsWith('/api/cardholder/') && method === 'GET') {
    const eidParam = decodeURIComponent(url.split('/')[3]).replace(/[-\s]/g, '');
    const { mapCardholderRecord } = require('./eid-reader');
    try {
      const mysql2 = require('mysql2/promise');
      const conn = await mysql2.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'clinic_emr', connectTimeout: 3000 });
      const [rows] = await conn.execute(
        'SELECT idNumber, firstNameEnglish, middleNameEnglish, lastNameEnglish, dateOfBirth, gender, nationalityEnglish, expiryDate FROM cardholder WHERE REPLACE(idNumber, "-", "") = ? ORDER BY idCardHolder DESC LIMIT 1',
        [eidParam]
      );
      await conn.end();
      if (rows.length > 0) {
        const mapped = mapCardholderRecord(rows[0]);
        if (mapped) {
          mapped.message = 'Card data found in database.';
          return sendJSON(res, { success: true, data: mapped });
        }
      }
      return sendJSON(res, { success: false, error: 'No card data found for this Emirates ID.' });
    } catch (dbErr) {
      return sendJSON(res, { success: false, error: 'Database error: ' + (dbErr.code || dbErr.message) });
    }
  }

  // ── Search patient by Emirates ID (from local JSON db) ──
  if (url.startsWith('/api/patient-by-eid/') && method === 'GET') {
    const eidParam = decodeURIComponent(url.split('/').slice(3).join('/')).replace(/[-\s]/g, '');
    const patient = (db.patients || []).find(p => {
      const pEid = (p.eid || p.emiratesId || '').replace(/[-\s]/g, '');
      return pEid && pEid === eidParam;
    });
    if (patient) {
      return sendJSON(res, { success: true, data: patient, source: 'local' });
    }
    return sendJSON(res, { success: false, error: 'Patient not found' });
  }

  // ── List all cards in MySQL cardholder table ──
  if (url === '/api/cardholders' && method === 'GET') {
    const { mapCardholderRecord } = require('./eid-reader');
    try {
      const mysql2 = require('mysql2/promise');
      const conn = await mysql2.createConnection({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'clinic_emr', connectTimeout: 3000 });
      const [rows] = await conn.execute(
        'SELECT idNumber, firstNameEnglish, middleNameEnglish, lastNameEnglish, dateOfBirth, gender, nationalityEnglish, expiryDate, cardReadDate FROM cardholder ORDER BY idCardHolder DESC LIMIT 50'
      );
      await conn.end();
      const cards = rows.map(r => mapCardholderRecord(r)).filter(Boolean);
      return sendJSON(res, { success: true, data: cards });
    } catch (dbErr) {
      return sendJSON(res, { success: false, error: 'Database error: ' + (dbErr.code || dbErr.message) });
    }
  }

  // ── Read Emirates ID Card (ICA Toolkit WebSocket on port 9004) ──
  if (url === '/api/read-eid' && method === 'GET') {
    const WebSocket = require('ws');
    const fs2 = require('fs');
    
    // Check if toolkit service is installed and license status
    let toolkitInstalled = false;
    let licenseExpired = false;
    let licenseExpiry = '';
    try {
      const logDir = 'C:\\Program Files\\ICAToolkitService';
      if (fs2.existsSync(logDir)) {
        toolkitInstalled = true;
        // Check latest log for license info
        const files = fs2.readdirSync(logDir).filter(f => f.startsWith('EIDAToolkit_') && f.endsWith('.log'));
        if (files.length > 0) {
          const latestLog = fs2.readFileSync(path.join(logDir, files[files.length - 1]), 'utf8');
          const expiryMatch = latestLog.match(/License expiry date \["([^"]+)"\]/);
          if (expiryMatch) {
            licenseExpiry = expiryMatch[1];
            const expDate = new Date(licenseExpiry);
            if (expDate < new Date()) licenseExpired = true;
          }
        }
      }
    } catch(e) {}

    if (!toolkitInstalled) {
      return sendJSON(res, { success: false, error: 'ICA Toolkit not installed. Install Emirates ID Card Toolkit Service to enable auto card reading.' });
    }

    if (licenseExpired) {
      return sendJSON(res, { success: false, error: 'ICA Toolkit license EXPIRED (' + licenseExpiry + '). Contact ICA at 600-522222 to renew the toolkit license for auto card reading.' });
    }

    // Connect to toolkit WebSocket
    let responded = false;
    let ws;
    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        try { ws.close(); } catch(e) {}
        sendJSON(res, { success: false, error: 'ICA Toolkit not responding. Service is running but license may need renewal. Expiry: ' + (licenseExpiry || 'unknown') });
      }
    }, 10000);

    try {
      ws = new WebSocket('ws://127.0.0.1:9004');
      
      ws.on('open', () => {
        // Send ReadPublicData command
        ws.send(JSON.stringify({ cmd: 'ReadPublicData' }));
        ws.send(JSON.stringify({ command: 'ReadPublicData', params: {} }));
        ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'ReadPublicData', id: 1 }));
      });

      ws.on('message', (data) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeout);
        try { ws.close(); } catch(e) {}
        
        let parsed = null;
        try {
          const obj = JSON.parse(data.toString());
          const d = obj.ReadPublicDataResponse || obj.PublicData || obj.data || obj;
          parsed = {};
          
          // Map fields
          const fields = ['IDNumber','IdNumber','idn','CardNumber','emiratesId'];
          for (const f of fields) { if (d[f]) { parsed.emiratesId = d[f]; break; } }
          
          if (d.FullNameEnglish || d.FullName || d.fullNameEn) {
            const name = (d.FullNameEnglish || d.FullName || d.fullNameEn).trim().split(/\s+/);
            parsed.firstName = name[0];
            parsed.lastName = name.length > 1 ? name.slice(1).join(' ') : '';
          }
          if (d.FirstNameEn || d.GivenName) parsed.firstName = d.FirstNameEn || d.GivenName;
          if (d.LastNameEn || d.Surname) parsed.lastName = d.LastNameEn || d.Surname;
          if (d.DateOfBirth || d.BirthDate || d.dob) parsed.dob = d.DateOfBirth || d.BirthDate || d.dob;
          if (d.Gender || d.Sex) {
            const g = (d.Gender || d.Sex).toString().toUpperCase();
            parsed.gender = (g === 'M' || g === 'MALE') ? 'Male' : 'Female';
          }
          if (d.Nationality || d.NationalityEn) parsed.nationality = d.Nationality || d.NationalityEn;
          if (d.ExpiryDate || d.CardExpiryDate) parsed.eidExpiry = d.ExpiryDate || d.CardExpiryDate;
          if (d.Photo || d.CardHolderPhoto) parsed.photoDataUrl = 'data:image/jpeg;base64,' + (d.Photo || d.CardHolderPhoto);
          
          // Format ID
          if (parsed.emiratesId && !parsed.emiratesId.includes('-')) {
            const id = parsed.emiratesId.replace(/\D/g, '');
            if (id.length === 15) parsed.emiratesId = id.substring(0,3) + '-' + id.substring(3,7) + '-' + id.substring(7,14) + '-' + id.substring(14);
          }
        } catch(e) {
          parsed = null;
        }
        
        if (parsed && (parsed.emiratesId || parsed.firstName)) {
          sendJSON(res, { success: true, data: parsed });
        } else {
          sendJSON(res, { success: true, data: JSON.parse(data.toString()) });
        }
      });

      ws.on('error', (e) => {
        if (!responded) {
          responded = true;
          clearTimeout(timeout);
          sendJSON(res, { success: false, error: 'Cannot connect to ICA Toolkit on port 9004. Make sure the service is running. (' + e.message + ')' });
        }
      });

      ws.on('close', () => {
        if (!responded) {
          responded = true;
          clearTimeout(timeout);
          sendJSON(res, { success: false, error: 'ICA Toolkit closed connection. Toolkit license may be expired (' + (licenseExpiry || 'unknown') + '). Contact ICA at 600-522222 to renew.' });
        }
      });
    } catch(e) {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        sendJSON(res, { success: false, error: 'Error connecting to toolkit: ' + e.message });
      }
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

  // ── Diagnosis Master (ICD Codes) ──
  if (url === '/api/diagnosis-master' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.diagnosisMaster || [] });
  }

  // ── Procedures Master ──
  if (url === '/api/procedures-master' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.proceduresMaster || [] });
  }

  // ── Rooms ──
  if (url === '/api/rooms' && method === 'GET') {
    const rooms = db.rooms || [
      {code:'00000043',name:'CONSULTATION ROOM',description:'CONSULTATION ROOM'},
      {code:'00000044',name:'ROOM NUMBER 1',description:'ROOM NUMBER 1'},
      {code:'00000045',name:'HOMEO ROOM',description:'HOMEO ROOM'},
      {code:'00000046',name:'ROOM NUMBER 2',description:'ROOM NUMBER 2'},
      {code:'00000047',name:'ROOM NUMBER 3',description:'ROOM NUMBER 3'},
      {code:'00000048',name:'ROOM NUMBER 4',description:'ROOM NUMBER 4'},
      {code:'00000049',name:'PHYSIO ROOM',description:'PHYSIO ROOM'}
    ];
    return sendJSON(res, { success: true, data: rooms });
  }
  if (url === '/api/rooms' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.rooms) db.rooms = [
      {code:'00000043',name:'CONSULTATION ROOM',description:'CONSULTATION ROOM'},
      {code:'00000044',name:'ROOM NUMBER 1',description:'ROOM NUMBER 1'},
      {code:'00000045',name:'HOMEO ROOM',description:'HOMEO ROOM'},
      {code:'00000046',name:'ROOM NUMBER 2',description:'ROOM NUMBER 2'},
      {code:'00000047',name:'ROOM NUMBER 3',description:'ROOM NUMBER 3'},
      {code:'00000048',name:'ROOM NUMBER 4',description:'ROOM NUMBER 4'},
      {code:'00000049',name:'PHYSIO ROOM',description:'PHYSIO ROOM'}
    ];
    const existing = db.rooms.find(r => r.code === body.code);
    if (existing) { Object.assign(existing, body); }
    else { body.code = String(db.rooms.length + 1).padStart(8, '0'); db.rooms.push(body); }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }
  if (url.startsWith('/api/rooms/') && method === 'DELETE') {
    const code = decodeURIComponent(url.split('/')[3]);
    if (!db.rooms) db.rooms = [];
    db.rooms = db.rooms.filter(r => r.code !== code);
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // ── Invoices ──
  if (url === '/api/invoices' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.invoices || [] });
  }
  if (url === '/api/invoices' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.invoices) db.invoices = [];
    if (body.invoiceNo) {
      // Check for duplicate - if exists and it's a new save (not edit), generate new number
      const existing = db.invoices.find(i => i.invoiceNo === body.invoiceNo);
      if (existing && !body._isEdit) {
        // Generate next available number
        let maxNo = 0;
        db.invoices.forEach(i => { const n = parseInt(String(i.invoiceNo).replace(/\D/g, '')) || 0; if (n > maxNo) maxNo = n; });
        body.invoiceNo = 'I' + (maxNo + 1);
      }
      // Update existing or add new
      const idx = db.invoices.findIndex(i => i.invoiceNo === body.invoiceNo);
      if (idx >= 0) { Object.assign(db.invoices[idx], body); }
      else { db.invoices.unshift(body); }
      saveDatabase();
      return sendJSON(res, { success: true, data: body });
    }
    return sendJSON(res, { success: false, error: 'invoiceNo required' }, 400);
  }

  // ── Attendance ──
  if (url === '/api/attendance' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.attendance) db.attendance = {};
    if (body.date && body.data) {
      db.attendance[body.date] = body.data;
      saveDatabase();
    }
    return sendJSON(res, { success: true });
  }
  if (url === '/api/attendance' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.attendance || {} });
  }

  // ── Staff Self-Service Attendance ──
  if (url === '/api/staff-attendance' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.staffAttendance) db.staffAttendance = {};
    const key = body.empCode + '_' + body.date;
    if (!db.staffAttendance[key]) db.staffAttendance[key] = { empCode: body.empCode, date: body.date };
    if (body.clockIn) db.staffAttendance[key].clockIn = body.clockIn;
    if (body.clockOut) db.staffAttendance[key].clockOut = body.clockOut;
    if (body.status) db.staffAttendance[key].status = body.status;
    // Also update main attendance
    if (!db.attendance) db.attendance = {};
    if (!db.attendance[body.date]) db.attendance[body.date] = {};
    if (!db.attendance[body.date][body.empCode]) db.attendance[body.date][body.empCode] = {};
    if (body.clockIn) { db.attendance[body.date][body.empCode].inTime = body.clockIn; db.attendance[body.date][body.empCode].status = 'Present'; }
    if (body.clockOut) db.attendance[body.date][body.empCode].outTime = body.clockOut;
    saveDatabase();
    console.log('📋 Staff attendance:', body.empCode, body.date, body.clockIn || body.clockOut);
    return sendJSON(res, { success: true });
  }

  // ── Staff Leave Application ──
  if (url === '/api/staff-leave' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.staffLeaves) db.staffLeaves = [];
    db.staffLeaves.push({ ...body, status: 'Pending', appliedAt: new Date().toISOString() });
    saveDatabase();
    console.log('✈️ Leave applied:', body.empName, body.fromDate, '-', body.toDate);
    return sendJSON(res, { success: true });
  }

  // ── Patient Feedback ──
  if (url === '/api/feedback' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.feedbacks) db.feedbacks = [];
    body.id = db.feedbacks.length + 1;
    body.timestamp = new Date().toISOString();
    db.feedbacks.push(body);
    saveDatabase();

    const rating = body.overall || 0;
    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    console.log('⭐ Feedback received:', rating + '/5', body.name || 'Anonymous', rating <= 2 ? '⚠️ NEEDS ATTENTION' : '');

    // Auto-send email to admin with feedback details
    try {
      const googleReviewLink = 'https://g.page/r/shanthi-wellness/review';
      const feedbackHtml = `
        <div style="font-family:Arial;max-width:500px;margin:0 auto;border:2px solid ${rating>=4?'#4caf50':rating<=2?'#f44336':'#ff9800'};border-radius:12px;overflow:hidden">
          <div style="background:${rating>=4?'#4caf50':rating<=2?'#f44336':'#ff9800'};color:#fff;padding:14px 20px;text-align:center">
            <h2 style="margin:0;font-size:18px">${rating>=4?'😊 Positive':'🚨 Negative'} Patient Feedback</h2>
          </div>
          <div style="padding:20px">
            <p><b>Rating:</b> ${stars} (${rating}/5)</p>
            <p><b>Smiley:</b> ${body.smiley}/5 | <b>Stars:</b> ${body.stars}/5</p>
            <p><b>Patient:</b> ${body.name || 'Anonymous'}</p>
            <p><b>Phone:</b> ${body.phone || 'Not provided'}</p>
            <p><b>Email:</b> ${body.email || 'Not provided'}</p>
            <p><b>Comment:</b> ${body.comment || 'No comment'}</p>
            <p><b>Date:</b> ${new Date().toLocaleString()}</p>
            <hr style="margin:14px 0;border:none;border-top:1px solid #ddd">
            <p><b>📍 Google Review Link:</b></p>
            <p><a href="${googleReviewLink}" style="color:#1565c0;font-size:14px;font-weight:700">${googleReviewLink}</a></p>
            ${rating<=2 ? '<p style="color:#c62828;font-weight:700;font-size:16px">⚠️ ACTION REQUIRED: Please call this patient!</p>' : ''}
            ${rating>=4 ? '<p style="color:#2e7d32;font-weight:700">✅ Good review - Patient email sent with Google Review link</p>' : ''}
          </div>
        </div>`;

      // Send to admin
      emailTransporter.sendMail({
        from: EMAIL_CONFIG.clinicName + ' <' + EMAIL_CONFIG.fromEmail + '>',
        to: EMAIL_CONFIG.fromEmail,
        subject: (rating>=4?'✅':'🚨') + ' Patient Feedback: ' + (rating) + '/5 stars - ' + (body.name||'Anonymous'),
        html: feedbackHtml
      }).then(() => console.log('📧 Feedback email sent to admin'))
        .catch(e => console.log('Email error:', e.message));

      // If good feedback AND patient gave email, send them Google Review link
      if (rating >= 4 && body.email) {
        const patientHtml = `
          <div style="font-family:Arial;max-width:500px;margin:0 auto;border:2px solid #4caf50;border-radius:12px;overflow:hidden">
            <div style="background:#4caf50;color:#fff;padding:16px 20px;text-align:center">
              <h2 style="margin:0;font-size:18px">🌿 Thank You, ${body.name || 'Dear Patient'}!</h2>
            </div>
            <div style="padding:24px;text-align:center">
              <p style="font-size:16px;color:#333;margin-bottom:16px">We're so glad you had a wonderful experience at <b>Shanthi Wellness</b>!</p>
              <p style="font-size:14px;color:#555;margin-bottom:24px">Would you mind sharing your experience on Google? It helps other patients find us.</p>
              <a href="${googleReviewLink}" style="display:inline-block;background:#4caf50;color:#fff;padding:14px 32px;border-radius:30px;text-decoration:none;font-size:16px;font-weight:700;box-shadow:0 4px 15px rgba(76,175,80,0.3)">⭐ Leave a Google Review</a>
              <p style="font-size:12px;color:#888;margin-top:20px">Thank you for choosing Shanthi Wellness Ayurvedic Medical Centre LLC<br>📞 +971 42 255 133</p>
            </div>
          </div>`;

        emailTransporter.sendMail({
          from: EMAIL_CONFIG.clinicName + ' <' + EMAIL_CONFIG.fromEmail + '>',
          to: body.email,
          subject: '⭐ Share Your Experience - Shanthi Wellness',
          html: patientHtml
        }).then(() => console.log('📧 Google Review link sent to patient:', body.email))
          .catch(e => console.log('Patient email error:', e.message));
      }
    } catch(e) { console.log('Feedback email error:', e.message); }

    // Auto-send WhatsApp message via WhatsApp API link (opens in admin's browser)
    if (rating <= 2 && body.phone) {
      console.log('🚨 BAD FEEDBACK - Call patient:', body.phone, body.name);
      console.log('   WhatsApp: https://wa.me/' + body.phone.replace(/[^0-9]/g,''));
    }

    return sendJSON(res, { success: true });
  }
  if (url === '/api/feedback' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.feedbacks || [] });
  }

  // ── Insurance Claim Details (for report generation) ──
  if (url.startsWith('/api/claim-details/') && method === 'GET') {
    const claimId = decodeURIComponent(url.split('/')[3]);
    const claim = (db.insuranceClaims || []).find(c => c.claimId === claimId);
    const details = (db.insuranceClaimDetails || []).filter(d => d.claimId === claimId);
    const patient = claim ? (db.patients || []).find(p => p.mrNo === claim.mrNo) : null;
    const consultation = claim ? (db.consultations || []).find(c => c.mrNo === claim.mrNo) : null;
    return sendJSON(res, { success: true, data: { claim, details, patient, consultation } });
  }

  // ── Marketing CRM APIs ──
  if (url === '/api/hr/docs' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.hrDocs || [] });
  }
  if (url === '/api/hr/docs' && method === 'POST') {
    const body = await parseBody(req); db.hrDocs = body.data || []; saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/hr/leaves' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.hrLeaves || [] });
  }
  if (url === '/api/hr/leaves' && method === 'POST') {
    const body = await parseBody(req); db.hrLeaves = body.data || []; saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/hr/offdays' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.hrOffDays || {} });
  }
  if (url === '/api/hr/offdays' && method === 'POST') {
    const body = await parseBody(req); db.hrOffDays = body.data || {}; saveDatabase();
    return sendJSON(res, { success: true });
  }

  if (url === '/api/marketing/leads' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.marketingLeads || [] });
  }
  if (url === '/api/marketing/leads' && method === 'POST') {
    const body = await parseBody(req);
    if (body.leads) db.marketingLeads = body.leads;
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/marketing/followups' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.marketingFollowups || [] });
  }
  if (url === '/api/marketing/followups' && method === 'POST') {
    const body = await parseBody(req);
    if (body.followups) db.marketingFollowups = body.followups;
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/marketing/team' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.marketingTeam || [{name:'Admin',phone:'',role:'Manager'}] });
  }
  if (url === '/api/marketing/team' && method === 'POST') {
    const body = await parseBody(req);
    if (body.team) db.marketingTeam = body.team;
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // ── Login & User Access Control ──
  if (url === '/api/login' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.users) {
      db.users = [
        {username:'admin',password:'admin123',name:'Administrator',role:'admin',permissions:['all']},
        {username:'lintu',password:'1234',name:'LINTU RAJAN',role:'doctor',permissions:['patients','appointments','consultation']},
        {username:'neethu',password:'1234',name:'NEETHU DEEPAK',role:'doctor',permissions:['patients','appointments','consultation']},
        {username:'shilpa',password:'1234',name:'SHILPA',role:'receptionist',permissions:['patients','appointments','receipts']},
        {username:'reception',password:'1234',name:'Reception',role:'receptionist',permissions:['patients','appointments','receipts']}
      ];
      saveDatabase();
    }
    const user = db.users.find(u => u.username === body.username && u.password === body.password);
    if (user) {
      const token = Date.now().toString(36) + Math.random().toString(36).substr(2);
      return sendJSON(res, { success:true, token, user:{username:user.username,name:user.name,role:user.role,permissions:user.permissions} });
    }
    return sendJSON(res, { success:false, error:'Invalid username or password' }, 401);
  }

  // ── User CRUD (admin only) ──
  if (url === '/api/users' && method === 'GET') {
    if (!db.users) db.users = [];
    const safeUsers = db.users.map(u => ({username:u.username,name:u.name,role:u.role,permissions:u.permissions}));
    return sendJSON(res, { success:true, data:safeUsers });
  }
  if (url === '/api/users' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.users) db.users = [];
    const existing = db.users.find(u => u.username === body.username);
    if (existing) {
      if (body.password) existing.password = body.password;
      if (body.name) existing.name = body.name;
      if (body.role) existing.role = body.role;
      if (body.permissions) existing.permissions = body.permissions;
    } else {
      db.users.push({username:body.username,password:body.password||'1234',name:body.name,role:body.role||'staff',permissions:body.permissions||[]});
    }
    saveDatabase();
    return sendJSON(res, { success:true });
  }
  if (url.startsWith('/api/users/') && method === 'DELETE') {
    const username = decodeURIComponent(url.split('/')[3]);
    if (!db.users) db.users = [];
    db.users = db.users.filter(u => u.username !== username);
    saveDatabase();
    return sendJSON(res, { success:true });
  }

  // ── User Management Appointments (separate from Insurance) ──
  if (url === '/api/um-appointments' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.umAppointments || [] });
  }
  if (url === '/api/um-appointments' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.umAppointments) db.umAppointments = [];
    if (body._delete) {
      db.umAppointments = db.umAppointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
    } else {
      db.umAppointments = db.umAppointments.filter(a => !(a.doctor === body.doctor && a.time === body.time && a.date === body.date));
      db.umAppointments.push(body);
    }
    saveDatabase();
    return sendJSON(res, { success: true, data: body });
  }

  // ── Shifts ──
  if (url === '/api/shifts' && method === 'POST') {
    const body = await parseBody(req);
    if (body.shifts) { db.shifts = body.shifts; saveDatabase(); }
    return sendJSON(res, { success: true });
  }
  if (url === '/api/shifts' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.shifts || [] });
  }
  if (url === '/api/shift-assignments' && method === 'POST') {
    const body = await parseBody(req);
    db.shiftAssignments = body;
    saveDatabase();
    return sendJSON(res, { success: true });
  }
  if (url === '/api/shift-assignments' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.shiftAssignments || {} });
  }

  // ── Packages (from MySQL) ──
  if (url === '/api/packages-db' && method === 'GET') {
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({ host:'localhost', port:3306, user:'root', password:'null', database:'shanthiayur_new', connectionLimit:2 });
      const [packages] = await pool.execute("SELECT DPKG_DocNo as code, DPKG_Name as name, DPKG_SessionCount as sessions, DPKG_Price as price FROM pack_definedpackagesmaster WHERE DPKG_isDeleted IS NULL OR DPKG_isDeleted = 0 ORDER BY DPKG_DocNo");
      const [subpackages] = await pool.execute("SELECT DPDKG_Details_DocNo as id, DPDKG_Details_DPDKG_DocNo as packageCode, DPDKG_Details_DPDKG_TreatmentName as treatment, DPDKG_Details_DPDKG_SessionCount as sessions, DPDKG_Details_DPDKG_Price as price FROM pack_definedpackagesmasterdetails WHERE DPDKG_Details_DPDKG_isDeleted IS NULL OR DPDKG_Details_DPDKG_isDeleted = 0");
      await pool.end();
      return sendJSON(res, { success: true, packages, subpackages });
    } catch(e) { console.log('MySQL packages error:', e.message); }
    return sendJSON(res, { success: true, packages: [], subpackages: [] });
  }

  // ── Patient Package Subscription Report (from MySQL or JSON) ──
  if (url === '/api/package-subscriptions' && method === 'GET') {
    // First check if we have subscription data in JSON db
    if (db.packageSubscriptions && db.packageSubscriptions.length > 0) {
      return sendJSON(res, { success: true, data: db.packageSubscriptions });
    }
    
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({ host:'localhost', port:3306, user:'root', password:'null', database:'shanthiayur_new', connectionLimit:2 });
      
      // Check which pack tables exist
      const [tables] = await pool.execute("SHOW TABLES LIKE 'pack_%'");
      const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
      console.log('Found pack tables:', tableNames.join(', '));
      
      let rows = [];
      
      if (tableNames.includes('pack_patientpackagesubscription')) {
        const [result] = await pool.execute(`
          SELECT 
            ps.PPS_PatientDocNo as mrNo,
            CONCAT(COALESCE(p.Patient_FirstName,''), ' ', COALESCE(p.Patient_MiddleName,''), ' ', COALESCE(p.Patient_LastName,'')) as patientName,
            p.Patient_Mobile as mobile,
            ps.PPS_DPKG_DocNo as packageCode,
            pkg.DPKG_Name as packageName,
            DATE_FORMAT(ps.PPS_StartDate, '%d-%m-%Y') as startDate,
            DATE_FORMAT(ps.PPS_EndDate, '%d-%m-%Y') as endDate,
            ps.PPS_TotalSessions as totalSessions,
            ps.PPS_UsedSessions as usedSessions,
            (ps.PPS_TotalSessions - COALESCE(ps.PPS_UsedSessions, 0)) as balanceSessions
          FROM pack_patientpackagesubscription ps
          LEFT JOIN patientmaster p ON ps.PPS_PatientDocNo = p.Patient_DocNo
          LEFT JOIN pack_definedpackagesmaster pkg ON ps.PPS_DPKG_DocNo = pkg.DPKG_DocNo
          WHERE (ps.PPS_isDeleted IS NULL OR ps.PPS_isDeleted = 0)
          ORDER BY ps.PPS_PatientDocNo
        `);
        rows = result;
      }
      
      await pool.end();
      // Cache in JSON db for offline use
      if (rows.length > 0) {
        db.packageSubscriptions = rows;
        saveDatabase();
      }
      return sendJSON(res, { success: true, data: rows });
    } catch(e) { 
      console.log('MySQL package subscriptions error:', e.message);
      // Fallback: build from JSON patient data
      var subs = (db.patients || []).filter(function(p) { 
        return p.packageName && p.packageName !== 'None' && p.packageName !== ''; 
      }).map(function(p) {
        return {
          mrNo: p.mrNo || '',
          patientName: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' '),
          mobile: p.mobile || '',
          packageCode: '',
          packageName: p.packageName || '',
          startDate: p.packageStart || '',
          endDate: p.policyExpiry || '',
          totalSessions: parseInt(p.packageVisits) || 0,
          usedSessions: Math.max(0, (parseInt(p.packageVisits) || 0) - (parseInt(p.packageBalance) || 0)),
          balanceSessions: parseInt(p.packageBalance) || 0
        };
      });
      return sendJSON(res, { success: true, data: subs });
    }
  }

  // ── Save Package Subscriptions (manual import or from admin) ──
  if (url === '/api/package-subscriptions' && method === 'POST') {
    const body = await parseBody(req);
    if (body.data && Array.isArray(body.data)) {
      db.packageSubscriptions = body.data;
      saveDatabase();
      return sendJSON(res, { success: true, count: body.data.length });
    }
    // Single subscription add
    if (body.mrNo && body.packageName) {
      if (!db.packageSubscriptions) db.packageSubscriptions = [];
      db.packageSubscriptions.push(body);
      saveDatabase();
      return sendJSON(res, { success: true });
    }
    return sendJSON(res, { success: false, error: 'Invalid data' }, 400);
  }

  // ── Receipts ──
  if (url === '/api/receipts' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.receipts || [] });
  }
  if (url === '/api/receipts' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.receipts) db.receipts = [];
    if (body.receiptNo) {
      // Check for duplicate
      const existing = db.receipts.find(r => r.receiptNo === body.receiptNo);
      if (existing) {
        // Generate next number
        let maxNo = 0;
        db.receipts.forEach(r => { const n = parseInt(String(r.receiptNo).replace(/\D/g, '')) || 0; if (n > maxNo) maxNo = n; });
        body.receiptNo = 'R' + (maxNo + 1);
      }
      db.receipts.unshift(body);
      saveDatabase();
      return sendJSON(res, { success: true, data: body });
    }
    return sendJSON(res, { success: false, error: 'receiptNo required' }, 400);
  }

  // ── Reimbursement - Save to Local Disk C:\ ──
  if (url === '/api/reimburse/save-to-disk' && method === 'POST') {
    const body = await parseBody(req);
    try {
      const saveDir = 'C:\\ClinicForms\\Reimbursement';
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const patientName = (body.memberName || body.patientName || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const filename = `Reimburse_${patientName}_${timestamp}.json`;
      const filePath = path.join(saveDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
      console.log('Reimbursement saved to:', filePath);
      return sendJSON(res, { success: true, path: filePath, filename });
    } catch(e) {
      console.log('Save to disk error:', e.message);
      return sendJSON(res, { success: false, error: e.message });
    }
  }

  // ── Reimbursement - Upload File ──
  if (url === '/api/reimburse/upload' && method === 'POST') {
    try {
      const uploadDir = 'C:\\ClinicForms\\Reimbursement\\Uploads';
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      // Parse multipart form data
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart')) {
        return sendJSON(res, { success: false, error: 'Must be multipart form data' }, 400);
      }
      
      const boundary = contentType.split('boundary=')[1];
      const chunks = [];
      for await (const chunk of req) { chunks.push(chunk); }
      const buffer = Buffer.concat(chunks);
      const bodyStr = buffer.toString('binary');
      
      // Extract filename and file data
      const filenameMatch = bodyStr.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'uploaded_file_' + Date.now();
      
      // Find file content between boundaries
      const parts = bodyStr.split('--' + boundary);
      let fileData = null;
      for (const part of parts) {
        if (part.includes('filename=')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd >= 0) {
            fileData = part.substring(headerEnd + 4);
            // Remove trailing \r\n
            if (fileData.endsWith('\r\n')) fileData = fileData.slice(0, -2);
          }
        }
      }
      
      if (fileData) {
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(fileData, 'binary'));
        console.log('File uploaded to:', filePath);
        return sendJSON(res, { success: true, filename, path: filePath });
      }
      return sendJSON(res, { success: false, error: 'No file found in upload' });
    } catch(e) {
      console.log('Upload error:', e.message);
      return sendJSON(res, { success: false, error: e.message });
    }
  }

  // ── List uploaded reimbursement files ──
  if (url === '/api/reimburse/files' && method === 'GET') {
    try {
      const uploadDir = 'C:\\ClinicForms\\Reimbursement\\Uploads';
      const saveDir = 'C:\\ClinicForms\\Reimbursement';
      const files = [];
      if (fs.existsSync(uploadDir)) {
        fs.readdirSync(uploadDir).forEach(f => files.push({ name: f, type: 'upload', path: path.join(uploadDir, f) }));
      }
      if (fs.existsSync(saveDir)) {
        fs.readdirSync(saveDir).filter(f => f.endsWith('.json')).forEach(f => files.push({ name: f, type: 'form', path: path.join(saveDir, f) }));
      }
      return sendJSON(res, { success: true, data: files });
    } catch(e) {
      return sendJSON(res, { success: true, data: [] });
    }
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

  // ── Patient Signatures ──
  if (url === '/api/patient-signature' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.patientSignatures) db.patientSignatures = {};
    if (body.mrNo && body.signature) {
      db.patientSignatures[body.mrNo] = body.signature;
      saveDatabase();
      return sendJSON(res, { success: true });
    }
    return sendJSON(res, { success: false, error: 'mrNo and signature required' }, 400);
  }
  if (url.startsWith('/api/patient-signature/') && method === 'GET') {
    const mrNo = decodeURIComponent(url.split('/')[3]);
    if (!db.patientSignatures) db.patientSignatures = {};
    const sig = db.patientSignatures[mrNo] || '';
    return sendJSON(res, { success: !!sig, data: sig });
  }

  // ── Claim Form Upload ──
  if (url === '/api/claim-forms/upload' && method === 'POST') {
    try {
      const uploadDir = path.join(__dirname, 'uploads', 'claim-forms');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
      const chunks = [];
      for await (const chunk of req) { chunks.push(chunk); }
      const buffer = Buffer.concat(chunks);
      const bodyStr = buffer.toString('binary');
      
      const filenameMatch = bodyStr.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'form_' + Date.now();
      const mrNoMatch = bodyStr.match(/name="mrNo"\r\n\r\n([^\r]*)/);
      const descMatch = bodyStr.match(/name="description"\r\n\r\n([^\r]*)/);
      const mrNo = mrNoMatch ? mrNoMatch[1] : '';
      const description = descMatch ? descMatch[1] : '';
      
      const parts = bodyStr.split('--' + boundary);
      let fileData = null;
      for (const part of parts) {
        if (part.includes('filename=')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd >= 0) {
            fileData = part.substring(headerEnd + 4);
            if (fileData.endsWith('\r\n')) fileData = fileData.slice(0, -2);
          }
        }
      }
      
      if (fileData) {
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(fileData, 'binary'));
        
        if (!db.claimForms) db.claimForms = [];
        db.claimForms.push({ filename, mrNo, description, uploadDate: new Date().toISOString().split('T')[0], filePath });
        saveDatabase();
        
        return sendJSON(res, { success: true, filename, fileUrl: '/uploads/claim-forms/' + filename });
      }
      return sendJSON(res, { success: false, error: 'No file in upload' });
    } catch(e) {
      return sendJSON(res, { success: false, error: e.message });
    }
  }
  if (url === '/api/claim-forms' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.claimForms || [] });
  }

  // Serve uploaded files
  if (url.startsWith('/uploads/claim-forms/') && method === 'GET') {
    const filename = decodeURIComponent(url.split('/').pop());
    const filePath = path.join(__dirname, 'uploads', 'claim-forms', filename);
    if (fs.existsSync(filePath)) {
      const ext = filename.split('.').pop().toLowerCase();
      const mimeTypes = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
      return;
    }
    res.writeHead(404); res.end('File not found'); return;
  }

  // Fill PDF form with patient data
  if (url === '/api/claim-forms/fill-pdf' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { filename, mrNo } = body;
      const filePath = path.join(__dirname, 'uploads', 'claim-forms', filename);
      if (!fs.existsSync(filePath)) return sendJSON(res, { success: false, error: 'File not found' });

      const { PDFDocument } = require('pdf-lib');
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Get patient data
      const pat = (db.patients || []).find(p => p.mrNo === mrNo) || {};
      const patientName = [pat.firstName, pat.middleName, pat.lastName].filter(Boolean).join(' ');

      // Try to fill form fields (common field names in insurance forms)
      const fieldMap = {
        'patientName': patientName, 'PatientName': patientName, 'patient_name': patientName, 'Name': patientName,
        'memberName': patientName, 'MemberName': patientName, 'member_name': patientName,
        'mrNo': mrNo, 'MRNo': mrNo, 'fileNo': mrNo, 'FileNo': mrNo,
        'mobile': pat.mobile || '', 'Mobile': pat.mobile || '', 'phone': pat.mobile || '', 'Phone': pat.mobile || '',
        'emiratesId': pat.eid || '', 'EmiratesID': pat.eid || '', 'eid': pat.eid || '', 'EID': pat.eid || '',
        'dob': pat.dob || '', 'DOB': pat.dob || '', 'dateOfBirth': pat.dob || '',
        'nationality': pat.nationality || '', 'Nationality': pat.nationality || '',
        'email': pat.email || '', 'Email': pat.email || '',
        'gender': pat.gender || '', 'Gender': pat.gender || '',
        'address': pat.address || '', 'Address': pat.address || '',
      };

      // Get all field names from the PDF
      const fields = form.getFields();
      const fieldNames = fields.map(f => f.getName());
      console.log('PDF form fields found:', fieldNames);

      // Fill matching fields
      fields.forEach(field => {
        const name = field.getName();
        // Try exact match
        if (fieldMap[name] !== undefined) {
          try { field.setText(fieldMap[name]); } catch(e) {}
        }
        // Try case-insensitive match
        const lowerName = name.toLowerCase();
        Object.keys(fieldMap).forEach(key => {
          if (key.toLowerCase() === lowerName) {
            try { field.setText(fieldMap[key]); } catch(e) {}
          }
        });
      });

      const filledPdfBytes = await pdfDoc.save();
      const filledPath = path.join(__dirname, 'uploads', 'claim-forms', 'filled_' + mrNo + '_' + filename);
      fs.writeFileSync(filledPath, filledPdfBytes);

      return sendJSON(res, { success: true, fileUrl: '/uploads/claim-forms/filled_' + mrNo + '_' + filename, fields: fieldNames });
    } catch(e) {
      console.log('PDF fill error:', e.message);
      return sendJSON(res, { success: false, error: e.message, fallback: true });
    }
  }

  // Get PDF form field names (for mapping)
  if (url === '/api/claim-forms/fields' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const filePath = path.join(__dirname, 'uploads', 'claim-forms', body.filename);
      if (!fs.existsSync(filePath)) return sendJSON(res, { success: false, error: 'File not found' });

      const { PDFDocument } = require('pdf-lib');
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields().map(f => ({ name: f.getName(), type: f.constructor.name }));
      return sendJSON(res, { success: true, fields });
    } catch(e) {
      return sendJSON(res, { success: false, error: e.message });
    }
  }

  // Fill flat PDF by writing text at specific coordinates
  if (url === '/api/claim-forms/fill-flat-pdf' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { filename, mrNo, fieldPositions } = body;
      const filePath = path.join(__dirname, 'uploads', 'claim-forms', filename);
      if (!fs.existsSync(filePath)) return sendJSON(res, { success: false, error: 'File not found' });

      const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Get patient data
      const pat = (db.patients || []).find(p => p.mrNo === mrNo) || {};
      const patientName = [pat.firstName, pat.middleName, pat.lastName].filter(Boolean).join(' ');

      // Data map
      const dataMap = {
        patientName: patientName,
        mrNo: mrNo || '',
        mobile: pat.mobile || '',
        eid: pat.eid || '',
        dob: pat.dob || '',
        nationality: pat.nationality || '',
        gender: pat.gender || '',
        email: pat.email || '',
        address: [pat.address, pat.area, pat.city].filter(Boolean).join(', '),
        insurance: pat.policyName || '',
        policyExpiry: pat.policyExpiry || '',
        date: new Date().toLocaleDateString('en-GB'),
        amount: body.amount || '0',
        doctor: body.doctor || '',
      };

      // Default field positions for NAS Reimbursement form (page 0, coordinates from top-left)
      // These are approximate - user can customize via fieldPositions parameter
      const defaultPositions = [
        { field: 'patientName', page: 0, x: 180, y: 680, size: 10 },
        { field: 'eid', page: 0, x: 180, y: 655, size: 10 },
        { field: 'dob', page: 0, x: 450, y: 655, size: 10 },
        { field: 'mobile', page: 0, x: 180, y: 630, size: 10 },
        { field: 'gender', page: 0, x: 450, y: 630, size: 10 },
        { field: 'nationality', page: 0, x: 180, y: 605, size: 10 },
        { field: 'insurance', page: 0, x: 180, y: 580, size: 10 },
        { field: 'date', page: 0, x: 450, y: 580, size: 10 },
        { field: 'amount', page: 0, x: 180, y: 400, size: 11 },
        { field: 'doctor', page: 0, x: 180, y: 300, size: 10 },
      ];

      const positions = fieldPositions || db.claimFormPositions?.[filename] || defaultPositions;

      // Write text on PDF
      positions.forEach(pos => {
        const value = dataMap[pos.field] || '';
        if (!value) return;
        const page = pdfDoc.getPage(pos.page || 0);
        page.drawText(value, {
          x: pos.x,
          y: pos.y,
          size: pos.size || 10,
          font: pos.bold ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      });

      // Add signature images if available
      if (db.signatures && db.signatures.doctor) {
        try {
          const sigData = db.signatures.doctor.replace(/^data:image\/\w+;base64,/, '');
          const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64')).catch(() => null);
          if (sigImage) {
            const page = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
            page.drawImage(sigImage, { x: 380, y: 80, width: 100, height: 40 });
          }
        } catch(e) {}
      }
      if (db.signatures && db.signatures.seal) {
        try {
          const sealData = db.signatures.seal.replace(/^data:image\/\w+;base64,/, '');
          const sealImage = await pdfDoc.embedPng(Buffer.from(sealData, 'base64')).catch(() => null);
          if (sealImage) {
            const page = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
            page.drawImage(sealImage, { x: 280, y: 60, width: 80, height: 80 });
          }
        } catch(e) {}
      }

      const filledBytes = await pdfDoc.save();
      const outputFilename = 'filled_' + mrNo + '_' + filename;
      const outputPath = path.join(__dirname, 'uploads', 'claim-forms', outputFilename);
      fs.writeFileSync(outputPath, filledBytes);

      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="' + outputFilename + '"' });
      res.end(Buffer.from(filledBytes));
      return;
    } catch(e) {
      console.log('Flat PDF fill error:', e.message);
      return sendJSON(res, { success: false, error: e.message });
    }
  }

  // Save field position configuration for a form
  if (url === '/api/claim-forms/save-positions' && method === 'POST') {
    const body = await parseBody(req);
    if (!db.claimFormPositions) db.claimFormPositions = {};
    db.claimFormPositions[body.filename] = body.positions;
    saveDatabase();
    return sendJSON(res, { success: true });
  }

  // Generate filled Word document from claim form template
  if (url === '/api/claim-forms/generate-word' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { mrNo, formType, amount } = body;
      const pat = (db.patients || []).find(p => p.mrNo === mrNo) || {};
      const patientName = [pat.firstName, pat.middleName, pat.lastName].filter(Boolean).join(' ');
      
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun } = require('docx');

      // Build the claim form document
      const sections = [];
      const children = [];

      // Header
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'INSURANCE CLAIM FORM', bold: true, size: 28 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formType || 'Reimbursement Claim', size: 20, color: '666666' })] }));
      children.push(new Paragraph({ text: '' }));

      // Clinic info
      children.push(new Paragraph({ children: [new TextRun({ text: 'SHANTHI WELLNESS AYURVED MEDICAL CENTRE LLC', bold: true, size: 22 })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: 'Dubai, UAE | Tel: +971 42 255 133 | Lic: DHA-F-0002448', size: 18, color: '555555' })] }));
      children.push(new Paragraph({ text: '' }));

      // Section 1: Patient Information
      children.push(new Paragraph({ children: [new TextRun({ text: 'SECTION 1: MEMBER / PATIENT INFORMATION', bold: true, size: 22, color: '1b5e20' })] }));
      children.push(new Paragraph({ text: '' }));

      const patientTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Patient Name:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: patientName, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'File No:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: mrNo || '', size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Emirates ID:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.eid || '', size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date of Birth:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.dob || '', size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mobile:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.mobile || '', size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nationality:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.nationality || '', size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Gender:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.gender || '', size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Email:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.email || '', size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Insurance Company:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.policyName || '', size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Policy Expiry:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pat.policyExpiry || '', size: 20 })] })] }),
          ]}),
        ]
      });
      children.push(patientTable);
      children.push(new Paragraph({ text: '' }));

      // Section 2: Claim Details
      children.push(new Paragraph({ children: [new TextRun({ text: 'SECTION 2: CLAIM DETAILS', bold: true, size: 22, color: '1b5e20' })] }));
      children.push(new Paragraph({ text: '' }));

      const claimTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Claim Amount:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (amount || '0') + ' AED', size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date:', bold: true, size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: new Date().toLocaleDateString('en-GB'), size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Treating Doctor:', bold: true, size: 20 })] })] }),
            new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })] }),
          ]}),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Diagnosis:', bold: true, size: 20 })] })] }),
            new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })] }),
          ]}),
        ]
      });
      children.push(claimTable);
      children.push(new Paragraph({ text: '' }));
      children.push(new Paragraph({ text: '' }));

      // Signature section
      children.push(new Paragraph({ children: [new TextRun({ text: 'SIGNATURES', bold: true, size: 22, color: '1b5e20' })] }));
      children.push(new Paragraph({ text: '' }));
      children.push(new Paragraph({ text: '' }));

      const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({ children: [
            new TableCell({ borders: { top: {style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} }, children: [
              new Paragraph({ text: '' }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: '________________________' }),
              new Paragraph({ children: [new TextRun({ text: 'Patient Signature', bold: true, size: 18 })] }),
            ]}),
            new TableCell({ borders: { top: {style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} }, children: [
              new Paragraph({ text: '' }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: '________________________' }),
              new Paragraph({ children: [new TextRun({ text: 'Doctor Signature & Seal', bold: true, size: 18 })] }),
            ]}),
          ]}),
        ]
      });
      children.push(sigTable);

      // Footer
      children.push(new Paragraph({ text: '' }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'For SHANTHI WELLNESS AYURVEDIC MEDICAL CENTRE LLC', bold: true, size: 18, color: '333333' })] }));

      sections.push({ children });

      const doc = new Document({ sections });
      const buffer = await Packer.toBuffer(doc);

      const outputFilename = 'ClaimForm_' + (formType || 'NAS').replace(/[^a-zA-Z0-9]/g, '_') + '_' + mrNo + '_' + Date.now() + '.docx';
      const outputPath = path.join(__dirname, 'uploads', 'claim-forms', outputFilename);
      if (!fs.existsSync(path.join(__dirname, 'uploads', 'claim-forms'))) fs.mkdirSync(path.join(__dirname, 'uploads', 'claim-forms'), { recursive: true });
      fs.writeFileSync(outputPath, buffer);

      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="' + outputFilename + '"' });
      res.end(buffer);
      return;
    } catch(e) {
      console.log('Word generation error:', e.message);
      return sendJSON(res, { success: false, error: e.message });
    }
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

  // ── PDF Editor page ──
  if (url.startsWith('/pdf-editor') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const pdfFile = urlObj.searchParams.get('file') || '';
    const mrNo = urlObj.searchParams.get('mrNo') || '';
    const amount = urlObj.searchParams.get('amount') || '0';

    const pat = (db.patients || []).find(p => p.mrNo === mrNo) || {};
    const patientName = [pat.firstName, pat.middleName, pat.lastName].filter(Boolean).join(' ');
    const docSig = (db.signatures && db.signatures.doctor) || '';
    const sealImg = (db.signatures && db.signatures.seal) || '';
    const patSig = (db.patientSignatures && db.patientSignatures[mrNo]) || '';

    const pdfEditorPage = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>PDF Editor - ${patientName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#333;display:flex;flex-direction:column;height:100vh;overflow:hidden}
.toolbar{height:44px;background:#1b5e20;display:flex;align-items:center;padding:0 12px;gap:6px;flex-shrink:0;flex-wrap:wrap}
.toolbar button{height:28px;padding:0 10px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;background:#fff;color:#1b5e20}
.toolbar button:hover{background:#c8e6c9}
.toolbar span{color:#fff;font-size:11px;font-weight:700}
.main{display:flex;flex:1;overflow:hidden;min-height:0}
.pdf-area{flex:1;overflow-y:auto;overflow-x:auto;background:#555;padding:20px;display:flex;flex-direction:column;align-items:center}
.pdf-wrapper{position:relative;width:820px;min-height:1130px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.4);flex-shrink:0}
embed#pdfEmbed{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none}
.overlay{position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;cursor:crosshair}
.drag-item{position:absolute;cursor:move;user-select:none;z-index:3}
.drag-item.text-item{background:transparent;border:1px dashed #1b5e20;padding:2px 4px;font-size:12px;font-family:Arial;color:#000;min-width:40px;min-height:20px;outline:none;white-space:nowrap}
.drag-item.text-item:focus{background:rgba(255,255,200,0.8);border:1px solid #1b5e20}
.drag-item.text-item:not(:focus):empty{display:none}
.drag-item img{display:block;mix-blend-mode:multiply}
.drag-item .del-btn{position:absolute;top:-8px;right:-8px;width:16px;height:16px;background:#c00;color:#fff;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:none;line-height:16px;text-align:center;z-index:10}
.drag-item:hover .del-btn{display:block}
.side{width:230px;background:#fff;border-left:2px solid #1b5e20;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;min-height:0}
.side-top{padding:8px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:#1b5e20;background:#e8f5e9;flex-shrink:0}
.side-scroll{flex:1;overflow-y:scroll;overflow-x:hidden;padding:8px;-webkit-overflow-scrolling:touch}
.data-btn{display:block;width:100%;text-align:left;padding:5px 8px;margin:2px 0;font-size:11px;font-weight:700;border:1px solid #e0e0e0;background:#fff;border-radius:3px;cursor:pointer}
.data-btn:hover{background:#e8f5e9;border-color:#2e7d32}
.data-btn b{display:block;font-size:9px;font-weight:400;color:#999}
.sig-box{text-align:center;margin:6px 0;padding:6px;border:1px solid #e0e0e0;border-radius:4px;cursor:pointer}
.sig-box:hover{background:#e8f5e9}
.sig-box img{max-width:120px;max-height:50px;mix-blend-mode:multiply}
.sig-box span{font-size:10px;font-weight:700;color:#1b5e20;display:block;margin-top:2px}
.section-title{font-size:11px;font-weight:700;color:#1b5e20;margin:8px 0 4px;padding-top:6px;border-top:1px solid #eee}
select.font-sel{height:26px;font-size:11px;border:1px solid #ccc;border-radius:3px;padding:0 4px;color:#1b5e20}
@media print{
  .toolbar,.side{display:none!important}
  .main{display:block}
  .pdf-area{overflow:visible;padding:0;background:#fff}
  .pdf-wrapper{box-shadow:none;width:100%;min-height:auto}
  embed#pdfEmbed{position:relative;width:100%;height:1130px}
  .drag-item .del-btn{display:none!important}
}
</style></head><body>
<div class="toolbar">
  <span>📄 ${patientName} (MR: ${mrNo})</span>
  <button onclick="printForm()">🖨 Print / PDF</button>
  <button onclick="exportWord()">📄 Word</button>
  <button onclick="exportExcel()">📊 Excel</button>
  <select class="font-sel" id="fontSz" onchange="currentFontSize=this.value"><option value="10">10</option><option value="11">11</option><option value="12" selected>12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option></select>
  <button onclick="clearAll()" style="background:#fce4e4;color:#c00">Clear All</button>
</div>
<div class="main">
  <div class="pdf-area">
    <div class="pdf-wrapper" id="pdfWrapper">
      <embed id="pdfEmbed" src="${pdfFile}" type="application/pdf">
      <div class="overlay" id="overlay" onclick="createTextField(event)"></div>
    </div>
  </div>
  <div class="side">
    <div class="side-top">Patient Data — Click to place on form</div>
    <div class="side-scroll">
      <button class="data-btn" onclick="placeText('${patientName}','Patient Name')"><b>Patient Name</b>${patientName}</button>
      <button class="data-btn" onclick="placeText('${mrNo}','MR No / File No')"><b>MR No / File No</b>${mrNo}</button>
      <button class="data-btn" onclick="placeText('${pat.eid||''}','Emirates ID')"><b>Emirates ID</b>${pat.eid||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.dob||''}','Date of Birth')"><b>Date of Birth</b>${pat.dob||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.mobile||''}','Mobile')"><b>Mobile</b>${pat.mobile||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.nationality||''}','Nationality')"><b>Nationality</b>${pat.nationality||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.gender||''}','Gender')"><b>Gender</b>${pat.gender||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.email||''}','Email')"><b>Email</b>${pat.email||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.policyName||''}','Insurance Co.')"><b>Insurance Co.</b>${pat.policyName||'—'}</button>
      <button class="data-btn" onclick="placeText('${pat.policyExpiry||''}','Policy Expiry')"><b>Policy Expiry</b>${pat.policyExpiry||'—'}</button>
      <button class="data-btn" onclick="placeText('${amount}','Claim Amount')"><b>Claim Amount</b>${amount} AED</button>
      <button class="data-btn" onclick="placeText('${new Date().toLocaleDateString('en-GB')}','Today Date')"><b>Today Date</b>${new Date().toLocaleDateString('en-GB')}</button>
      <button class="data-btn" onclick="placeText('SHANTHI WELLNESS AYURVEDIC MEDICAL CENTRE LLC','Clinic Name')"><b>Clinic Name</b>Shanthi Wellness</button>

      <div class="section-title">Signatures (click to place)</div>
      ${docSig ? `<div class="sig-box" onclick="placeSig('${docSig}',100,44)"><img src="${docSig}"><span>Doctor Signature</span></div>` : '<div style="font-size:10px;color:#999;text-align:center;padding:4px">No doctor signature</div>'}
      ${sealImg ? `<div class="sig-box" onclick="placeSig('${sealImg}',70,70)"><img src="${sealImg}"><span>Clinic Seal</span></div>` : '<div style="font-size:10px;color:#999;text-align:center;padding:4px">No clinic seal</div>'}
      ${patSig ? `<div class="sig-box" onclick="placeSig('${patSig}',100,44)"><img src="${patSig}"><span>Patient Signature</span></div>` : '<div style="font-size:10px;color:#999;text-align:center;padding:4px">No patient signature</div>'}

      <div class="section-title">Instructions</div>
      <div style="font-size:10px;color:#666;line-height:1.5">
        • Click a patient field to place it on the form<br>
        • Click signatures to place them<br>
        • <b>Drag</b> items to position them<br>
        • Click on PDF to add custom text<br>
        • Double-click text to edit<br>
        • Hover + click ✕ to delete<br>
        • Print → Save as PDF
      </div>
    </div>
  </div>
</div>
<script>
var currentFontSize = 12;
var pendingText = null;
var pendingImg = null;

// Adjust embed height after load
window.onload = function(){
  var wrapper = document.getElementById('pdfWrapper');
  // Set height to show full A4 pages (approx 1130px per page for 820px wide)
  wrapper.style.height = '1130px';
  document.getElementById('pdfEmbed').style.height = '1130px';
};

function createTextField(e){
  if(pendingText !== null){
    placePending(e, pendingText, null);
    pendingText = null;
    document.getElementById('overlay').style.cursor = 'crosshair';
    return;
  }
  if(pendingImg !== null){ return; }
  var rect = document.getElementById('pdfWrapper').getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  createDragText('', x, y);
}

function placeText(val, label){
  pendingText = val;
  document.getElementById('overlay').style.cursor = 'copy';
  document.getElementById('overlay').title = 'Click on the form where you want to place: ' + label;
}

function placeSig(src, w, h){
  var wrapper = document.getElementById('pdfWrapper');
  var item = document.createElement('div');
  item.className = 'drag-item';
  item.style.left = '300px';
  item.style.top = '900px';
  var img = document.createElement('img');
  img.src = src;
  img.style.width = w + 'px';
  img.style.height = h + 'px';
  img.style.mixBlendMode = 'multiply';
  item.appendChild(img);
  var del = document.createElement('button');
  del.className = 'del-btn';
  del.innerHTML = '✕';
  del.onclick = function(e){ e.stopPropagation(); item.remove(); };
  item.appendChild(del);
  makeDraggable(item);
  wrapper.appendChild(item);
}

function placePending(e, text, imgSrc){
  var wrapper = document.getElementById('pdfWrapper');
  var rect = wrapper.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  createDragText(text, x, y);
}

function createDragText(text, x, y){
  var wrapper = document.getElementById('pdfWrapper');
  var item = document.createElement('div');
  item.className = 'drag-item text-item';
  item.contentEditable = 'true';
  item.style.left = x + 'px';
  item.style.top = y + 'px';
  item.style.fontSize = currentFontSize + 'px';
  item.textContent = text || '';
  var del = document.createElement('button');
  del.className = 'del-btn';
  del.innerHTML = '✕';
  del.onclick = function(e){ e.stopPropagation(); item.remove(); };
  item.appendChild(del);
  makeDraggable(item);
  wrapper.appendChild(item);
  if(!text) item.focus();
}

function makeDraggable(el){
  var ox,oy,dragging=false;
  el.addEventListener('mousedown', function(e){
    if(e.target.classList.contains('del-btn')) return;
    if(e.target.contentEditable==='true' && e.detail>1) return;
    dragging=true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){
    if(!dragging) return;
    el.style.left = (e.clientX-ox)+'px';
    el.style.top = (e.clientY-oy)+'px';
  });
  document.addEventListener('mouseup', function(){ dragging=false; });
}

function clearAll(){
  if(!confirm('Remove all placed items?')) return;
  var items = document.querySelectorAll('.drag-item');
  items.forEach(function(i){ i.remove(); });
}

function printForm(){
  var items = document.querySelectorAll('.drag-item .del-btn');
  items.forEach(function(b){ b.style.display='none'; });
  document.querySelector('.toolbar').style.display='none';
  document.querySelector('.side').style.display='none';
  document.querySelector('.pdf-area').style.padding='0';
  window.print();
  setTimeout(function(){
    document.querySelector('.toolbar').style.display='flex';
    document.querySelector('.side').style.display='flex';
    document.querySelector('.pdf-area').style.padding='10px';
  },1000);
}

function exportWord(){
  var fields = [];
  document.querySelectorAll('.drag-item.text-item').forEach(function(el){
    fields.push(el.textContent.trim());
  });
  var html = '<html><body><h2>Claim Form - ${patientName}</h2><p><b>Patient:</b> ${patientName} | <b>MR:</b> ${mrNo}</p>';
  fields.forEach(function(f){ html += '<p>'+f+'</p>'; });
  html += '</body></html>';
  var b = new Blob([html],{type:'application/msword'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ClaimForm_${mrNo}.doc'; a.click();
}

function exportExcel(){
  var rows = [['Field','Value'],['Patient Name','${patientName}'],['MR No','${mrNo}'],['Emirates ID','${pat.eid||''}'],['DOB','${pat.dob||''}'],['Mobile','${pat.mobile||''}'],['Amount','${amount}']];
  var csv = rows.map(function(r){return r.map(function(c){return '"'+c+'"';}).join(',');}).join('\\n');
  var b = new Blob([csv],{type:'text/csv'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ClaimForm_${mrNo}.csv'; a.click();
}
<\/script>
</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pdfEditorPage);
    return;
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
  var mrNo=params.get("mrNo")||"";
  if(type==="patient"&&mrNo){
    fetch("/api/patient-signature",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mrNo:mrNo,signature:data})})
    .then(function(r){return r.json()})
    .then(function(d){document.getElementById("msg").style.display="block"})
    .catch(function(e){alert("Error saving: "+e.message)});
  }else{
    fetch("/api/signatures",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:type,data:data})})
    .then(function(r){return r.json()})
    .then(function(d){document.getElementById("msg").style.display="block"})
    .catch(function(e){alert("Error saving: "+e.message)});
  }
}
</script></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(signPage);
    return;
  }

  // ── Patient Attachments ──
  if (url.startsWith('/api/patient-attachments') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const mrNo = urlObj.searchParams.get('mrNo') || '';
    if (!db.patientAttachments) db.patientAttachments = [];
    const attachments = db.patientAttachments.filter(a => a.mrNo === mrNo);
    return sendJSON(res, { success: true, data: attachments });
  }
  if (url === '/api/patient-attachments' && method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart')) {
        return sendJSON(res, { success: false, error: 'Must be multipart form data' }, 400);
      }
      const boundary = contentType.split('boundary=')[1];
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = Buffer.concat(chunks);
      const bodyStr = bodyBuf.toString('binary');
      const parts = bodyStr.split('--' + boundary);

      let mrNo = '', docType = '', remark = '', filename = '', fileData = null;
      for (const part of parts) {
        if (part.includes('name="mrNo"')) { mrNo = part.split('\r\n\r\n')[1]?.trim().replace(/\r\n--$/, '') || ''; }
        if (part.includes('name="docType"')) { docType = part.split('\r\n\r\n')[1]?.trim().replace(/\r\n--$/, '') || ''; }
        if (part.includes('name="remark"')) { remark = part.split('\r\n\r\n')[1]?.trim().replace(/\r\n--$/, '') || ''; }
        if (part.includes('name="file"') && part.includes('filename=')) {
          const fnMatch = part.match(/filename="([^"]+)"/);
          filename = fnMatch ? fnMatch[1] : 'file_' + Date.now();
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          fileData = part.substring(dataStart, dataEnd);
        }
      }

      if (!fileData || !mrNo) {
        return sendJSON(res, { success: false, error: 'Missing file or patient MR No' });
      }

      const uploadDir = path.join(__dirname, 'uploads', 'patient-docs', mrNo);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const savedName = Date.now() + '_' + filename;
      const filePath = path.join(uploadDir, savedName);
      fs.writeFileSync(filePath, Buffer.from(fileData, 'binary'));

      if (!db.patientAttachments) db.patientAttachments = [];
      const record = { mrNo, docType, remark, filename, savedName, uploadDate: new Date().toISOString().split('T')[0] };
      db.patientAttachments.push(record);
      saveDatabase();

      return sendJSON(res, { success: true, data: record });
    } catch(e) {
      console.log('Attachment upload error:', e.message);
      return sendJSON(res, { success: false, error: e.message });
    }
  }
  if (url.startsWith('/api/patient-attachments/delete') && method === 'POST') {
    const body = await parseBody(req);
    if (!db.patientAttachments) db.patientAttachments = [];
    const att = db.patientAttachments.find(a => a.savedName === body.savedName);
    if (att) {
      const filePath = path.join(__dirname, 'uploads', 'patient-docs', att.mrNo, att.savedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.patientAttachments = db.patientAttachments.filter(a => a.savedName !== body.savedName);
      saveDatabase();
    }
    return sendJSON(res, { success: true });
  }

  // ── Employees ──
  if (url === '/api/employees' && method === 'GET') {
    if (db.employees && db.employees.length) {
      return sendJSON(res, { success: true, data: db.employees });
    }
    const defaultEmployees = [
      { empCode:'EM0057', name:'LINTU RAJAN', description:'DOCTOR' },
      { empCode:'EM0058', name:'NEETHU DEEPAK', description:'DOCTOR' },
      { empCode:'EM0059', name:'MISNA UVAISE', description:'DOCTOR' },
      { empCode:'EM0060', name:'KEERTHI PURUSHOTHAMAN', description:'DOCTOR' },
      { empCode:'EM0061', name:'AMARNATH', description:'THERAPIST' },
      { empCode:'EM0063', name:'ANEESH', description:'THERAPIST' },
      { empCode:'EM0064', name:'RESHMI', description:'THERAPIST' },
      { empCode:'EM0065', name:'NOORA HOSBET UMMER', description:'DOCTOR' },
      { empCode:'EM0066', name:'NEETHU', description:'THERAPIST' },
      { empCode:'EM0067', name:'ANJNA NADAKKAVIL CHANDRAN', description:'DOCTOR' },
      { empCode:'EM0068', name:'PADMESH', description:'THERAPIST' },
      { empCode:'EM0070', name:'LINTU', description:'THERAPIST' }
    ];
    return sendJSON(res, { success: true, data: defaultEmployees });
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

  // PDF Editor page
  if (req.url.startsWith('/pdf-editor')) {
    return handleAPI(req, res);
  }

  // Serve uploaded claim form files
  if (req.url.startsWith('/uploads/claim-forms/')) {
    return handleAPI(req, res);
  }

  // Login page at root
  if (req.url === '/' || req.url === '/login' || req.url === '/login/') {
    serveFile(res, path.join(__dirname, 'web-login.html'));
    return;
  }
  // Main app after login
  if (req.url === '/app' || req.url === '/app/' || req.url === '/home' || req.url === '/home/') {
    serveFile(res, path.join(__dirname, 'insurance-only.html'));
    return;
  }

  // Login page
  if (req.url === '/login' || req.url === '/login/') {
    serveFile(res, path.join(__dirname, 'login.html'));
    return;
  }

  // Marketing CRM
  if (req.url === '/marketing' || req.url === '/marketing/') {
    serveFile(res, path.join(__dirname, 'marketing.html'));
    return;
  }

  // Admin Panel
  if (req.url === '/admin' || req.url === '/admin/') {
    serveFile(res, path.join(__dirname, 'admin-panel.html'));
    return;
  }

  // HR Module
  if (req.url === '/hr' || req.url === '/hr/') {
    serveFile(res, path.join(__dirname, 'hr-module.html'));
    return;
  }

  // Patient Feedback Kiosk (no login needed)
  if (req.url === '/feedback' || req.url === '/feedback/') {
    serveFile(res, path.join(__dirname, 'feedback.html'));
    return;
  }

  // Feedback Admin Dashboard
  if (req.url === '/feedback-admin' || req.url === '/feedback-admin/') {
    serveFile(res, path.join(__dirname, 'feedback-admin.html'));
    return;
  }

  // Insurance System
  if (req.url === '/insurance' || req.url === '/insurance/') {
    serveFile(res, path.join(__dirname, 'insurance-only.html'));
    return;
  }

  // User Management System
  if (req.url === '/usermanagement' || req.url === '/usermanagement/') {
    serveFile(res, path.join(__dirname, 'user-management.html'));
    return;
  }

  // Staff Portal
  if (req.url === '/staff' || req.url === '/staff/') {
    serveFile(res, path.join(__dirname, 'staff-portal.html'));
    return;
  }

  // Customer Booking App
  if (req.url === '/book' || req.url === '/book/' || req.url.startsWith('/book?')) {
    serveFile(res, path.join(__dirname, 'customer-app.html'));
    return;
  }

  // (Routes moved to HTTP server handler above)
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
  // Root '/' serves the appropriate HTML for each branch
  let filePath = req.url === '/'
    ? ('/' + HTML_FILE)
    : req.url.split('?')[0];
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

  // Auto-start MySQL if not running
  try {
    const { exec } = require('child_process');
    exec('sc query MYSQL80', (err, stdout) => {
      if (stdout && stdout.includes('STOPPED')) {
        exec('net start MYSQL80', (e2) => {
          if (!e2) console.log('🗄️  MySQL auto-started');
          else console.log('🗄️  MySQL needs admin to start (run: net start MYSQL80)');
        });
      } else if (stdout && stdout.includes('RUNNING')) {
        console.log('🗄️  MySQL is running');
      }
    });
  } catch (e) { /* ignore */ }
  console.log('🔑  Card Reader ready (place card on reader, then click Read Card)');

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
