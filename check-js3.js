const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.lastIndexOf('</script>');
const js = html.substring(start, end);

// Check for runtime issues - look for undeclared variables used before declaration
const lines = js.split('\n');
const issues = [];

// Find all variable usages that might be problematic
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('claimPatientDD') || line.includes('claimPatientInput')) {
    issues.push(`Line ${i+1}: ${line.trim()}`);
  }
}

if (issues.length > 0) {
  console.log('Found problematic references:');
  issues.forEach(i => console.log(i));
} else {
  console.log('No problematic references found');
}

// Check document.addEventListener at end
const lastDocListener = js.lastIndexOf('document.addEventListener');
console.log('\nLast document.addEventListener at JS position:', lastDocListener);
console.log('Total JS length:', js.length);
console.log('Is it near the end?', lastDocListener > js.length - 3000 ? 'YES' : 'NO');
