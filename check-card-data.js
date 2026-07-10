const mysql = require('mysql2/promise');

async function checkCardData() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Checking GlassReader Card Data        ║');
  console.log('╚════════════════════════════════════════╝\n');

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

    console.log('✓ Connected to MySQL clinic_emr database\n');

    // Check total records
    const [countResult] = await pool.execute('SELECT COUNT(*) as cnt FROM cardholder');
    const totalRecords = countResult[0].cnt;

    console.log(`📊 Total cardholder records: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log('\n⚠️  NO DATA FOUND in cardholder table');
      console.log('\nThis means GlassReader has not inserted any data yet.');
      console.log('\nTroubleshooting steps:');
      console.log('1. ✓ Open GlassReader from: C:\\Program Files (x86)\\GlassReader\\bin\\');
      console.log('2. ✓ Place Emirates ID card ON TOP of OMNIKEY 3121 reader (contactless)');
      console.log('3. ✓ Wait for GlassReader to detect and read the card');
      console.log('4. ✓ Check GlassReader application for any error messages');
      console.log('5. ✓ Then run this script again to verify data was saved\n');
      
      pool.end();
      return;
    }

    // Show latest record
    const [rows] = await pool.execute(`
      SELECT 
        idCardHolder,
        readID,
        cardReadDate,
        cardReadTime,
        fullNameEnglish,
        firstNameEnglish,
        middleNameEnglish,
        lastNameEnglish,
        idNumber,
        dateOfBirth,
        gender,
        nationalityEnglish,
        workMobilePhoneNumber,
        workEmail,
        passportNumber,
        companyNameEnglish
      FROM cardholder 
      ORDER BY idCardHolder DESC 
      LIMIT 1
    `);

    if (rows.length > 0) {
      const card = rows[0];
      console.log('\n✅ LATEST CARD DATA FOUND:\n');
      console.log(`   ID#:           ${card.idCardHolder}`);
      console.log(`   Read Date:     ${card.cardReadDate}`);
      console.log(`   Read Time:     ${card.cardReadTime}`);
      console.log(`   Name (EN):     ${card.firstNameEnglish} ${card.middleNameEnglish} ${card.lastNameEnglish}`);
      console.log(`   Emirates ID:   ${card.idNumber}`);
      console.log(`   DOB:           ${card.dateOfBirth}`);
      console.log(`   Gender:        ${card.gender}`);
      console.log(`   Nationality:   ${card.nationalityEnglish}`);
      console.log(`   Mobile:        ${card.workMobilePhoneNumber}`);
      console.log(`   Email:         ${card.workEmail}`);
      console.log(`   Passport:      ${card.passportNumber}`);
      console.log(`   Company:       ${card.companyNameEnglish}`);

      console.log('\n✅ Data is ready! Now:');
      console.log('   1. Go to http://localhost:3000/clinic/clinic-emr.html');
      console.log('   2. Create New Patient');
      console.log('   3. Click "Auto-Fill from Card" button');
      console.log('   4. Form will populate with the card data above\n');
    }

    pool.end();
  } catch (error) {
    console.error('❌ Error:', error.code || error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('\n⚠️  MySQL server is not running');
      console.log('   Please start MySQL and try again');
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n⚠️  clinic_emr database not found');
      console.log('   Create database first: mysql -u root -e "CREATE DATABASE clinic_emr;"');
    }
  }
}

checkCardData();
