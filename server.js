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

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'clinic-data.json');

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
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon' };
  const contentType = types[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath, 'utf8');
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
  if (url === '/api/consultations' && method === 'POST') {
    const body = await parseBody(req);
    const id = db.nextIds.consultation++;
    const consultation = { id, ...body, createdAt: new Date().toISOString() };
    db.consultations.push(consultation);
    const claimId = autoGenerateClaimAndLogsheet(consultation);
    saveDatabase();
    return sendJSON(res, { success: true, consultationId: id, claimId });
  }

  // ── Claims ──
  if (url === '/api/claims' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.claims });
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

  sendJSON(res, { error: 'Not found' }, 404);
}

// ─── HTTP Server ─────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    return handleAPI(req, res);
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
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
