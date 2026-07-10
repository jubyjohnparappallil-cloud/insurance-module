const WebSocket = require('ws');

const messages = [
  JSON.stringify({ cmd: 'ReadPublicData' }),
  JSON.stringify({ command: 'ReadPublicData', params: {} }),
  JSON.stringify({ jsonrpc: '2.0', method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ action: 'ReadPublicData' }),
  JSON.stringify({ type: 'ReadPublicData' }),
];

let i = 0;
function tryNext() {
  if (i >= messages.length) {
    console.log('All attempts done');
    process.exit(0);
  }
  const msg = messages[i++];
  console.log('\n--- Trying:', msg);
  const ws = new WebSocket('wss://127.0.0.1:9004/', { rejectUnauthorized: false });
  const timer = setTimeout(() => {
    console.log('timeout');
    ws.terminate();
    tryNext();
  }, 15000);
  ws.on('open', () => {
    console.log('connected');
    ws.send(msg);
  });
  ws.on('message', (data) => {
    clearTimeout(timer);
    console.log('response:', data.toString());
    ws.close();
    setTimeout(tryNext, 500);
  });
  ws.on('error', (e) => {
    clearTimeout(timer);
    console.log('error:', e.message);
    setTimeout(tryNext, 500);
  });
}
tryNext();
