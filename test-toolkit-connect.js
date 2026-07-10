const WebSocket = require('ws');

function testToolkit() {
  const url = 'ws://127.0.0.1:9004';
  console.log('Connecting to', url);
  const ws = new WebSocket(url, { handshakeTimeout: 5000 });

  const timeout = setTimeout(() => {
    console.error('No response from toolkit within 8s.');
    ws.terminate();
    process.exit(2);
  }, 8000);

  ws.on('open', () => {
    console.log('Connected. Sending ReadPublicData...');
    ws.send(JSON.stringify({ cmd: 'ReadPublicData' }));
    ws.send(JSON.stringify({ command: 'ReadPublicData', params: {} }));
    ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'ReadPublicData', id: 1 }));
  });

  ws.on('message', (msg) => {
    clearTimeout(timeout);
    console.log('Received message from toolkit:');
    try { console.log(JSON.stringify(JSON.parse(msg.toString()), null, 2)); }
    catch (e) { console.log(msg.toString()); }
    ws.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error('WebSocket error:', err.message || err);
    process.exit(3);
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    console.log('Connection closed.');
  });
}

testToolkit();
