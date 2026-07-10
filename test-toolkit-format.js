const WebSocket = require('ws');

const messages = [
  { request_json: '{"cmd":"ReadPublicData"}' },
  { request_json: '{"function":"ReadPublicData"}' },
  { request_json: '{"api":"ReadPublicData"}' },
  { request_json: '{"name":"ReadPublicData"}' },
  { request_json: '{"command":"ReadPublicData"}' },
  { request_json: '{"method":"ReadPublicData"}' },
  { request_json: '{"ReadPublicData":{}}' },
  { request_json: '{}' },
  { cmd: 'ReadPublicData', request_json: '{}' },
  { request_json: JSON.stringify({ ReadPublicData: {} }) },
  { request_json: JSON.stringify({ cmd: 'RhaReadPublicData' }) },
  { request_json: JSON.stringify({ cmd: 'GetToolkitVersion' }) },
  { request_json: JSON.stringify({ request: 'ReadPublicData' }) },
  { request_json: JSON.stringify({ action: 'ReadPublicData', params: {} }) },
];

let i = 0;
function next() {
  if (i >= messages.length) process.exit(0);
  const payload = JSON.stringify(messages[i++]);
  const ws = new WebSocket('wss://toolkitagent.mohre.gov.ae:9004/', ['eida-toolkit'], { rejectUnauthorized: false });
  const timer = setTimeout(() => { console.log(payload, '=> timeout'); ws.terminate(); next(); }, 12000);
  ws.on('open', () => ws.send(payload));
  ws.on('message', (d) => {
    clearTimeout(timer);
    console.log(payload, '=>', d.toString().slice(0, 500));
    ws.close();
    setTimeout(next, 200);
  });
  ws.on('error', (e) => { clearTimeout(timer); console.log(payload, 'ERR', e.message); setTimeout(next, 200); });
}
next();
