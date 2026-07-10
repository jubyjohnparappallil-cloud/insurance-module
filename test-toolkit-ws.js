const WebSocket = require('ws');

const messages = [
  JSON.stringify({ cmd: 'ReadPublicData' }),
  JSON.stringify({ command: 'ReadPublicData', params: {} }),
  JSON.stringify({ jsonrpc: '2.0', method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ action: 'ReadPublicData' }),
];

let i = 0;
function tryNext() {
  if (i >= messages.length) {
    console.log('All attempts done');
    process.exit(0);
  }
  const msg = messages[i++];
  console.log('\n--- Trying:', msg);
  const ws = new WebSocket('ws://127.0.0.1:9004');
  const timer = setTimeout(() => {
    console.log('timeout');
    ws.terminate();
    tryNext();
  }, 8000);
  ws.on('open', () => {
    console.log('connected');
    ws.send(msg);
  });
  ws.on('message', (data) => {
    clearTimeout(timer);
    console.log('response:', data.toString().slice(0, 2000));
    ws.close();
    setTimeout(tryNext, 500);
  });
  ws.on('error', (e) => {
    clearTimeout(timer);
    console.log('error:', e.message);
    setTimeout(tryNext, 500);
  });
  ws.on('close', () => {
    clearTimeout(timer);
  });
}
tryNext();
