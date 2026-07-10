const mysql = require('mysql2/promise');

async function createPatientsTable() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'clinic_emr',
    connectionLimit: 1
  });

  try {
    const sql = `CREATE TABLE IF NOT EXISTS patients (
      mrNo VARCHAR(50) PRIMARY KEY,
      recordNo VARCHAR(50),
      firstName VARCHAR(100),
      middleName VARCHAR(100),
      lastName VARCHAR(100),
      gender VARCHAR(20),
      mobile VARCHAR(20),
      email VARCHAR(100),
      passport VARCHAR(50),
      marital VARCHAR(20),
      nationality VARCHAR(50),
      job VARCHAR(100),
      company VARCHAR(100),
      whatsapp VARCHAR(20),
      homeTel VARCHAR(20),
      referral VARCHAR(100),
      notes TEXT,
      know VARCHAR(100),
      regDate VARCHAR(20),
      vip BOOLEAN DEFAULT FALSE,
      pregnant BOOLEAN DEFAULT FALSE,
      medication BOOLEAN DEFAULT FALSE,
      years INT,
      months INT,
      days INT,
      dob VARCHAR(20),
      city VARCHAR(100),
      area VARCHAR(100),
      address VARCHAR(200),
      poBox VARCHAR(50),
      emirate VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Active',
      language VARCHAR(50) DEFAULT 'English',
      category VARCHAR(50) DEFAULT 'General',
      packageName VARCHAR(100),
      packageStart VARCHAR(20),
      packageVisits INT DEFAULT 0,
      packageBalance INT DEFAULT 0,
      photoData LONGTEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    await pool.execute(sql);
    console.log('✅ Patients table created successfully');
  } catch (error) {
    console.log('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

createPatientsTable();
