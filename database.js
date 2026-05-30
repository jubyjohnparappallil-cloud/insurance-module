/**
 * Clinic Database - MySQL Connection
 * Connects to: localhost:3306, database: clinic_emr, user: root, password: null
 */

const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'null',
      database: 'clinic_emr',
      waitForConnections: true,
      connectionLimit: 10
    });
    // Disable foreign key checks so consultations can be saved without patient existing in DB
    pool.execute('SET foreign_key_checks = 0').catch(() => {});
  }
  return pool;
}

// ─── Patient CRUD ────────────────────────────────────────────────

async function savePatient(data) {
  const db = getPool();
  const sql = `INSERT INTO patients (mrNo, regDate, firstName, middleName, lastName, gender, mobile, referral, nationality, dob, eid, city, area, address, emirate, status, language, category, know)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    firstName=VALUES(firstName), middleName=VALUES(middleName), lastName=VALUES(lastName),
    gender=VALUES(gender), mobile=VALUES(mobile), referral=VALUES(referral),
    nationality=VALUES(nationality), dob=VALUES(dob), eid=VALUES(eid),
    city=VALUES(city), area=VALUES(area), address=VALUES(address),
    emirate=VALUES(emirate), status=VALUES(status), language=VALUES(language),
    category=VALUES(category), know=VALUES(know)`;

  await db.execute(sql, [
    data.mrNo || '', data.regDate || '', data.firstName || '', data.middleName || '',
    data.lastName || '', data.gender || 'Male', data.mobile || '', data.referral || '',
    data.nationality || '', data.dob || '', data.eid || '', data.city || '',
    data.area || '', data.address || '', data.emirate || '', data.status || 'Active',
    data.language || 'English', data.category || 'General', data.know || ''
  ]);
  return data;
}

async function getPatients() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM patients ORDER BY createdAt DESC');
  return rows;
}

async function deletePatient(mrNo) {
  const db = getPool();
  await db.execute('DELETE FROM patients WHERE mrNo = ?', [mrNo]);
  return true;
}

// ─── Consultation + Auto Logsheet ────────────────────────────────

async function saveConsultation(data) {
  const db = getPool();

  // Insert consultation
  const [result] = await db.execute(
    `INSERT INTO consultations (mrNo, patientName, consultDate, chiefComplaints, pastHistory, presentIllness, examination, treatmentPlan, disposition, diagnosis)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.mrNo || '', data.patientName || '', data.consultDate || '',
     data.chiefComplaints || '', data.pastHistory || '', data.presentIllness || '',
     data.examination || '', data.treatmentPlan || '', data.disposition || '', data.diagnosis || '']
  );
  const consultationId = result.insertId;

  // Insert procedures
  if (data.procedures && data.procedures.length > 0) {
    for (const proc of data.procedures) {
      if (!proc.description) continue;
      await db.execute(
        `INSERT INTO consultation_procedures (consultationId, medCode, description, price, sessions, amount, netAmount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [consultationId, proc.medCode || '', proc.description || '',
         parseFloat(proc.price) || 0, parseInt(proc.sessions) || 1,
         parseFloat(String(proc.amount || '0').replace(/,/g, '')) || 0,
         parseFloat(String(proc.netAmount || '0').replace(/,/g, '')) || 0]
      );
    }
  }

  // Insert prescriptions
  if (data.prescriptions && data.prescriptions.length > 0) {
    for (const rx of data.prescriptions) {
      if (!rx.medicine) continue;
      await db.execute(
        `INSERT INTO consultation_prescriptions (consultationId, medicine, instructions, frequency, duration)
         VALUES (?, ?, ?, ?, ?)`,
        [consultationId, rx.medicine || '', rx.instructions || '', rx.frequency || '', rx.duration || '']
      );
    }
  }

  // Auto-generate claim + logsheet
  const claimId = await autoGenerateClaimAndLogsheet(consultationId, data);

  return { consultationId, claimId };
}

