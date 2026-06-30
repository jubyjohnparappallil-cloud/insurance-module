/**
 * Emirates ID Full Reader - HID Omnikey
 * Tries multiple approaches to read card data
 */
const pcsclite = require('pcsclite');
const crypto = require('crypto');
const pcsc = pcsclite();
let done = false;

pcsc.on('reader', (reader) => {
  if (done) return;
  console.log('Reader:', reader.name);
  
  reader.on('status', (status) => {
    if (done) return;
    if (!(status.state & reader.SCARD_STATE_PRESENT)) return;
    done = true;
    
    const atr = status.atr ? status.atr.toString('hex').toUpperCase() : '';
    console.log('Card ATR:', atr);
    console.log('');

    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: 2 }, (err, protocol) => {
      if (err) { console.log('Connect error:', err.message); process.exit(1); }
      if (typeof protocol !== 'number') protocol = 2;

      function tx(cmd, cb) {
        reader.transmit(Buffer.from(cmd), 2048, protocol, (e, d) => {
          if (e) { cb(e, null, null); return; }
          const sw = d.slice(-2).toString('hex').toUpperCase();
          const body = d.slice(0, -2);
          cb(null, body, sw);
        });
      }

      function txLog(name, cmd, cb) {
        tx(cmd, (e, body, sw) => {
          if (e) { console.log(`  ${name}: ERROR ${e.message}`); cb(null, ''); return; }
          const ok = sw === '9000' || sw.startsWith('61') || sw.startsWith('6C');
          if (ok && body.length > 0) {
            console.log(`  ${name}: OK (${body.length} bytes)`);
          }
          cb(body.length > 0 ? body : null, sw);
        });
      }

      // Helper: read all data using GET RESPONSE when SW=61xx
      function readAll(initialBody, initialSw, cb) {
        let allData = initialBody || Buffer.alloc(0);
        function getMore(sw) {
          if (sw.startsWith('61')) {
            const remaining = parseInt(sw.substring(2), 16);
            tx([0x00, 0xC0, 0x00, 0x00, remaining || 0xFF], (e, body, sw2) => {
              if (e || !body) { cb(allData); return; }
              allData = Buffer.concat([allData, body]);
              getMore(sw2);
            });
          } else {
            cb(allData);
          }
        }
        getMore(initialSw);
      }

      console.log('=== Attempting to read Emirates ID ===\n');
      
      // Step 1: Select eMRTD application
      console.log('[1] Selecting eMRTD application...');
      tx([0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01], (e, body, sw) => {
        if (sw !== '9000') {
          console.log('  Failed to select eMRTD: SW=' + sw);
          finish();
          return;
        }
        console.log('  eMRTD selected OK');
        
        // Step 2: Get Challenge
        console.log('\n[2] GET CHALLENGE...');
        tx([0x00, 0x84, 0x00, 0x00, 0x08], (e2, rndICC, sw2) => {
          if (sw2 !== '9000' || !rndICC || rndICC.length !== 8) {
            console.log('  GET CHALLENGE failed: SW=' + sw2);
            finish();
            return;
          }
          console.log('  RND.ICC: ' + rndICC.toString('hex').toUpperCase());
          console.log('  Card is ready for BAC authentication.');
          
          // If we have MRZ info from command line args, try BAC
          const args = process.argv.slice(2);
          if (args.length < 3) {
            console.log('\n[!] To authenticate, provide: node read-eid-full.js <ID_NUMBER_15digits> <DOB_DDMMYYYY> <EXPIRY_DDMMYYYY>');
            console.log('    Example: node read-eid-full.js 784199012345671 01011990 15062030');
            console.log('\n    ID Number: 15 digits (no dashes)');
            console.log('    DOB: DDMMYYYY format');
            console.log('    Expiry: DDMMYYYY format (from card back)');
            finish();
            return;
          }

          const idNumber = args[0].replace(/[^0-9]/g, '');
          const dobRaw = args[1].replace(/[^0-9]/g, '');
          const expiryRaw = args[2].replace(/[^0-9]/g, '');

          // Convert DDMMYYYY to YYMMDD for MRZ
          const dobYYMMDD = dobRaw.substring(4,6) + dobRaw.substring(2,4) + dobRaw.substring(0,2);
          const expiryYYMMDD = expiryRaw.substring(4,6) + expiryRaw.substring(2,4) + expiryRaw.substring(0,2);

          // Document number for MRZ - first 9 chars of the ID padded
          // Emirates ID MRZ uses the full 15-digit number split across lines
          // Line 1 of TD1: positions 6-14 = first 9 digits of doc number
          const docNo = idNumber.substring(0, 9);

          console.log('\n[3] Performing BAC authentication...');
          console.log('  Doc No (9): ' + docNo);
          console.log('  DOB YYMMDD: ' + dobYYMMDD);
          console.log('  Expiry YYMMDD: ' + expiryYYMMDD);

          // Calculate check digits (ICAO 9303 algorithm)
          function checkDigit(s) {
            const weights = [7, 3, 1];
            let sum = 0;
            for (let i = 0; i < s.length; i++) {
              let c = s.charCodeAt(i);
              let val = 0;
              if (c >= 48 && c <= 57) val = c - 48;         // 0-9
              else if (c >= 65 && c <= 90) val = c - 55;     // A-Z
              else if (c === 60) val = 0;                     // <
              sum += val * weights[i % 3];
            }
            return String(sum % 10);
          }

          // MRZ Key Seed = SHA1(docNo + checkDigit(docNo) + DOB + checkDigit(DOB) + expiry + checkDigit(expiry))
          const mrzInfo = docNo + checkDigit(docNo) + dobYYMMDD + checkDigit(dobYYMMDD) + expiryYYMMDD + checkDigit(expiryYYMMDD);
          console.log('  MRZ Info: ' + mrzInfo);
          
          const keySeed = crypto.createHash('sha1').update(mrzInfo, 'ascii').digest().slice(0, 16);
          console.log('  Key Seed: ' + keySeed.toString('hex').toUpperCase());

          // Derive KEnc and KMac
          function deriveKey(seed, counter) {
            const d = Buffer.concat([seed, Buffer.from([0x00, 0x00, 0x00, counter])]);
            const hash = crypto.createHash('sha1').update(d).digest().slice(0, 16);
            // Adjust DES parity bits
            function adjustParity(key) {
              for (let i = 0; i < key.length; i++) {
                let b = key[i];
                let parity = 0;
                for (let j = 0; j < 8; j++) parity ^= (b >> j) & 1;
                if (parity === 0) key[i] ^= 1;
              }
              return key;
            }
            return adjustParity(Buffer.from(hash));
          }

          const kEnc = deriveKey(keySeed, 1);
          const kMac = deriveKey(keySeed, 2);
          // For 3DES: use K1|K2|K1 (EDE2)
          const kEnc3 = Buffer.concat([kEnc.slice(0, 8), kEnc.slice(8, 16), kEnc.slice(0, 8)]);
          const kMac3 = Buffer.concat([kMac.slice(0, 8), kMac.slice(8, 16), kMac.slice(0, 8)]);

          console.log('  KEnc: ' + kEnc.toString('hex').toUpperCase());
          console.log('  KMac: ' + kMac.toString('hex').toUpperCase());

          // Generate RND.IFD and K.IFD
          const rndIFD = crypto.randomBytes(8);
          const kIFD = crypto.randomBytes(16);

          // S = RND.IFD || RND.ICC || K.IFD
          const S = Buffer.concat([rndIFD, rndICC, kIFD]);

          // Encrypt S with KEnc using 3DES-CBC, IV=0
          const iv = Buffer.alloc(8, 0);
          const cipher = crypto.createCipheriv('des-ede3-cbc', kEnc3, iv);
          cipher.setAutoPadding(false);
          const eifd = Buffer.concat([cipher.update(S), cipher.final()]);

          // Calculate MAC over eifd using retail MAC (ISO 9797-1 Algorithm 3)
          function retailMac(key3, data) {
            const k1 = key3.slice(0, 8);
            const k3 = key3.slice(16, 24); // same as k1 for EDE2
            const k2 = key3.slice(8, 16);
            
            // Pad data to multiple of 8 (should already be)
            let padded = data;
            if (data.length % 8 !== 0) {
              padded = Buffer.concat([data, Buffer.from([0x80]), Buffer.alloc(7 - (data.length % 8), 0)]);
            }
            
            // CBC-MAC with single DES using K1
            let prev = Buffer.alloc(8, 0);
            for (let i = 0; i < padded.length; i += 8) {
              const block = padded.slice(i, i + 8);
              const xored = Buffer.alloc(8);
              for (let j = 0; j < 8; j++) xored[j] = prev[j] ^ block[j];
              const c = crypto.createCipheriv('des-ecb', k1, null);
              c.setAutoPadding(false);
              prev = c.update(xored);
            }
            // Final block: decrypt with K2, encrypt with K1
            const dec = crypto.createDecipheriv('des-ecb', k2, null);
            dec.setAutoPadding(false);
            const tmp = dec.update(prev);
            const enc = crypto.createCipheriv('des-ecb', k1, null);
            enc.setAutoPadding(false);
            return enc.update(tmp);
          }

          const mifd = retailMac(kMac3, eifd);

          // MUTUAL AUTHENTICATE
          const cmdData = Buffer.concat([eifd, mifd]); // 40 bytes
          const mutAuthCmd = Buffer.concat([
            Buffer.from([0x00, 0x82, 0x00, 0x00, 0x28]),
            cmdData,
            Buffer.from([0x28])
          ]);

          console.log('\n[4] MUTUAL AUTHENTICATE...');
          tx(Array.from(mutAuthCmd), (e3, authResp, sw3) => {
            if (sw3 !== '9000' || !authResp || authResp.length < 40) {
              console.log('  BAC FAILED! SW=' + sw3 + ' len=' + (authResp ? authResp.length : 0));
              console.log('  This usually means the MRZ data (ID/DOB/Expiry) is incorrect.');
              console.log('  Double-check the numbers from the physical card.');
              finish();
              return;
            }

            console.log('  BAC SUCCESS! Authenticated.');
            
            // Decrypt response to get session keys
            const encResp = authResp.slice(0, 32);
            const macResp = authResp.slice(32, 40);
            
            const decipher = crypto.createDecipheriv('des-ede3-cbc', kEnc3, iv);
            decipher.setAutoPadding(false);
            const R = Buffer.concat([decipher.update(encResp), decipher.final()]);
            
            const rndICCcheck = R.slice(0, 8);
            const rndIFDcheck = R.slice(8, 16);
            const kICC = R.slice(16, 32);
            
            // Derive session keys
            const keySeedSession = Buffer.alloc(16);
            for (let i = 0; i < 16; i++) keySeedSession[i] = kIFD[i] ^ kICC[i];
            
            const ksEnc = deriveKey(keySeedSession, 1);
            const ksMac = deriveKey(keySeedSession, 2);
            const ksEnc3 = Buffer.concat([ksEnc.slice(0, 8), ksEnc.slice(8, 16), ksEnc.slice(0, 8)]);
            const ksMac3 = Buffer.concat([ksMac.slice(0, 8), ksMac.slice(8, 16), ksMac.slice(0, 8)]);
            
            // SSC (Send Sequence Counter)
            const ssc = Buffer.concat([rndICC.slice(4, 8), rndIFD.slice(4, 8)]);
            let sscNum = BigInt('0x' + ssc.toString('hex'));
            
            function incSSC() {
              sscNum++;
              const hex = sscNum.toString(16).padStart(16, '0');
              return Buffer.from(hex, 'hex');
            }

            // Secure Messaging: send protected APDU
            function sendSecure(header, data, le, cb) {
              const sscBuf = incSSC();
              
              // Build DO87 (encrypted data) if data present
              let do87 = Buffer.alloc(0);
              if (data && data.length > 0) {
                // Pad data
                let padData = Buffer.concat([data, Buffer.from([0x80]), Buffer.alloc(7 - (data.length % 8), 0)]);
                const civSM = crypto.createCipheriv('des-ede3-cbc', ksEnc3, iv);
                civSM.setAutoPadding(false);
                const encData = Buffer.concat([civSM.update(padData), civSM.final()]);
                do87 = Buffer.concat([Buffer.from([0x87]), Buffer.from([encData.length + 1]), Buffer.from([0x01]), encData]);
              }
              
              // Build DO97 (Le) if present
              let do97 = Buffer.alloc(0);
              if (le !== null && le !== undefined) {
                do97 = Buffer.from([0x97, 0x01, le]);
              }
              
              // Build MAC input: SSC || padded(header|0x80...) || DO87 || DO97
              let paddedHeader = Buffer.concat([Buffer.from(header), Buffer.from([0x80, 0x00, 0x00, 0x00])]);
              let macInput = Buffer.concat([sscBuf, paddedHeader, do87, do97]);
              // Pad macInput to multiple of 8
              if (macInput.length % 8 !== 0) {
                macInput = Buffer.concat([macInput, Buffer.from([0x80]), Buffer.alloc(7 - (macInput.length % 8), 0)]);
              } else {
                macInput = Buffer.concat([macInput, Buffer.from([0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])]);
              }
              
              const mac = retailMac(ksMac3, macInput);
              const do8e = Buffer.concat([Buffer.from([0x8E, 0x08]), mac]);
              
              // Build final APDU
              const apduData = Buffer.concat([do87, do97, do8e]);
              const apdu = Buffer.concat([
                Buffer.from([header[0] | 0x0C, header[1], header[2], header[3]]),
                Buffer.from([apduData.length]),
                apduData,
                Buffer.from([0x00])
              ]);
              
              tx(Array.from(apdu), (e, resp, sw) => {
                if (e) { cb(e, null); return; }
                
                // Increment SSC for response
                incSSC();
                
                if (sw !== '9000' || !resp || resp.length < 10) {
                  cb(null, null, sw);
                  return;
                }
                
                // Parse response - find DO87 and decrypt
                let decrypted = null;
                let i = 0;
                while (i < resp.length) {
                  const tag = resp[i];
                  if (tag === 0x87) {
                    let len = resp[i + 1];
                    let offset = i + 2;
                    if (len === 0x81) { len = resp[i + 2]; offset = i + 3; }
                    else if (len === 0x82) { len = (resp[i + 2] << 8) | resp[i + 3]; offset = i + 4; }
                    // Skip padding indicator byte (0x01)
                    const encData = resp.slice(offset + 1, offset + len - 1);
                    const decSM = crypto.createDecipheriv('des-ede3-cbc', ksEnc3, iv);
                    decSM.setAutoPadding(false);
                    decrypted = Buffer.concat([decSM.update(encData), decSM.final()]);
                    // Remove padding (0x80 followed by zeros)
                    let end = decrypted.length - 1;
                    while (end > 0 && decrypted[end] === 0x00) end--;
                    if (decrypted[end] === 0x80) decrypted = decrypted.slice(0, end);
                    break;
                  }
                  i++;
                }
                cb(null, decrypted, sw);
              });
            }

            // Read DG1 (MRZ data)
            console.log('\n[5] Reading DG1 (MRZ data)...');
            
            // Select EF for DG1
            sendSecure([0x00, 0xA4, 0x02, 0x0C], Buffer.from([0x01, 0x01]), null, (e4, d4, sw4) => {
              console.log('  SELECT DG1: SW=' + (sw4 || 'err'));
              
              // Read first chunk
              sendSecure([0x00, 0xB0, 0x00, 0x00], null, 0x00, (e5, d5, sw5) => {
                if (!d5 || d5.length === 0) {
                  console.log('  READ DG1 failed: SW=' + (sw5 || 'no data'));
                  finish();
                  return;
                }
                
                console.log('  DG1 data received: ' + d5.length + ' bytes');
                console.log('  Hex: ' + d5.toString('hex').toUpperCase().substring(0, 120));
                
                // Parse MRZ from DG1 (TLV: tag 61, then tag 5F1F for MRZ)
                let mrz = '';
                for (let i = 0; i < d5.length; i++) {
                  if (d5[i] >= 32 && d5[i] <= 126) mrz += String.fromCharCode(d5[i]);
                }
                
                console.log('\n=== MRZ DATA ===');
                console.log(mrz);
                
                // Parse TD1 format (3 lines of 30 chars)
                if (mrz.length >= 60) {
                  // Try to find ID number pattern
                  const idMatch = mrz.match(/784\d{12}/);
                  if (idMatch) {
                    const id = idMatch[0];
                    console.log('\nEmirates ID: ' + id.substring(0,3) + '-' + id.substring(3,7) + '-' + id.substring(7,14) + '-' + id.substring(14));
                  }
                  
                  // Try DOB (YYMMDD pattern after known position)
                  const dobMatch = mrz.match(/(\d{6})(\d)([MF<])(\d{6})/);
                  if (dobMatch) {
                    const yy = parseInt(dobMatch[1].substring(0,2));
                    const mm = dobMatch[1].substring(2,4);
                    const dd = dobMatch[1].substring(4,6);
                    const year = yy > 50 ? '19' + dobMatch[1].substring(0,2) : '20' + dobMatch[1].substring(0,2);
                    console.log('DOB: ' + dd + '/' + mm + '/' + year);
                    console.log('Gender: ' + (dobMatch[3] === 'M' ? 'Male' : dobMatch[3] === 'F' ? 'Female' : 'Unknown'));
                    
                    const eyy = parseInt(dobMatch[4].substring(0,2));
                    const emm = dobMatch[4].substring(2,4);
                    const edd = dobMatch[4].substring(4,6);
                    const eyear = eyy > 50 ? '19' + dobMatch[4].substring(0,2) : '20' + dobMatch[4].substring(0,2);
                    console.log('Expiry: ' + edd + '/' + emm + '/' + eyear);
                  }
                  
                  // Name (between << separators)
                  const nameMatch = mrz.match(/([A-Z]+)<<([A-Z<]+)/);
                  if (nameMatch) {
                    console.log('Last Name: ' + nameMatch[1]);
                    console.log('First Name: ' + nameMatch[2].replace(/</g, ' ').trim());
                  }
                  
                  // Nationality
                  const natMatch = mrz.match(/[A-Z]{3}(?=\d{6}[MF<])/);
                  if (natMatch) console.log('Nationality: ' + natMatch[0]);
                }
                
                console.log('\n=== Done ===');
                finish();
              });
            });
          });
        });
      });

      function finish() {
        reader.disconnect(reader.SCARD_LEAVE_CARD, () => {});
        setTimeout(() => { try { pcsc.close(); } catch(e) {} process.exit(0); }, 500);
      }
    });
  });
  reader.on('error', (e) => { console.log('Reader error:', e.message); });
});

pcsc.on('error', (e) => { console.log('No card reader found:', e.message); process.exit(1); });
setTimeout(() => { console.log('Timeout - no card detected'); process.exit(1); }, 10000);
