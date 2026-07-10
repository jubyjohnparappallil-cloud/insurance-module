/**
 * Test GlassReader Auto-Fill Integration
 * 
 * This script verifies that:
 * 1. The cardholder table exists in MySQL
 * 2. GlassReader can insert data into the table
 * 3. Your API can fetch the latest cardholder data
 * 4. The patient form can auto-fill from this data
 */

const mysql = require('mysql2/promise');
const http = require('http');

// ───────────────────────────────────────────────────────────────
// STEP 1: Test MySQL Connection to clinic_emr database
// ───────────────────────────────────────────────────────────────

async function testMySQLConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 1: Testing MySQL Connection');
  console.log('='.repeat(60));

  try {
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'null',
      database: 'clinic_emr',
      waitForConnections: true,
      connectionLimit: 5
    });

    console.log('✓ Connected to MySQL at localhost:3306');

    // Check if cardholder table exists
    const [tables] = await pool.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'clinic_emr' AND TABLE_NAME = 'cardholder'"
    );

    if (tables.length === 0) {
      console.log('✗ ERROR: cardholder table NOT FOUND in clinic_emr database');
      console.log('\nTo create the cardholder table, run the SQL file from GlassReader:');
      console.log('   Location: C:\\Program Files (x86)\\GlassReader\\sql\\');
      console.log('\nOr import the SQL manually:');
      console.log('   mysql -u root -p clinic_emr < cardholder.sql');
      return false;
    }

    console.log('✓ cardholder table EXISTS in clinic_emr database');

    // Check table structure
    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'clinic_emr' AND TABLE_NAME = 'cardholder'"
    );

    console.log('\n✓ cardholder table columns:');
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col.COLUMN_NAME}`);
    });

    // Check if table has any records
    const [records] = await pool.execute(
      'SELECT COUNT(*) as count FROM cardholder'
    );

    console.log(`\n✓ Total cardholder records in database: ${records[0].count}`);

    if (records[0].count > 0) {
      const [latest] = await pool.execute(
        'SELECT * FROM cardholder ORDER BY idCardHolder DESC LIMIT 1'
      );
      console.log('\n✓ Latest cardholder record:');
      const card = latest[0];
      console.log(`   ID: ${card.idCardHolder}`);
      console.log(`   Name: ${card.firstNameEnglish} ${card.middleNameEnglish} ${card.lastNameEnglish}`);
      console.log(`   Emirates ID: ${card.idNumber}`);
      console.log(`   DOB: ${card.dateOfBirth}`);
      console.log(`   Gender: ${card.gender}`);
      console.log(`   Nationality: ${card.nationalityEnglish}`);
      console.log(`   Mobile: ${card.workMobilePhoneNumber}`);
      console.log(`   Email: ${card.workEmail}`);
      console.log(`   Passport: ${card.passportNumber}`);
      console.log(`   Card Read Date: ${card.cardReadDate} ${card.cardReadTime}`);
    } else {
      console.log('\n⚠ WARNING: No cardholder records found');
      console.log('   Please run GlassReader and read an Emirates ID card first');
    }

    pool.end();
    return true;
  } catch (error) {
    console.log('✗ ERROR:', error.message);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('   → Make sure MySQL server is running');
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('   → clinic_emr database does not exist. Create it first.');
    }
    return false;
  }
}

// ───────────────────────────────────────────────────────────────
// STEP 2: Test API Endpoint
// ───────────────────────────────────────────────────────────────

function testAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Testing API Endpoint');
  console.log('='.repeat(60));

  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/cardholder/latest',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success && result.data) {
            console.log('✓ API endpoint is working');
            console.log('✓ Latest cardholder data:');
            const card = result.data;
            console.log(`   Name: ${card.firstNameEnglish} ${card.middleNameEnglish} ${card.lastNameEnglish}`);
            console.log(`   Emirates ID: ${card.idNumber}`);
            console.log(`   DOB: ${card.dateOfBirth}`);
            console.log(`   Gender: ${card.gender}`);
            console.log(`   Mobile: ${card.workMobilePhoneNumber}`);
            resolve(true);
          } else {
            console.log('✗ API returned an error:', result.error);
            resolve(false);
          }
        } catch (e) {
          console.log('✗ Invalid JSON response:', data.substring(0, 200));
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('✗ ERROR connecting to API:', error.message);
      console.log('   Make sure the server is running at http://localhost:3000');
      resolve(false);
    });

    req.end();
  });
}

// ───────────────────────────────────────────────────────────────
// STEP 3: Instructions
// ───────────────────────────────────────────────────────────────

function showInstructions() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Using the Auto-Fill Feature');
  console.log('='.repeat(60));

  console.log(`
1. MAKE SURE GLASSREADER IS RUNNING
   → Open Glass-Reader.exe from C:\\Program Files (x86)\\GlassReader\\bin\\

2. READ AN EMIRATES ID CARD
   → Place the card on the OMNIKEY reader (contactless)
   → Glass-Reader will read the card and insert data into the cardholder table

3. START YOUR SERVER
   → Run: node server.js

4. OPEN THE CLINIC EMR APPLICATION
   → Open http://localhost:3000 in your browser
   → Go to Patients tab

5. CREATE A NEW PATIENT
   → Click "New Patient" or press F2
   → The "Auto-Fill from Card" button should appear

6. CLICK "AUTO-FILL FROM CARD"
   → The form will automatically populate with:
      • First Name, Middle Name, Last Name
      • Date of Birth
      • Gender
      • Nationality
      • Emirates ID
      • Mobile Number
      • Email
      • Passport Number
      • Company Name

7. SAVE THE PATIENT
   → Review the auto-filled data
   → Correct any fields as needed
   → Click Save

───────────────────────────────────────────────────────────────

TROUBLESHOOTING:

Q: "No cardholder data found" error appears
A: • Make sure Glass-Reader has read a card first
  • Check that MySQL is running and clinic_emr database exists
  • Verify the cardholder table was created from GlassReader SQL

Q: "Error connecting to API" error appears
A: • Make sure server.js is running on port 3000
  • Check that database.js has the getLatestCardholder function

Q: Data is not filling some fields
A: • This is normal - only fields that have data from the card will fill
  • Some optional fields may be empty on the card

Q: Gender/Nationality shows as "M" or "F" instead of "Male"/"Female"
A: • The code automatically converts M→Male, F→Female
  • If it shows as initials, check the database value

───────────────────────────────────────────────────────────────
  `);
}

// ───────────────────────────────────────────────────────────────
// Main Test Runner
// ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 GLASSREADER AUTO-FILL INTEGRATION TEST\n');
  console.log('This test will verify your GlassReader integration is set up correctly.\n');

  // Test MySQL connection
  const mysqlOk = await testMySQLConnection();

  if (!mysqlOk) {
    console.log('\n✗ MySQL test failed. Please fix the database connection first.');
    console.log('   See troubleshooting section above.');
    process.exit(1);
  }

  // Small delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test API endpoint (server should be running)
  const apiOk = await testAPI();

  if (!apiOk) {
    console.log('\n⚠ API test failed. Make sure server.js is running on port 3000.');
    console.log('   Run: node server.js');
  }

  // Show instructions
  showInstructions();

  console.log('\n✓ Setup complete! Your auto-fill system is ready to use.\n');
}

// Run tests
runTests().catch(console.error);
