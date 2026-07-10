#!/bin/bash
# Quick Verification Checklist for GlassReader Auto-Fill

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  GLASSREADER AUTO-FILL SETUP VERIFICATION CHECKLIST        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check 1: MySQL Running
echo "1️⃣  Checking MySQL Server..."
mysql -u root ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ MySQL is running"
else
    echo "   ❌ MySQL is NOT running"
    echo "      → Start MySQL service"
fi
echo ""

# Check 2: clinic_emr Database
echo "2️⃣  Checking clinic_emr Database..."
mysql -u root -e "USE clinic_emr;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ clinic_emr database exists"
else
    echo "   ❌ clinic_emr database NOT found"
    echo "      → Create database: mysql -u root -e 'CREATE DATABASE clinic_emr;'"
fi
echo ""

# Check 3: Cardholder Table
echo "3️⃣  Checking cardholder Table..."
mysql -u root clinic_emr -e "SHOW TABLES LIKE 'cardholder';" | grep cardholder > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ cardholder table exists"
    # Show record count
    COUNT=$(mysql -u root clinic_emr -e "SELECT COUNT(*) FROM cardholder;" | tail -1)
    echo "      Records in cardholder: $COUNT"
else
    echo "   ❌ cardholder table NOT found"
    echo "      → Import from: C:\\Program Files (x86)\\GlassReader\\sql\\"
fi
echo ""

# Check 4: Node.js Running
echo "4️⃣  Checking Node.js Server..."
curl -s http://localhost:3000 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Server is running on port 3000"
else
    echo "   ❌ Server is NOT running"
    echo "      → Start server: node server.js"
fi
echo ""

# Check 5: API Endpoint
echo "5️⃣  Checking API Endpoint..."
RESPONSE=$(curl -s http://localhost:3000/api/cardholder/latest)
if echo "$RESPONSE" | grep -q "success"; then
    echo "   ✅ API endpoint is working"
    if echo "$RESPONSE" | grep -q '"data"'; then
        echo "      ✅ Cardholder data available"
    else
        echo "      ⚠️  API working but no data yet"
        echo "         → Read a card with GlassReader first"
    fi
else
    echo "   ❌ API endpoint not responding correctly"
fi
echo ""

# Check 6: Required Files
echo "6️⃣  Checking Required Files..."
if [ -f "database.js" ]; then
    echo "   ✅ database.js exists"
    if grep -q "getLatestCardholder" database.js; then
        echo "      ✅ getLatestCardholder function found"
    else
        echo "      ❌ getLatestCardholder function NOT found"
    fi
else
    echo "   ❌ database.js NOT found"
fi

if [ -f "server.js" ]; then
    echo "   ✅ server.js exists"
    if grep -q "/api/cardholder/latest" server.js; then
        echo "      ✅ API endpoint found"
    else
        echo "      ❌ API endpoint NOT found"
    fi
else
    echo "   ❌ server.js NOT found"
fi

if [ -f "clinic/clinic-emr.html" ]; then
    echo "   ✅ clinic-emr.html exists"
    if grep -q "autoFillPatientFromCard" clinic/clinic-emr.html; then
        echo "      ✅ Auto-fill function found"
    else
        echo "      ❌ Auto-fill function NOT found"
    fi
else
    echo "   ❌ clinic-emr.html NOT found"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  NEXT STEPS:                                               ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  1. Ensure all ✅ checks are passing                       ║"
echo "║  2. Read an Emirates ID card with GlassReader              ║"
echo "║  3. Open http://localhost:3000 in browser                  ║"
echo "║  4. Go to Patients → New Patient                           ║"
echo "║  5. Click 'Auto-Fill from Card' button                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
