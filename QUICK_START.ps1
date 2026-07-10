#!/usr/bin/env powershell
# Quick Setup Checklist for GlassReader Auto-Fill

Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     GLASSREADER AUTO-FILL QUICK START CHECKLIST        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📋 CHECKLIST:" -ForegroundColor Cyan

$checks = @(
    @{ Name = "MySQL80 Service Running"; Cmd = { (Get-Service -Name MySQL80 -ErrorAction SilentlyContinue).Status -eq 'Running' } },
    @{ Name = "Node.js Server Running"; Cmd = { (Test-NetConnection localhost -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded } },
    @{ Name = "Clinic EMR Accessible"; Cmd = { (Invoke-WebRequest http://localhost:3000/clinic/clinic-emr.html -WarningAction SilentlyContinue).StatusCode -eq 200 } },
    @{ Name = "GlassReader Process Running"; Cmd = { Get-Process -Name "GlassReader" -ErrorAction SilentlyContinue | Out-Null; $? } }
)

foreach ($check in $checks) {
    try {
        $result = & $check.Cmd
        $status = if ($result) { "✅ YES" } else { "❌ NO" }
        $color = if ($result) { "Green" } else { "Red" }
        Write-Host "  $status  $($check.Name)" -ForegroundColor $color
    } catch {
        Write-Host "  ⚠️  $($check.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`n🚀 REQUIRED STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  START MYSQL" -ForegroundColor Yellow
Write-Host "    Press Windows Key + R"
Write-Host "    Type: services.msc"
Write-Host "    Find: MySQL80 → Right-click → Start"
Write-Host "    ⏳ Wait until status shows 'Running'"
Write-Host ""

Write-Host "2️⃣  VERIFY MySQL Connection" -ForegroundColor Yellow
Write-Host "    Run: node check-mysql-data.js"
Write-Host "    Should show: ✅ Connected to MySQL!"
Write-Host ""

Write-Host "3️⃣  OPEN GLASSREADER" -ForegroundColor Yellow
Write-Host "    Path: C:\Program Files (x86)\GlassReader\bin\GlassReader.exe"
Write-Host "    Click: Start Reading"
Write-Host ""

Write-Host "4️⃣  READ EMIRATES ID CARD" -ForegroundColor Yellow
Write-Host "    Place card ON TOP of OMNIKEY 3121 reader"
Write-Host "    ⏳ Wait for GlassReader to read"
Write-Host ""

Write-Host "5️⃣  VERIFY CARD DATA SAVED" -ForegroundColor Yellow
Write-Host "    Run: node check-mysql-data.js"
Write-Host "    Should show: 📋 LATEST CARD DATA:"
Write-Host ""

Write-Host "6️⃣  TEST AUTO-FILL FEATURE" -ForegroundColor Yellow
Write-Host "    Open: http://localhost:3000/clinic/clinic-emr.html"
Write-Host "    Click: + New (Patient)"
Write-Host "    Click: Auto-Fill from Card (green button)"
Write-Host "    ✨ Form auto-fills with card data!"
Write-Host ""

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "Once all steps complete, your auto-fill system is ready! 🎉" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
