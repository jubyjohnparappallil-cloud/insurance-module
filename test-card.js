const pcsclite = require('pcsclite');
const pcsc = pcsclite();

console.log('Waiting for card reader...');
console.log('Insert an Emirates ID card into the reader...\n');

pcsc.on('reader', (reader) => {
  console.log('Reader found:', reader.name);

  reader.on('status', (status) => {
    const changes = reader.state ^ status.state;
    if (changes) {
      if (status.state & reader.SCARD_STATE_PRESENT) {
        console.log('\n*** Card inserted! ***');
        console.log('ATR:', status.atr ? status.atr.toString('hex').toUpperCase() : 'N/A');

        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
          if (err) {
            console.log('Connect error:', err.message);
            return;
          }
          console.log('Connected to card, protocol:', protocol);

          // Try SELECT command for Emirates ID
          const selectEID = Buffer.from([0x00, 0xA4, 0x04, 0x00, 0x10, 0xA0, 0x00, 0x00, 0x00, 0x77, 0x01, 0x08, 0x00, 0x07, 0x00, 0x00, 0xFE, 0x00, 0x00, 0x01, 0x00]);
          
          reader.transmit(selectEID, 256, protocol, (err2, data) => {
            if (err2) {
              console.log('Select EID error:', err2.message);
            } else {
              console.log('Select response:', data.toString('hex').toUpperCase());
              var sw = data.slice(-2).toString('hex').toUpperCase();
              console.log('Status:', sw === '9000' ? 'SUCCESS' : 'Failed (SW=' + sw + ')');
              
              if (sw === '9000' || sw.startsWith('61')) {
                // Try reading data
                const readBinary = Buffer.from([0x00, 0xB0, 0x00, 0x00, 0xFE]);
                reader.transmit(readBinary, 512, protocol, (err3, readData) => {
                  if (err3) {
                    console.log('Read error:', err3.message);
                  } else {
                    console.log('\nData (hex):', readData.toString('hex').toUpperCase());
                    // Try to find readable text
                    var text = '';
                    for (var i = 0; i < readData.length; i++) {
                      if (readData[i] >= 32 && readData[i] <= 126) text += String.fromCharCode(readData[i]);
                      else if (text.length > 0) text += ' ';
                    }
                    console.log('\nReadable text:', text.trim());
                  }
                  reader.disconnect(reader.SCARD_LEAVE_CARD, () => {});
                  setTimeout(() => process.exit(0), 1000);
                });
              } else {
                reader.disconnect(reader.SCARD_LEAVE_CARD, () => {});
                setTimeout(() => process.exit(0), 1000);
              }
            }
          });
        });
      } else if (status.state & reader.SCARD_STATE_EMPTY) {
        console.log('Card removed');
      }
    }
  });

  reader.on('error', (err) => {
    console.log('Reader error:', err.message);
  });
});

pcsc.on('error', (err) => {
  console.log('PCSC error:', err.message);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\nTimeout - no card detected after 30 seconds');
  pcsc.close();
  process.exit(0);
}, 30000);
