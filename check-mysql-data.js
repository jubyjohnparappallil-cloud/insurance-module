const mysql = require('mysql2/promise');

async function connectWithRetry(maxRetries = 10, delayMs = 2000) {
  console.log('\n🔄 Attempting to connect to MySQL...\n');

  for (let i = 1; i <= maxRetries; i++) {
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

      // Try a simple query
      const [result] = await pool.execute('SELECT 1 as connected');
      console.log(`✅ Connected to MySQL! (Attempt ${i}/${maxRetries})`);

      // Now check cardholder data
      const [countResult] = await pool.execute('SELECT COUNT(*) as cnt FROM cardholder');
      const totalRecords = countResult[0].cnt;

      console.log(`\n📊 Total cardholder records: ${totalRecords}`);

      if (totalRecords === 0) {
        console.log('\n⚠️  NO DATA IN CARDHOLDER TABLE');
        console.log('\nNext steps:');
        console.log('1. Open GlassReader: C:\\Program Files (x86)\\GlassReader\\bin\\');
        console.log('2. Place Emirates ID card ON TOP of OMNIKEY 3121 reader');
        console.log('3. Wait for GlassReader to read the card');
        console.log('4. Run this script again to see the data\n');
      } else {
        console.log('\n✅ CARD DATA FOUND!\n');
        
        const [rows] = await pool.execute(`
          SELECT 
            idCardHolder, readID, cardReadDate, cardReadTime,
            firstNameEnglish, middleNameEnglish, lastNameEnglish,
            idNumber, dateOfBirth, gender, nationalityEnglish,
            workMobilePhoneNumber, workEmail, passportNumber, companyNameEnglish
          FROM cardholder 
          ORDER BY idCardHolder DESC 
          LIMIT 1
        `);

        if (rows.length > 0) {
          const card = rows[0];
          console.log('📋 LATEST CARD DATA:');
          console.log('═'.repeat(50));
          console.log(`   Read Date:    ${card.cardReadDate} ${card.cardReadTime}`);
          console.log(`   Name:         ${card.firstNameEnglish} ${card.middleNameEnglish} ${card.lastNameEnglish}`);
          console.log(`   Emirates ID:  ${card.idNumber}`);
          console.log(`   DOB:          ${card.dateOfBirth}`);
          console.log(`   Gender:       ${card.gender}`);
          console.log(`   Nationality:  ${card.nationalityEnglish}`);
          console.log(`   Mobile:       ${card.workMobilePhoneNumber}`);
          console.log(`   Email:        ${card.workEmail}`);
          console.log(`   Passport:     ${card.passportNumber}`);
          console.log(`   Company:      ${card.companyNameEnglish}`);
          console.log('═'.repeat(50));
          
          console.log('\n✅ AUTO-FILL READY!');
          console.log('\nNow go to: http://localhost:3000/clinic/clinic-emr.html');
          console.log('1. Click "+ New" to create new patient');
          console.log('2. Click "Auto-Fill from Card" button');
          console.log('3. Form will populate with this data!\n');
        }
      }

      pool.end();
      return true;

    } catch (error) {
      if (i < maxRetries) {
        console.log(`⏳ Attempt ${i}/${maxRetries} failed... Waiting ${delayMs/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`❌ Could not connect after ${maxRetries} attempts`);
        console.error(`   Error: ${error.code} - ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
          console.log('\n🔧 TROUBLESHOOTING:');
          console.log('   1. Make sure MySQL is installed');
          console.log('   2. Try starting MySQL manually:');
          console.log('      "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe"');
          console.log('   3. Or use Windows Services to start MySQL80');
        }
      }
    }
  }
}

connectWithRetry();
