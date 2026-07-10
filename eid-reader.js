const http = require('http');
const pcsclite = require('pcsclite');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDotDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return String(value).trim();
  const monthIndex = Number(match[2]) - 1;
  return `${match[1]}/${MONTH_NAMES[monthIndex] || match[2]}/${match[3]}`;
}

function formatEidNumber(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 15) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 13)}-${digits.slice(13)}`;
  }
  return String(value).trim();
}

function parseEidCardData(raw) {
  const data = raw || {};
  const result = {
    emiratesId: formatEidNumber(data.emiratesId || data.idNumber || data.CardNumber || data.IDNumber || ''),
    firstName: '',
    middleName: '',
    lastName: '',
    fullName: '',
    dob: '',
    gender: '',
    nationality: '',
    eidExpiry: '',
    cardDetected: Boolean(data.cardDetected),
    uid: data.uid || '',
    message: data.message || ''
  };

  if (data.fullName || data.name || data.FullNameEnglish || data.FullName) {
    const name = (data.fullName || data.name || data.FullNameEnglish || data.FullName || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length) {
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(' ');
    }
  }

  if (data.firstName || data.FirstNameEn || data.GivenName) {
    result.firstName = data.firstName || data.FirstNameEn || data.GivenName || result.firstName;
  }
  if (data.middleName || data.MiddleNameEn || data.MiddleNameEnglish) {
    result.middleName = data.middleName || data.MiddleNameEn || data.MiddleNameEnglish || '';
  }
  if (data.lastName || data.LastNameEn || data.Surname) {
    result.lastName = data.lastName || data.LastNameEn || data.Surname || result.lastName;
  }

  if (data.dob || data.DateOfBirth || data.dateOfBirth) {
    result.dob = data.dob || data.DateOfBirth || data.dateOfBirth;
  }
  if (data.gender || data.Gender || data.sex || data.Sex) {
    const genderValue = String(data.gender || data.Gender || data.sex || data.Sex).toUpperCase();
    result.gender = genderValue === 'M' || genderValue === 'MALE' ? 'Male' : genderValue === 'F' || genderValue === 'FEMALE' ? 'Female' : '';
  }
  if (data.nationality || data.Nationality || data.NationalityEn) {
    result.nationality = data.nationality || data.Nationality || data.NationalityEn || '';
  }
  if (data.eidExpiry || data.expiryDate || data.ExpiryDate || data.CardExpiryDate) {
    result.eidExpiry = data.eidExpiry || data.expiryDate || data.ExpiryDate || data.CardExpiryDate || '';
  }
  if (data.cardDetected) result.cardDetected = true;
  if (data.uid) result.uid = data.uid;
  if (data.message) result.message = data.message;

  if (Array.isArray(data.mrz) && data.mrz.length >= 2) {
    const line1 = String(data.mrz[0] || '');
    const line2 = String(data.mrz[1] || '');
    const nameParts = line1.replace(/^P</, '').split('<<');
    if (nameParts.length >= 2) {
      const rawSurname = String(nameParts[0] || '');
      const surnameBody = rawSurname.slice(3).replace(/</g, ' ').trim();
      result.lastName = surnameBody.startsWith('AL') ? `AL ${surnameBody.slice(2).trim()}` : surnameBody;
      result.firstName = String(nameParts[1] || '').replace(/</g, ' ').trim();
    }

    const mrzMatch = line2.match(/^([0-9]{14,15})([A-Z]{3})([0-9]{6})([0-9])([MF])/);
    if (mrzMatch) {
      const [, idDigits, nationalityCode, dobDigits, , genderMarker] = mrzMatch;
      if (idDigits) result.emiratesId = formatEidNumber(idDigits);
      if (nationalityCode) result.nationality = nationalityCode;
      if (/^\d{6}$/.test(dobDigits)) {
        const yy = dobDigits.slice(0, 2);
        const mm = dobDigits.slice(2, 4);
        const dd = dobDigits.slice(4, 6);
        const year = Number(yy) >= 70 ? 1900 + Number(yy) : 2000 + Number(yy);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        result.dob = `${dd}/${monthNames[Number(mm) - 1] || mm}/${year}`;
      }
      if (genderMarker === 'M' || genderMarker === 'F') {
        result.gender = genderMarker === 'M' ? 'Male' : 'Female';
      }
    }
  }

  result.fullName = [result.firstName, result.middleName, result.lastName].filter(Boolean).join(' ').trim();
  return result;
}

function mapGlassReaderResponse(raw) {
  const d = raw?.body?.data || raw?.data || raw;
  if (!d || typeof d !== 'object') return null;

  const hasData = Boolean(
    (d.IdNumber || d.idNumber || '').replace(/\D/g, '') ||
    (d.FirstNameEnglish || d.firstNameEnglish || '').trim() ||
    (d.FullNameEnglish || d.fullNameEnglish || '').trim()
  );
  if (!hasData) return null;

  const parsed = parseEidCardData({
    emiratesId: d.IdNumber || d.idNumber,
    firstName: d.FirstNameEnglish || d.firstNameEnglish,
    middleName: d.MiddleNameEnglish || d.middleNameEnglish,
    lastName: d.LastNameEnglish || d.lastNameEnglish,
    fullName: d.FullNameEnglish || d.fullNameEnglish,
    dob: formatDotDate(d.DateOfBirth || d.dateOfBirth),
    gender: d.Gender || d.gender,
    nationality: d.NationalityEnglish || d.nationalityEnglish,
    expiryDate: formatDotDate(d.ExpiryDate || d.expiryDate),
    CardExpiryDate: formatDotDate(d.ExpiryDate || d.expiryDate)
  });

  const photo = d.CardHolderPhoto || d.cardHolderPhoto;
  if (photo && !String(photo).startsWith('data:')) {
    parsed.photoDataUrl = `data:image/jpeg;base64,${photo}`;
  }

  parsed.message = parsed.emiratesId
    ? 'Emirates ID read from GlassReader.'
    : 'GlassReader connected but card fields are empty. Read the card in GlassReader first.';

  return parsed;
}

function mapCardholderRecord(cardholder) {
  if (!cardholder || !cardholder.idNumber) return null;

  let dob = cardholder.dateOfBirth;
  if (dob instanceof Date) {
    dob = `${String(dob.getDate()).padStart(2, '0')}/${MONTH_NAMES[dob.getMonth()]}/${dob.getFullYear()}`;
  } else if (typeof dob === 'string' && dob.includes('T')) {
    const parsedDate = new Date(dob);
    if (!Number.isNaN(parsedDate.getTime())) {
      dob = `${String(parsedDate.getDate()).padStart(2, '0')}/${MONTH_NAMES[parsedDate.getMonth()]}/${parsedDate.getFullYear()}`;
    }
  }

  const genderValue = String(cardholder.gender || '').toUpperCase();
  const gender = genderValue === 'F' || genderValue === 'FEMALE'
    ? 'Female'
    : genderValue === 'M' || genderValue === 'MALE'
      ? 'Male'
      : cardholder.gender || '';

  return parseEidCardData({
    emiratesId: cardholder.idNumber,
    firstName: cardholder.firstNameEnglish,
    middleName: cardholder.middleNameEnglish,
    lastName: cardholder.lastNameEnglish,
    dob,
    gender,
    nationality: cardholder.nationalityEnglish,
    expiryDate: cardholder.expiryDate
  });
}

function fetchGlassReaderPersonData({ baseUrl = 'http://127.0.0.1:7208', timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    const reqUrl = `${String(baseUrl).replace(/\/$/, '')}/getPersonData`;
    const req = http.get(reqUrl, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const mapped = mapGlassReaderResponse(json);
          if (mapped && (mapped.emiratesId || mapped.firstName || mapped.fullName)) {
            resolve({ success: true, data: mapped, source: 'glassreader' });
            return;
          }
          resolve({
            success: false,
            error: 'GlassReader returned empty data. Open GlassReader, place the Emirates ID on the reader, and read the card first.'
          });
        } catch (err) {
          resolve({ success: false, error: `Invalid response from GlassReader: ${err.message}` });
        }
      });
    });

    req.on('error', () => {
      resolve({
        success: false,
        error: 'Cannot connect to GlassReader on port 7208. Start GlassReader from C:\\Program Files (x86)\\GlassReader\\bin\\GlassReader.exe'
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'GlassReader request timed out. Read the Emirates ID card in GlassReader, then try again.'
      });
    });
  });
}

function readCardOnce({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const pcsc = pcsclite();
    let settled = false;
    let timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { pcsc.close(); } catch (_) {}
      resolve({ success: false, error: 'No card detected within timeout.' });
    }, timeoutMs);

    pcsc.on('reader', (reader) => {
      if (settled) return;
      reader.on('status', (status) => {
        if (settled) return;
        if (!(status.state & reader.SCARD_STATE_PRESENT)) return;
        settled = true;
        clearTimeout(timer);

        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED, protocol: reader.SCARD_PROTOCOL_T0 | reader.SCARD_PROTOCOL_T1 }, (err, protocol) => {
          if (err) {
            try { pcsc.close(); } catch (_) {}
            resolve({ success: false, error: err.message });
            return;
          }

          const selectApp = Buffer.from([0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01]);
          reader.transmit(selectApp, 256, protocol, (selErr) => {
            if (selErr) {
              try { reader.disconnect(reader.SCARD_LEAVE_CARD, () => {}); } catch (_) {}
              try { pcsc.close(); } catch (_) {}
              resolve({ success: false, error: selErr.message });
              return;
            }

            // Get card UID first
            reader.transmit(Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]), 256, protocol, (uidErr, uidData) => {
              const cardData = {
                emiratesId: '',
                firstName: '',
                lastName: '',
                dob: '',
                gender: '',
                nationality: '',
                cardDetected: true,
                uid: uidErr || !uidData ? '' : uidData.toString('hex').toUpperCase(),
                message: ''
              };

              // Try to read ATR (Answer to Reset) for card info
              try {
                const atrBuffer = reader.getAttrib(reader.SCARD_ATTR_ATR_STRING) || Buffer.alloc(0);
                if (atrBuffer.length > 0) {
                  cardData.atr = atrBuffer.toString('hex').toUpperCase();
                }
              } catch (_) {
                // ATR not available
              }

              // Message explaining card was detected
              cardData.message = cardData.uid 
                ? 'Card detected. Card data requires GlassReader software or ICA Toolkit to decrypt.'
                : 'Card detected but could not read UID.';

              try { reader.disconnect(reader.SCARD_LEAVE_CARD, () => {}); } catch (_) {}
              try { pcsc.close(); } catch (_) {}
              resolve({ success: true, data: cardData });
            });
          });
        });
      });
    });

    pcsc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { pcsc.close(); } catch (_) {}
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = {
  formatEidNumber,
  formatDotDate,
  parseEidCardData,
  mapGlassReaderResponse,
  mapCardholderRecord,
  fetchGlassReaderPersonData,
  readCardOnce
};
