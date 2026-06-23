/**
 * Build both desktop applications
 * Run: node build-apps.js
 * 
 * This will create:
 *   dist/Shanthi-Insurance-win32-x64/    (Insurance System .exe)
 *   dist/Shanthi-UserMgmt-win32-x64/     (User Management .exe)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Building Desktop Applications ===\n');

// Check if electron-packager is available
try {
  require.resolve('electron-packager');
} catch(e) {
  console.log('Installing electron-packager...');
  execSync('npm install electron-packager --save-dev', { stdio: 'inherit', cwd: __dirname });
}

const commonFiles = [
  'server.js', 'database.js', 'icd-codes.js', 'logo.png', 'package.json',
  'clinic-data.json', 'usermgmt-data.json', 'wellness-data.json',
  'customer-app.html', 'staff-portal.html', 'node_modules'
];

// Build Insurance App
console.log('\n📦 Building Insurance System...');
const pkgInsurance = {
  name: "shanthi-insurance",
  version: "1.0.0",
  main: "main-insurance.js",
  dependencies: JSON.parse(fs.readFileSync('package.json','utf8')).dependencies
};
fs.writeFileSync('package-insurance.json', JSON.stringify(pkgInsurance, null, 2));

try {
  execSync(
    'npx electron-packager . "Shanthi-Insurance" --platform=win32 --arch=x64 --out=dist --overwrite --icon=logo.png --ignore="(dist|shanthiayur|backup|import-)" --electron-version=28.3.3',
    { stdio: 'inherit', cwd: __dirname }
  );
  console.log('✅ Insurance app built: dist/Shanthi-Insurance-win32-x64/');
} catch(e) {
  console.log('⚠️ Insurance build failed:', e.message);
}

// Build User Management App
console.log('\n📦 Building User Management System...');
try {
  // Temporarily rename main file
  if (fs.existsSync('main-insurance.js')) {
    const origMain = fs.readFileSync('package.json', 'utf8');
    const pkg = JSON.parse(origMain);
    pkg.main = 'main-usermgmt.js';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    
    execSync(
      'npx electron-packager . "Shanthi-UserMgmt" --platform=win32 --arch=x64 --out=dist --overwrite --icon=logo.png --ignore="(dist|shanthiayur|backup|import-)" --electron-version=28.3.3',
      { stdio: 'inherit', cwd: __dirname }
    );
    
    // Restore
    pkg.main = 'main.js';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log('✅ User Management app built: dist/Shanthi-UserMgmt-win32-x64/');
  }
} catch(e) {
  console.log('⚠️ User Management build failed:', e.message);
  // Restore package.json
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
  pkg.main = 'main.js';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
}

console.log('\n=== Build Complete ===');
console.log('Run Insurance:       dist\\Shanthi-Insurance-win32-x64\\Shanthi-Insurance.exe');
console.log('Run User Management: dist\\Shanthi-UserMgmt-win32-x64\\Shanthi-UserMgmt.exe');
