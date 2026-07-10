const WebSocket = require('ws');
const urls = [
  'ws://127.0.0.1:9004/',
  'ws://127.0.0.1:9004',
  'ws://127.0.0.1:9004/agent',
  'ws://127.0.0.1:9004/websocket',
  'ws://127.0.0.1:9004/ws',
  'wss://127.0.0.1:9004/',
  'wss://127.0.0.1:9004',
  'wss://127.0.0.1:9004/agent',
  'wss://127.0.0.1:9004/websocket',
  'wss://127.0.0.1:9004/ws',
];
const origins = [
  undefined,
  'http://localhost',
  'https://localhost',
  'http://toolkitagent.mohre.gov.ae',
  'https://toolkitagent.mohre.gov.ae',
  'http://eservices.mohre.gov.ae',
  'https://eservices.mohre.gov.ae',
];
const protocols = [
  undefined,
  'eida-toolkit',
  'EIDAToolkit',
  'ws',
  'websocket',
];
const messages = [
  JSON.stringify({ cmd: 'ReadPublicData' }),
  JSON.stringify({ command: 'ReadPublicData', params: {} }),
  JSON.stringify({ jsonrpc: '2.0', method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ method: 'ReadPublicData', id: 1 }),
  JSON.stringify({ action: 'ReadPublicData' }),
  JSON.stringify({ request: 'ReadPublicData' }),
  JSON.stringify({ ReadPublicData: {} }),
  JSON.stringify({ function: 'ReadPublicData' }),
  JSON.stringify({ name: 'ReadPublicData' }),
  JSON.stringify({ type: 'ReadPublicData' }),
];

async function probe() {
  for (const url of urls) {
    for (const origin of origins) {
      for (const protocol of protocols) {
        const opts = { handshakeTimeout: 5000 };
        if (origin) opts.headers = { Origin: origin };
        if (protocol) opts.protocol = protocol;
        const desc = `URL=${url} ORIGIN=${origin||'<none>'} PROTO=${protocol||'<none>'}`;
        console.log(`\n=== ${desc}`);
        await new Promise((resolve) => {
          let done = false;
          const ws = new WebSocket(url, protocol ? [protocol] : undefined, opts);
          const timer = setTimeout(() => {
            if (done) return;
            done = true;
            console.log('TIMEOUT open');
            ws.terminate();
            resolve();
          }, 8000);
          ws.on('open', () => {
            clearTimeout(timer);
            console.log('OPEN');
            try {
              const m = messages[0];
              console.log('SEND', m);
              ws.send(m);
            } catch (e) {
              console.log('SEND ERROR', e.message);
            }
          });
          ws.on('message', (msg) => {
            if (done) return;
            done = true;
            console.log('MESSAGE', msg.toString().slice(0, 2000));
            ws.close();
            resolve();
          });
          ws.on('error', (e) => {
            if (done) return;
            done = true;
            console.log('ERROR', e.message || e);
            resolve();
          });
          ws.on('close', () => {
            if (done) return;
            done = true;
            console.log('CLOSE');
            resolve();
          });
        });
      }
    }
  }
}
probe().then(() => process.exit(0));
