const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startupFile = process.argv.includes('--insurance') ? 'insurance-only.html' : 'index.html';
  mainWindow.loadFile(startupFile);
}

app.whenReady().then(() => {
  createWindow();
  setupIPC();
});

function setupIPC() {
  const database = require('./database');

  // ─── Patient ─────────────────────────────────────────────────
  ipcMain.handle('save-patient', async (event, data) => {
    try {
      const result = await database.savePatient(data);
      return { success: true, data: result };
    } catch (err) {
      console.error('save-patient error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-patients', async () => {
    try {
      const data = await database.getPatients();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-patient', async (event, mrNo) => {
    try {
      await database.deletePatient(mrNo);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Appointment ──────────────────────────────────────────────
  ipcMain.handle('save-appointment', async (event, data) => {
    try {
      const result = await database.saveAppointment(data);
      return { success: true, data: result };
    } catch (err) {
      console.error('save-appointment error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ─── Consultation ────────────────────────────────────────────
  ipcMain.handle('save-consultation', async (event, data) => {
    try {
      const result = await database.saveConsultation(data);
      return { success: true, ...result };
    } catch (err) {
      console.error('save-consultation error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ─── Logsheet ────────────────────────────────────────────────
  ipcMain.handle('get-logsheet', async (event, claimId) => {
    try {
      const result = await database.getLogsheetForClaim(claimId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update-logsheet-entry', async (event, claimId, slNo, data) => {
    try {
      await database.updateLogsheetEntry(claimId, slNo, data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Claims ──────────────────────────────────────────────────
  ipcMain.handle('get-claims', async () => {
    try {
      const data = await database.getAllClaims();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Insurance ───────────────────────────────────────────────
  ipcMain.handle('save-insurance', async (event, record) => {
    try {
      const result = await database.saveInsuranceCompany(record);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-insurance-companies', async () => {
    try {
      const data = await database.getInsuranceCompanies();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-insurance-mapping', async (event, mapping) => {
    try {
      const result = await database.saveInsuranceMapping(mapping);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-insurance-mappings', async () => {
    try {
      const data = await database.getInsuranceMappings();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get last prescription for a patient ────────────────────
  ipcMain.handle('get-last-prescription', async (event, mrNo) => {
    try {
      const pool = database.getPool();
      const [consults] = await pool.execute('SELECT id FROM consultations WHERE mrNo = ? ORDER BY createdAt DESC LIMIT 1', [mrNo]);
      if (consults.length === 0) return { success: true, data: [] };
      const [rxs] = await pool.execute('SELECT medicine, instructions, frequency, duration FROM consultation_prescriptions WHERE consultationId = ?', [consults[0].id]);
      return { success: true, data: rxs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Get last procedures for a patient (for invoice inherit) ──
  ipcMain.handle('get-last-procedures', async (event, mrNo) => {
    try {
      const pool = database.getPool();
      const [consults] = await pool.execute('SELECT id FROM consultations WHERE mrNo = ? ORDER BY createdAt DESC LIMIT 1', [mrNo]);
      if (consults.length === 0) return { success: true, data: [] };
      const [procs] = await pool.execute('SELECT medCode, description, price, sessions, amount, netAmount FROM consultation_procedures WHERE consultationId = ?', [consults[0].id]);
      return { success: true, data: procs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Database info ───────────────────────────────────────────
  ipcMain.handle('get-db-path', async () => {
    return { success: true, path: database.getDatabasePath() };
  });

  // ─── ICD Codes search ──────────────────────────────────────────
  const icdCodes = require('./icd-codes');
  ipcMain.handle('search-icd', async (event, query) => {
    const q = (query || '').toLowerCase();
    const results = icdCodes.filter(item =>
      item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    ).slice(0, 15);
    return { success: true, data: results };
  });
}
