# ⚠️ GlassReader Setup Troubleshooting

## Issue: ECONNREFUSED - MySQL Not Running

Your system tried to connect to MySQL but the server is not responding on `localhost:3306`.

---

## 🔧 Fix: Start MySQL Server

### Option 1: Start MySQL Service (Windows)

```bash
# Open Command Prompt as Administrator and run:
net start MySQL80
# or
net start MySQL

# You should see: "The MySQL80 service is starting..... The MySQL80 service has been started successfully."
```

### Option 2: Start MySQL from Services

1. Press `Windows Key + R`
2. Type: `services.msc`
3. Find "MySQL80" or "MySQL" in the list
4. Right-click → "Start"

### Option 3: Start MySQL Server manually

```bash
# If MySQL is installed in default location:
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
```

---

## ✅ Verify MySQL is Running

Run this command in PowerShell:

```bash
# This should connect without error if MySQL is running
node -e "const mysql = require('mysql2/promise'); mysql.createPool({host:'localhost',user:'root',password:''}).getConnection().then(c=>{c.release(); console.log('✓ MySQL is running!')}).catch(e=>console.log('✗ MySQL not running:',e.message))"
```

---

## 📋 Complete GlassReader Setup Workflow

1. **✓ Start MySQL** (see steps above)
2. **✓ Verify clinic_emr database exists**
3. **✓ Start Node.js Server**
   ```bash
   node server.js
   ```
4. **✓ Open GlassReader**
   - Location: `C:\Program Files (x86)\GlassReader\bin\GlassReader.exe`
5. **✓ Read Emirates ID Card**
   - Place card ON TOP of OMNIKEY 3121 reader (contactless)
   - Wait for GlassReader to read and display data
6. **✓ Verify Card Data Saved**
   ```bash
   node check-card-data.js
   ```
7. **✓ Go to Clinic EMR**
   - Open: `http://localhost:3000/clinic/clinic-emr.html`
8. **✓ Create New Patient**
   - Click "+ New" in Patients section
   - Click "Auto-Fill from Card" button
   - Form will populate with card data

---

## 🆘 Still Having Issues?

### Check 1: MySQL Database Exists
```bash
# Once MySQL is running, verify the database:
node -e "
const mysql = require('mysql2/promise');
mysql.createPool({host:'localhost',user:'root',password:''})
  .query('SHOW DATABASES LIKE \"clinic_emr\"')
  .then(([rows])=>console.log(rows.length ? '✓ Database exists' : '✗ Database not found'))
  .catch(e=>console.log('Error:',e.message));
"
```

### Check 2: Cardholder Table Exists
```bash
# Once MySQL and database are running:
node check-card-data.js
```

### Check 3: GlassReader Data
- Open GlassReader application
- Check if it shows "Ready" status
- Try reading a card again
- Check GlassReader logs for errors

### Check 4: Server is Running
```bash
# In another terminal, check if server is accessible:
node -e "
const http = require('http');
http.get('http://localhost:3000/api/cardholder/latest', (res)=>{
  console.log('✓ Server is running');
  res.on('data', ()=>{});
}).on('error', (e)=>console.log('✗ Server not running:', e.message));
"
```

---

## 📞 Common Issues

| Issue | Solution |
|-------|----------|
| ECONNREFUSED on port 3306 | MySQL server not running - see "Start MySQL Server" above |
| "Unknown database 'clinic_emr'" | Create database: See clinic setup guide |
| "No cardholder data found" | Read a card with GlassReader first |
| Form not filling after button click | Verify card data was written: `node check-card-data.js` |
| "Cannot connect to GlassReader" | Make sure GlassReader.exe is running |

---

## Next Steps

1. Start MySQL server
2. Verify it's running
3. Run: `node check-card-data.js`
4. Report any errors

Good luck! 🎉
