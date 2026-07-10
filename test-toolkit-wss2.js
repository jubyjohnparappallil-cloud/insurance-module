const WebSocket = require('ws');

const messages = [
  { cmd: 'RhaReadPublicData' },
  { cmd: 'ReadPublicData' },
  { command: 'RhaReadPublicData' },
  { method: 'RhaReadPublicData', id: 1 },
  { request_json: { cmd: 'ReadPublicData' } },
  { request_json: JSON.stringify({ cmd: 'ReadPublicData' }) },
  { cmd: 'GetToolkitVersion' },
  { cmd: 'RhaGetToolkitVersion' },
  { cmd: 'getToolkitVersion' },
  { json_req: { cmd: 'ReadPublicData' } },
];

let i = 0;
function tryNext() {
  if (i >= messages.length) process.exit(0);
  const payload = JSON.stringify(messages[i++]);
  console.log('\n---', payload);
  const ws = new WebSocket('wss://127.0.0.1:9004/', { rejectUnauthorized: false });
  const timer = setTimeout(() => {
    console.log('timeout');
    ws.terminate();
    tryNext();
  }, 8000);
  ws.on('open', () => ws.send(payload));
  ws.on('message', (d) => {
    clearTimeout(timer);
    console.log('OK:', d.toString());
    ws.close();
    setTimeout(tryNext, 300);
  });
  ws.on('error', (e) => {
    clearTimeout(timer);
    console.log('ERR:', e.message);
    setTimeout(tryNext, 300);
  });
}
tryNext();
