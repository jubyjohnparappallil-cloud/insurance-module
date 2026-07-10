const WebSocket = require('ws');
const url = 'wss://127.0.0.1:9004/';
const message = JSON.stringify({ cmd: 'ReadPublicData' });
console.log('Connecting to', url);
const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 5000 });
const timeout = setTimeout(() => { console.error('TIMEOUT'); ws.terminate(); process.exit(1); }, 10000);
ws.on('open', () => {
  console.log('OPEN');
  ws.send(message);
});
ws.on('message', msg => {
  console.log('MESSAGE', msg.toString().slice(0, 500));
  clearTimeout(timeout);
  ws.close();
  process.exit(0);
});
ws.on('error', err => {
  console.error('ERROR', err && err.message ? err.message : err);
  clearTimeout(timeout);
  process.exit(2);
});
ws.on('close', () => {
  console.log('CLOSED');
});
