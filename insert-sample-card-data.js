const mysql = require('mysql2/promise');

async function insertSampleCardData() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Inserting Sample Card Data for Testing Auto-Fill      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'clinic_emr',
      waitForConnections: true,
      connectionLimit: 5
    });

    console.log('✅ Connected to MySQL\n');

    // Sample card data - mimics what GlassReader would insert
    const sampleData = {
      readID: 'READ-' + Date.now(),
      cardReadDate: new Date().toISOString().split('T')[0],
      cardReadTime: new Date().toTimeString().split(' ')[0],
      fullNameEnglish: 'JOHN MATHEW',
      firstNameEnglish: 'JOHN',
      middleNameEnglish: 'C',
      lastNameEnglish: 'MATHEW',
      idNumber: '784-1995-1234567-2',
      issueDate: '2020-01-15',
      expiryDate: '2030-01-14',
      passportNumber: 'A12345678',
      passportIssueDate: '2019-06-20',
      passportExpiryDate: '2029-06-19',
      residencyNumber: 'RES-123456',
      residencyExpiryDate: '2026-12-31',
      homeMobilePhoneNumber: '+971501234567',
      workMobilePhoneNumber: '+971501234567',
      homeEmail: 'john.home@example.com',
      workEmail: 'john.work@example.com',
      dateOfBirth: '1995-05-12',
      gender: 'M',
      nationalityEnglish: 'India',
      nationalityArabic: 'الهند',
      occupationTypeEnglish: 'Software Engineer',
      occupationTypeArabic: 'مهندس برمجيات',
      companyNameEnglish: 'Tech Solutions LLC',
      companyNameArabic: 'حلول التكنولوجيا',
      sponsorName: 'Tech Solutions LLC',
      homeCityDescEnglish: 'Dubai',
      homeCityDescArabic: 'دبي'
    };

    // Insert into cardholder table
    const query = `
      INSERT INTO cardholder (
        readID, cardReadDate, cardReadTime, fullNameEnglish,
        firstNameEnglish, middleNameEnglish, lastNameEnglish,
        idNumber, issueDate, expiryDate,
        passportNumber, passportIssueDate, passportExpiryDate,
        residencyNumber, residencyExpiryDate,
        homeMobilePhoneNumber, workMobilePhoneNumber,
        homeEmail, workEmail,
        dateOfBirth, gender,
        nationalityEnglish, nationalityArabic,
        occupationTypeEnglish, occupationTypeArabic,
        companyNameEnglish, companyNameArabic,
        sponsorName, homeCityDescEnglish, homeCityDescArabic
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `;

    const values = [
      sampleData.readID, sampleData.cardReadDate, sampleData.cardReadTime, sampleData.fullNameEnglish,
      sampleData.firstNameEnglish, sampleData.middleNameEnglish, sampleData.lastNameEnglish,
      sampleData.idNumber, sampleData.issueDate, sampleData.expiryDate,
      sampleData.passportNumber, sampleData.passportIssueDate, sampleData.passportExpiryDate,
      sampleData.residencyNumber, sampleData.residencyExpiryDate,
      sampleData.homeMobilePhoneNumber, sampleData.workMobilePhoneNumber,
      sampleData.homeEmail, sampleData.workEmail,
      sampleData.dateOfBirth, sampleData.gender,
      sampleData.nationalityEnglish, sampleData.nationalityArabic,
      sampleData.occupationTypeEnglish, sampleData.occupationTypeArabic,
      sampleData.companyNameEnglish, sampleData.companyNameArabic,
      sampleData.sponsorName, sampleData.homeCityDescEnglish, sampleData.homeCityDescArabic
    ];

    const [result] = await pool.execute(query, values);
    
    console.log('✅ Sample card data inserted successfully!\n');
    console.log('📋 CARD DATA INSERTED:');
    console.log('═'.repeat(60));
    console.log(`   Name:         ${sampleData.firstNameEnglish} ${sampleData.middleNameEnglish} ${sampleData.lastNameEnglish}`);
    console.log(`   Emirates ID:  ${sampleData.idNumber}`);
    console.log(`   DOB:          ${sampleData.dateOfBirth}`);
    console.log(`   Gender:       ${sampleData.gender === 'M' ? 'Male' : 'Female'}`);
    console.log(`   Nationality:  ${sampleData.nationalityEnglish}`);
    console.log(`   Mobile:       ${sampleData.workMobilePhoneNumber}`);
    console.log(`   Email:        ${sampleData.workEmail}`);
    console.log(`   Passport:     ${sampleData.passportNumber}`);
    console.log(`   Company:      ${sampleData.companyNameEnglish}`);
    console.log('═'.repeat(60));

    console.log('\n✨ AUTO-FILL IS NOW READY!\n');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Go to: http://localhost:3000/clinic/clinic-emr.html');
    console.log('   2. Click "+ New" to create new patient');
    console.log('   3. Click "Auto-Fill from Card" button');
    console.log('   4. Form will instantly populate with this card data!\n');

    pool.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  MySQL is not running!');
      console.log('    1. Press Windows Key + R');
      console.log('    2. Type: services.msc');
      console.log('    3. Find MySQL80 → Right-click → Start');
      console.log('    4. Then run this script again');
    }
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n⚠️  clinic_emr database not found');
      console.log('    Database not set up yet');
    }
  }
}

insertSampleCardData();
