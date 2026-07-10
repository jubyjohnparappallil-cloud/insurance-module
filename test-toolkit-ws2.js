const WebSocket = require('ws');

const urls = [
  'ws://127.0.0.1:9004/',
  'ws://127.0.0.1:9004/agent',
  'ws://127.0.0.1:9004/websocket',
  'ws://127.0.0.1:9004/ws',
  'ws://toolkitagent.mohre.gov.ae:9004/',
  'ws://localhost:9004/',
];

const headers = [
  {},
  { Origin: 'http://toolkitagent.mohre.gov.ae' },
  { Origin: 'http://localhost' },
  { Origin: 'http://eservices.mohre.gov.ae' },
];

let ui = 0;
let hi = 0;

function next() {
  if (ui >= urls.length) {
    console.log('done');
    process.exit(0);
  }
  const url = urls[ui];
  const opts = { headers: headers[hi] };
  console.log(`\nTry ${url} headers=${JSON.stringify(opts.headers)}`);
  const ws = new WebSocket(url, opts);
  const timer = setTimeout(() => {
    console.log('timeout');
    ws.terminate();
    advance();
  }, 4000);
  ws.on('open', () => {
    clearTimeout(timer);
    console.log('OPEN!');
    ws.send(JSON.stringify({ method: 'ReadPublicData', id: 1 }));
    setTimeout(() => ws.close(), 2000);
  });
  ws.on('message', (d) => console.log('MSG', d.toString().slice(0, 500)));
  ws.on('error', (e) => {
    clearTimeout(timer);
    console.log('ERR', e.message);
    advance();
  });
  ws.on('close', () => {
    clearTimeout(timer);
    advance();
  });
}

function advance() {
  hi++;
  if (hi >= headers.length) {
    hi = 0;
    ui++;
  }
  setTimeout(next, 300);
}

next();
