# GlassReader Auto-Fill Integration - Setup Guide

## ✅ What Has Been Implemented

Your patient registration form now has **automatic data population from GlassReader** (Emirates ID card reader).

### Files Modified:
1. **database.js** - Added `getLatestCardholder()` function to fetch latest card data from MySQL
2. **server.js** - Added `/api/cardholder/latest` endpoint 
3. **clinic/clinic-emr.html** - Added "Auto-Fill from Card" button and JavaScript function

---

## 🔧 Setup Steps

### Step 1: Ensure MySQL Database Exists
```bash
# Verify clinic_emr database exists with cardholder table
mysql -u root -p clinic_emr

# Show all tables
SHOW TABLES;

# You should see: cardholder table
```

If the cardholder table is missing, import it from GlassReader:
```
Location: C:\Program Files (x86)\GlassReader\sql\
File: cardholder.sql (or similar)
```

### Step 2: Start Services in Order
```bash
# Terminal 1: Start MySQL (should already be running)
# Verify: mysql -u root ping

# Terminal 2: Start Node.js Server
node server.js

# You should see:
# 🏥  Branch : Insurance System
# 📁  DB     : clinic-data.json
# 🌐  Port   : 3000
```

### Step 3: Prepare GlassReader
1. Open GlassReader from: `C:\Program Files (x86)\GlassReader\bin\GlassReader.exe`
2. Place an **Emirates ID card ON TOP** of the OMNIKEY reader (contactless)
3. GlassReader will read the card and insert data into the `cardholder` table

### Step 4: Open Clinic EMR
- Open browser: `http://localhost:3000`
- Navigate to **Patients** tab

### Step 5: Create New Patient
- Click **"New Patient"** button OR press **F2**
- The patient registration dialog will open
- You'll see the **"Auto-Fill from Card"** button in the bottom toolbar

### Step 6: Auto-Fill Patient Data
1. Click the green **"Auto-Fill from Card"** button
2. The form will automatically fill with:
   - ✅ First Name, Middle Name, Last Name
   - ✅ Date of Birth
   - ✅ Gender (Male/Female)
   - ✅ Nationality
   - ✅ Emirates ID Number
   - ✅ Mobile Number
   - ✅ Email Address
   - ✅ Passport Number
   - ✅ Company Name
   - ✅ Age (Years/Months/Days) - auto-calculated

3. Review the auto-filled data
4. Correct any fields as needed
5. Click **"Save"** to create the patient record

---

## 🧪 Testing

Run the test script to verify everything is working:

```bash
node test-glassreader-autofill.js
```

This will:
1. ✓ Test MySQL connection
2. ✓ Verify cardholder table exists
3. ✓ Check for sample data
4. ✓ Test API endpoint
5. ✓ Show detailed instructions

---

## 🚨 Troubleshooting

### Problem: "No cardholder data found"
**Solution:**
- Ensure GlassReader has read a card first
- Check MySQL is running: `mysql -u root ping`
- Verify cardholder table exists: `SHOW TABLES;`

### Problem: "Error connecting to API"
**Solution:**
- Make sure `node server.js` is running on port 3000
- Check console for error messages
- Restart the server if needed

### Problem: Form shows "Loading..." but never completes
**Solution:**
- Check browser console (F12) for JavaScript errors
- Verify API endpoint is accessible: Open `http://localhost:3000/api/cardholder/latest`
- Check server console for error logs

### Problem: "Cardholder table not found"
**Solution:**
- You need to import the cardholder table structure
- Go to: `C:\Program Files (x86)\GlassReader\sql\`
- Find the SQL file that creates the cardholder table
- Import it: `mysql -u root clinic_emr < cardholder.sql`

### Problem: Data fills but some fields are empty
**Solution:**
- This is normal - only populated card fields will auto-fill
- Some fields on the card may be empty
- You can manually fill remaining fields before saving

### Problem: Gender shows "M" instead of "Male"
**Solution:**
- The conversion is automatic (M→Male, F→Female)
- If showing initials, there may be a database formatting issue
- Check the cardholder table for the gender column value

---

## 📋 API Reference

### Endpoint: GET `/api/cardholder/latest`

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "idCardHolder": 1,
    "readID": "...",
    "cardReadDate": "2026-07-08",
    "cardReadTime": "14:30:00",
    "fullNameEnglish": "John Mathew",
    "firstNameEnglish": "John",
    "middleNameEnglish": "C",
    "lastNameEnglish": "Mathew",
    "idNumber": "784-1995-1234567-2",
    "dateOfBirth": "1993-05-12",
    "gender": "M",
    "nationalityEnglish": "India",
    "workMobilePhoneNumber": "+971501234567",
    "workEmail": "john@example.com",
    "passportNumber": "A12345678",
    "companyNameEnglish": "Tech Solutions LLC",
    ...
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "No cardholder data found"
}
```

---

## 📊 Database Schema

The cardholder table contains these key fields:

| Field | Type | Description |
|-------|------|-------------|
| idCardHolder | INT | Primary Key |
| readID | VARCHAR | Unique read ID |
| cardReadDate | DATE | When card was read |
| cardReadTime | TIME | Time of read |
| firstNameEnglish | VARCHAR | First name |
| middleNameEnglish | VARCHAR | Middle name |
| lastNameEnglish | VARCHAR | Last name |
| idNumber | VARCHAR | Emirates ID |
| dateOfBirth | DATE | Birth date |
| gender | CHAR | M or F |
| nationalityEnglish | VARCHAR | Nationality |
| workMobilePhoneNumber | VARCHAR | Work mobile |
| workEmail | VARCHAR | Work email |
| passportNumber | VARCHAR | Passport # |
| companyNameEnglish | VARCHAR | Company name |

---

## 💡 Tips

1. **Keyboard Shortcut:** Press **F2** to quickly create a new patient
2. **Auto-Fill Buttons:** The "Auto-Fill from Card" button only works after a card has been read
3. **Date Format:** Dates are automatically converted to DD/MMM/YYYY format (e.g., 12/May/1993)
4. **Error Messages:** Watch for helpful error messages in the dialog if something goes wrong
5. **Multiple Cards:** If you read multiple cards, the latest one is always used for auto-fill

---

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Run the test script: `node test-glassreader-autofill.js`
3. Check browser console: Press **F12** → **Console** tab
4. Check server console for error logs
5. Verify all three services are running: MySQL, Node.js Server, GlassReader

---

**Last Updated:** 2026-07-08
**Version:** 1.0
**Status:** ✅ Ready for Production
