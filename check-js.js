const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.lastIndexOf('</script>');
const js = html.substring(start, end);
try {
  new Function(js);
  console.log('JS OK');
} catch(e) {
  console.log('JS ERROR:', e.message);
  // Find approximate line
  const lines = js.split('\n');
  const errLine = parseInt((e.message.match(/line (\d+)/) || [])[1]) || 0;
  if (errLine > 0) {
    console.log('Near line', errLine, ':', lines[errLine-1]);
  }
}
