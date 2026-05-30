const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clinicAPI', {
  // ─── Patient ─────────────────────────────────────────────────
  savePatient: (data) => ipcRenderer.invoke('save-patient', data),
  getPatients: () => ipcRenderer.invoke('get-patients'),
  deletePatient: (mrNo) => ipcRenderer.invoke('delete-patient', mrNo),

  // ─── Appointment ─────────────────────────────────────────────
  saveAppointment: (data) => ipcRenderer.invoke('save-appointment', data),

  // ─── Consultation (auto-generates claim + logsheet) ──────────
  saveConsultation: (data) => ipcRenderer.invoke('save-consultation', data),

  // ─── Logsheet ────────────────────────────────────────────────
  getLogsheet: (claimId) => ipcRenderer.invoke('get-logsheet', claimId),
  updateLogsheetEntry: (claimId, slNo, data) => ipcRenderer.invoke('update-logsheet-entry', claimId, slNo, data),

  // ─── Claims ──────────────────────────────────────────────────
  getClaims: () => ipcRenderer.invoke('get-claims'),

  // ─── Insurance ───────────────────────────────────────────────
  saveInsurance: (record) => ipcRenderer.invoke('save-insurance', record),
  getInsuranceCompanies: () => ipcRenderer.invoke('get-insurance-companies'),
  saveInsuranceMapping: (mapping) => ipcRenderer.invoke('save-insurance-mapping', mapping),
  getInsuranceMappings: () => ipcRenderer.invoke('get-insurance-mappings'),

  // ─── Database info ───────────────────────────────────────────
  getDbPath: () => ipcRenderer.invoke('get-db-path'),

  // ─── ICD Codes ─────────────────────────────────────────────────
  searchICD: (query) => ipcRenderer.invoke('search-icd', query),

  // ─── Prescription inherit ─────────────────────────────────────
  getLastPrescription: (mrNo) => ipcRenderer.invoke('get-last-prescription', mrNo),
  getLastProcedures: (mrNo) => ipcRenderer.invoke('get-last-procedures', mrNo)
});
