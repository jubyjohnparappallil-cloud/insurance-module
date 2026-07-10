const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'clinic-data.json');
if (!fs.existsSync(file)) {
  console.error('DB file not found:', file);
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
const keys = Object.keys(db);
console.log('Top-level collections:', keys.join(', '));
keys.forEach((k) => {
  const v = db[k];
  if (Array.isArray(v)) {
    console.log(`${k}: ${v.length} records`);
  } else if (v && typeof v === 'object') {
    console.log(`${k}: object with ${Object.keys(v).length} keys`);
  } else {
    console.log(`${k}: ${typeof v}`);
  }
});
console.log('\nSample schema for patients:');
if (Array.isArray(db.patients) && db.patients.length) {
  console.log(Object.keys(db.patients[0]).join(', '));
} else {
  console.log('No patients data');
}
console.log('\nSample patient record:');
if (Array.isArray(db.patients) && db.patients.length) {
  console.log(JSON.stringify(db.patients[0], null, 2));
}