async function autoGenerateClaimAndLogsheet(consultationId, data) {
  const db = getPool();
  const procedures = data.procedures || [];

  // Generate claim ID
  const [countResult] = await db.execute('SELECT COUNT(*) as cnt FROM claims');
  const claimNum = (countResult[0].cnt || 0) + 918;
  const claimId = 'S-' + String(claimNum).padStart(4, '0');

  const fromDate = data.consultDate || '';
  let totalSessions = 0;
  let totalAmount = 0;
  for (const proc of procedures) {
    totalSessions += parseInt(proc.sessions) || 0;
    totalAmount += parseFloat(String(proc.amount || '0').replace(/,/g, '')) || 0;
  }

  // Calculate end date
  let toDate = fromDate;
  try {
    const parts = fromDate.split('-');
    const startDate = new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
    startDate.setDate(startDate.getDate() + totalSessions + 1);
    toDate = pad2(startDate.getDate()) + '-' + pad2(startDate.getMonth() + 1) + '-' + startDate.getFullYear();
  } catch (e) {}

  // Insert claim
  await db.execute(
    `INSERT INTO claims (claimId, mrNo, patientName, fromDate, toDate, amount, receivedAmount, consultationId)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [claimId, data.mrNo || '', data.patientName || '', fromDate, toDate, totalAmount, consultationId]
  );

  // Generate logsheet entries
  let slNo = 1;
  let currentDate;
  try {
    const parts = fromDate.split('-');
    currentDate = new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
  } catch (e) {
    currentDate = new Date();
  }

  // Consultation entry
  await db.execute(
    `INSERT INTO logsheet_entries (claimId, slNo, entryDate, treatmentDone, inTime, outTime, progress)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [claimId, slNo++, formatDateDot(currentDate), 'CONSULTATION FEE', '10:30 AM', '11:00 AM', data.examination || '']
  );
  currentDate.setDate(currentDate.getDate() + 1);

  // Treatment entries
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

      await db.execute(
        `INSERT INTO logsheet_entries (claimId, slNo, entryDate, treatmentDone, inTime, outTime, progress)
         VALUES (?, ?, ?, ?, ?, ?, '')`,
        [claimId, slNo++, formatDateDot(currentDate), desc, inTime, outTime]
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return claimId;
}

// ─── Logsheet ────────────────────────────────────────────────────

async function getLogsheetForClaim(claimId) {
  const db = getPool();
  const [claims] = await db.execute('SELECT * FROM claims WHERE claimId = ?', [claimId]);
  if (claims.length === 0) return null;
  const claim = claims[0];

  const [entries] = await db.execute('SELECT * FROM logsheet_entries WHERE claimId = ? ORDER BY slNo', [claimId]);

  let procedures = [];
  let prescriptions = [];
  if (claim.consultationId) {
    const [procs] = await db.execute('SELECT * FROM consultation_procedures WHERE consultationId = ?', [claim.consultationId]);
    const [rxs] = await db.execute('SELECT * FROM consultation_prescriptions WHERE consultationId = ?', [claim.consultationId]);
    procedures = procs;
    prescriptions = rxs;
  }

  return { claim, entries, procedures, prescriptions };
}

async function updateLogsheetEntry(claimId, slNo, data) {
  const db = getPool();
  await db.execute(
    'UPDATE logsheet_entries SET progress = ?, inTime = ?, outTime = ? WHERE claimId = ? AND slNo = ?',
    [data.progress || '', data.inTime || '', data.outTime || '', claimId, slNo]
  );
  return true;
}

// ─── Claims ──────────────────────────────────────────────────────

async function getAllClaims() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM claims ORDER BY createdAt DESC');
  return rows;
}

// ─── Insurance ───────────────────────────────────────────────────

async function saveInsuranceCompany(record) {
  const db = getPool();
  await db.execute(
    `INSERT INTO insurance_companies (code, type, providerId, name, phone, address, contactPerson, receiverCode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE type=VALUES(type), providerId=VALUES(providerId), name=VALUES(name),
     phone=VALUES(phone), address=VALUES(address), contactPerson=VALUES(contactPerson), receiverCode=VALUES(receiverCode)`,
    [record.code || '', record.type || 'DINS', record.providerId || '', record.name || '',
     record.phone || '', record.address || '', record.contactPerson || '', record.receiverCode || '']
  );
  return record;
}

async function getInsuranceCompanies() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM insurance_companies');
  return rows;
}

async function saveInsuranceMapping(mapping) {
  const db = getPool();
  await db.execute(
    'INSERT INTO insurance_mappings (type, receiverName, payerName) VALUES (?, ?, ?)',
    [mapping.type || 'IMAP', mapping.receiverName || '', mapping.payerName || '']
  );
  return mapping;
}

async function getInsuranceMappings() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM insurance_mappings');
  return rows;
}

// ─── Appointments ────────────────────────────────────────────────

async function saveAppointment(data) {
  const db = getPool();
  const today = new Date();
  const appointmentDate = pad2(today.getDate()) + '-' + pad2(today.getMonth() + 1) + '-' + today.getFullYear();

  await db.execute(
    `INSERT INTO appointments (mrNo, patientName, mobile, doctorName, appointmentDate, appointmentTime, status, room, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.mrNo || '', data.patient || '', data.mobile || '', data.doctor || '',
     appointmentDate, data.time || '', data.status || 'Booked', data.room || '', data.notes || '']
  );
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }
function formatDateDot(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }

function getDatabasePath() {
  return 'MySQL: localhost:3306/clinic_emr';
}

module.exports = {
  getPool,
  savePatient,
  getPatients,
  deletePatient,
  saveAppointment,
  saveConsultation,
  getLogsheetForClaim,
  updateLogsheetEntry,
  getAllClaims,
  saveInsuranceCompany,
  getInsuranceCompanies,
  saveInsuranceMapping,
  getInsuranceMappings,
  getDatabasePath
};
