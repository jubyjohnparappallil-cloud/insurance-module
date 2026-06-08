const pcsclite = require('pcsclite');
const pcsc = pcsclite();
let connected = false;

console.log('Reading Emirates ID public data...\n');

pcsc.on('reader', (reader) => {
  console.log('Reader:', reader.name);
  reader.on('status', (status) => {
    if (connected) return;
    if (!(status.state & reader.SCARD_STATE_PRESENT)) return;
    connected = true;
    console.log('ATR:', status.atr.toString('hex').toUpperCase());

    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: 2 }, (err, protocol) => {
      if (err) { console.log('Error:', err.message); process.exit(1); return; }
      if (typeof protocol !== 'number') protocol = 2;
      console.log('Connected T=1\n');

      function send(name, cmd, cb) {
        reader.transmit(Buffer.from(cmd), 1024, protocol, (e, d) => {
          if (e) { console.log(name + ': ' + e.message); cb(null); return; }
          var hex = d.toString('hex').toUpperCase();
          var sw = hex.slice(-4);
          var ok = sw === '9000' || sw.startsWith('61') || sw.startsWith('6C');
          if (ok || d.length > 4) console.log(name + ': SW=' + sw + (ok?' ✓':'') + ' len=' + (d.length-2));
          cb(ok ? d : null, sw);
        });
      }

      // Select eMRTD app
      send('SELECT eMRTD', [0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01], function() {
        // Try to read EF.COM (file list) - EF 011E
        send('SELECT EF.COM', [0x00, 0xA4, 0x02, 0x0C, 0x02, 0x01, 0x1E], function(d, sw) {
          send('READ EF.COM', [0x00, 0xB0, 0x00, 0x00, 0x80], function(data) {
            if (data) {
              console.log('EF.COM data:', data.toString('hex').toUpperCase());
              // Parse TLV to find DG list
              for (var i = 0; i < data.length - 2; i++) {
                if (data[i] === 0x5C) { // Tag list
                  var len = data[i+1];
                  console.log('Data Groups available:', data.slice(i+2, i+2+len).toString('hex').toUpperCase());
                }
              }
            }
            // Try DG1 without BAC (might work on some cards)
            send('SELECT DG1', [0x00, 0xA4, 0x02, 0x0C, 0x02, 0x01, 0x01], function(d2) {
              send('READ DG1 attempt', [0x00, 0xB0, 0x00, 0x00, 0x80], function(d3) {
                if (d3 && d3.length > 4) {
                  console.log('\n*** DG1 DATA (MRZ) ***');
                  console.log('Hex:', d3.toString('hex').toUpperCase());
                  var t = '';
                  for (var i = 0; i < d3.length - 2; i++) {
                    if (d3[i] >= 32 && d3[i] <= 126) t += String.fromCharCode(d3[i]);
                  }
                  if (t) console.log('Text:', t);
                }
                // Try to read EF.ATR/INFO (might have public info)
                send('SELECT EF.ATR', [0x00, 0xA4, 0x02, 0x0C, 0x02, 0x2F, 0x01], function() {
                  send('READ EF.ATR', [0x00, 0xB0, 0x00, 0x00, 0x80], function(d4) {
                    if (d4 && d4.length > 4) console.log('EF.ATR:', d4.toString('hex').toUpperCase());
                    
                    console.log('\n--- Summary ---');
                    console.log('Card is an eMRTD (like passport). BAC authentication required to read personal data.');
                    console.log('BAC needs: Document Number + DOB + Expiry Date (from MRZ printed on card)');
                    reader.disconnect(reader.SCARD_LEAVE_CARD, () => { pcsc.close(); process.exit(0); });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  reader.on('error', () => {});
});

pcsc.on('error', (e) => { console.log('PCSC:', e.message); process.exit(1); });
setTimeout(() => { console.log('Timeout'); process.exit(0); }, 12000);
