// Test HID OMNIKEY card reader - NFC/Contactless mode
const pcsclite = require('pcsclite');
const pcsc = pcsclite();

console.log('Waiting for Emirates ID card on OMNIKEY reader...');
console.log('Place the Emirates ID card ON TOP of the reader (contactless)');

pcsc.on('reader', function(reader) {
  console.log('\nReader:', reader.name);

  reader.on('status', function(status) {
    var changes = reader.state ^ status.state;
    if (changes & reader.SCARD_STATE_PRESENT && status.state & reader.SCARD_STATE_PRESENT) {
      console.log('\nCard detected!');
      if (status.atr) console.log('ATR:', status.atr.toString('hex').toUpperCase());

      // Try T=1 protocol (contactless)
      reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: reader.SCARD_PROTOCOL_T1 }, function(err, protocol) {
        if (err) {
          console.log('T1 failed:', err.message);
          // Try T=0
          reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: reader.SCARD_PROTOCOL_T0 }, function(err2, protocol2) {
            if (err2) {
              console.log('T0 also failed:', err2.message);
              // Try any protocol
              reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: reader.SCARD_PROTOCOL_T0 | reader.SCARD_PROTOCOL_T1 }, function(err3, protocol3) {
                if (err3) { console.log('All protocols failed:', err3.message); return; }
                console.log('Connected with protocol:', protocol3);
                readCard(reader, protocol3);
              });
              return;
            }
            console.log('Connected T0, protocol:', protocol2);
            readCard(reader, protocol2);
          });
          return;
        }
        console.log('Connected T1, protocol:', protocol);
        readCard(reader, protocol);
      });
    }
  });

  reader.on('error', function(err) { console.log('Error:', err.message); });
});

function readCard(reader, protocol) {
  // UAE Emirates ID - Select IAS Application
  var cmds = [
    { name: 'Select MRTD App', apdu: Buffer.from([0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01]) },
    { name: 'Select EID App', apdu: Buffer.from([0x00, 0xA4, 0x04, 0x00, 0x0B, 0xA0, 0x00, 0x00, 0x00, 0x18, 0x45, 0x49, 0x44, 0x31, 0x30, 0x30]) },
    { name: 'Get UID', apdu: Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]) },
  ];

  var idx = 0;
  function next() {
    if (idx >= cmds.length) {
      reader.disconnect(reader.SCARD_LEAVE_CARD, function() {});
      return;
    }
    var cmd = cmds[idx++];
    console.log('\nSending:', cmd.name);
    reader.transmit(cmd.apdu, 256, protocol, function(err, data) {
      if (err) { console.log('Error:', err.message); next(); return; }
      console.log('Response:', data.toString('hex'));
      var sw = data.slice(-2);
      console.log('SW:', sw.toString('hex'), sw[0] === 0x90 ? '(SUCCESS)' : sw[0] === 0x6A ? '(NOT FOUND)' : '');
      next();
    });
  }
  next();
}

pcsc.on('error', function(err) { console.log('PCSC error:', err.message); });

setTimeout(function() {
  console.log('\nTest ended');
  try { pcsc.close(); } catch(e) {}
  process.exit(0);
}, 20000);
