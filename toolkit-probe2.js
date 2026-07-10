const WebSocket = require('ws');
const url = 'ws://127.0.0.1:9004/';
const msgs = [
  {description:'cmd ReadPublicData', payload:{cmd:'ReadPublicData'}},
  {description:'command ReadPublicData', payload:{command:'ReadPublicData', params:{}}},
  {description:'jsonrpc ReadPublicData', payload:{jsonrpc:'2.0', method:'ReadPublicData', id:1}},
  {description:'method ReadPublicData', payload:{method:'ReadPublicData', id:1}},
  {description:'action ReadPublicData', payload:{action:'ReadPublicData'}},
  {description:'request ReadPublicData', payload:{request:'ReadPublicData'}},
  {description:'ReadPublicData object', payload:{ReadPublicData:{}}},
  {description:'GetToolkitVersion cmd', payload:{cmd:'GetToolkitVersion'}},
  {description:'GetToolkitVersion method', payload:{method:'GetToolkitVersion', id:1}},
  {description:'Hello', payload:{hello:'world'}},
];

function runTest(desc, data) {
  return new Promise((resolve) => {
    console.log('===', desc, JSON.stringify(data));
    const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 5000 });
    
    });
    ws.on('open', () => {
      console.log('OPEN');
    
    });
    ws.on('open', () => {// ws.on('message', (msg) => {
       console.log("CONNECTED");
    //   clearTimeout(timeout);
    //   ws.close();
    //   resolve();
     });

     ws.on('unexpected-response', (req, res) +> {
      console.log("HTTP STATUS:", res.statusCode);
     });

     ws.on('message', (msg) => {
      console.log("RAW:", msg.toString());
      
    }
    ws.on('error', (err) => {
      console.log('ERROR', err.message || err);
      
    });
    ws.on('close', () => {
      console.log('CLOSED');
      
    });
  });
}
(async()=>{
  for (const msg of msgs) {
    await runTest(msg.description, msg.payload);
    await new Promise(r=>setTimeout(r, 500));
  }
})();
