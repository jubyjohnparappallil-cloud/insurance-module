-- ═══════════════════════════════════════════════════════════════
-- CLINIC EMR DATABASE STRUCTURE
-- Run this in MySQL Workbench after creating schema 'clinic_emr'
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS clinic_emr;
USE clinic_emr;

-- ─── PATIENTS TABLE ──────────────────────────────────────────────
CREATE TABLE patients (
  mrNo VARCHAR(10) PRIMARY KEY,
  regDate VARCHAR(20),
  firstName VARCHAR(100),
  middleName VARCHAR(100),
  lastName VARCHAR(100),
  gender ENUM('Male', 'Female') DEFAULT 'Male',
  mobile VARCHAR(20),
  referral VARCHAR(100),
  nationality VARCHAR(50),
  dob VARCHAR(20),
  eid VARCHAR(30),
  city VARCHAR(50),
  area VARCHAR(100),
  address TEXT,
  emirate VARCHAR(50),
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  language VARCHAR(30) DEFAULT 'English',
  category ENUM('General', 'Insurance', 'Package', 'Corporate') DEFAULT 'General',
  know VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── INSURANCE COMPANIES ─────────────────────────────────────────
CREATE TABLE insurance_companies (
  code VARCHAR(20) PRIMARY KEY,
  type VARCHAR(10) DEFAULT 'DINS',
  providerId VARCHAR(20),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  contactPerson VARCHAR(100),
  receiverCode VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── INSURANCE MAPPING ───────────────────────────────────────────
CREATE TABLE insurance_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(10) DEFAULT 'IMAP',
  receiverName VARCHAR(150),
  payerName VARCHAR(150),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CONSULTATIONS ───────────────────────────────────────────────
CREATE TABLE consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mrNo VARCHAR(10) NOT NULL,
  patientName VARCHAR(200),
  consultDate VARCHAR(20),
  chiefComplaints TEXT,
  pastHistory TEXT,
  presentIllness TEXT,
  examination TEXT,
  treatmentPlan TEXT,
  disposition TEXT,
  diagnosis TEXT,
  doctorName VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CONSULTATION PROCEDURES ─────────────────────────────────────
CREATE TABLE consultation_procedures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consultationId INT NOT NULL,
  medCode VARCHAR(20),
  description VARCHAR(200),
  price DECIMAL(10,2) DEFAULT 0,
  sessions INT DEFAULT 1,
  amount DECIMAL(10,2) DEFAULT 0,
  discAmount DECIMAL(10,2) DEFAULT 0,
  vatAmount DECIMAL(10,2) DEFAULT 0,
  netAmount DECIMAL(10,2) DEFAULT 0,
  patientShare DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (consultationId) REFERENCES consultations(id)
);

-- ─── CONSULTATION PRESCRIPTIONS ──────────────────────────────────
CREATE TABLE consultation_prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consultationId INT NOT NULL,
  medicine VARCHAR(200),
  instructions VARCHAR(200),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  FOREIGN KEY (consultationId) REFERENCES consultations(id)
);

-- ─── CLAIMS ──────────────────────────────────────────────────────
CREATE TABLE claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claimId VARCHAR(20) UNIQUE NOT NULL,
  mrNo VARCHAR(10) NOT NULL,
  patientName VARCHAR(200),
  fromDate VARCHAR(20),
  toDate VARCHAR(20),
  amount DECIMAL(10,2) DEFAULT 0,
  receivedAmount DECIMAL(10,2) DEFAULT 0,
  consultationId INT,
  status ENUM('Pending', 'Submitted', 'Approved', 'Rejected') DEFAULT 'Pending',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mrNo) REFERENCES patients(mrNo),
  FOREIGN KEY (consultationId) REFERENCES consultations(id)
);

-- ─── LOGSHEET ENTRIES ────────────────────────────────────────────
CREATE TABLE logsheet_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claimId VARCHAR(20) NOT NULL,
  slNo INT,
  entryDate VARCHAR(20),
  treatmentDone VARCHAR(200),
  inTime VARCHAR(20),
  outTime VARCHAR(20),
  progress TEXT,
  therapist VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── APPOINTMENTS ────────────────────────────────────────────────
CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mrNo VARCHAR(10),
  patientName VARCHAR(200),
  mobile VARCHAR(20),
  doctorName VARCHAR(100),
  appointmentDate VARCHAR(20),
  appointmentTime VARCHAR(20),
  status ENUM('Booked', 'Confirmed', 'Arrived', 'Consulted', 'Cancelled', 'No Show') DEFAULT 'Booked',
  room VARCHAR(50),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── RECEIPTS ────────────────────────────────────────────────────
CREATE TABLE receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receiptNo VARCHAR(20) UNIQUE,
  receiptDate VARCHAR(20),
  type ENUM('Advance', 'Due', 'Package') DEFAULT 'Advance',
  mrNo VARCHAR(10),
  patientName VARCHAR(200),
  amount DECIMAL(10,2) DEFAULT 0,
  mode ENUM('Cash', 'Card', 'Online', 'Insurance') DEFAULT 'Cash',
  status ENUM('Collected', 'Pending') DEFAULT 'Collected',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── PACKAGES ────────────────────────────────────────────────────
CREATE TABLE packages (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  sessions INT DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── DOCTORS / THERAPISTS ────────────────────────────────────────
CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  licenseNo VARCHAR(50),
  phone VARCHAR(20),
  status ENUM('Active', 'Inactive') DEFAULT 'Active'
);

-- ─── TARIFF MASTER ───────────────────────────────────────────────
CREATE TABLE tariff_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20),
  description VARCHAR(200),
  category VARCHAR(50),
  price DECIMAL(10,2) DEFAULT 0,
  insurancePrice DECIMAL(10,2) DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════
-- DONE! Your database structure is ready.
-- ═══════════════════════════════════════════════════════════════
