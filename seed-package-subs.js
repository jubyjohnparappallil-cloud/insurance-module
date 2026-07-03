/**
 * Seed package subscription data from the screenshot into clinic-data.json
 * This populates the report until MySQL is available.
 * 
 * Usage: node seed-package-subs.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'clinic-data.json');

// Data transcribed from the clinic screenshot
const subscriptions = [
  { mrNo: "3905", patientName: "ROOPA MANCHIKATTE PRAVEEN KU...", mobile: "+971568991383", packageCode: "AY000056", packageName: "20 SESSIONS WITH STEAM", startDate: "26-02-2026", endDate: "25-02-2027", totalSessions: 20, usedSessions: 2, balanceSessions: 18 },
  { mrNo: "771", patientName: "Samir Aravind Shah", mobile: "+971559499923", packageCode: "AY000054", packageName: "10 SESSION WITHOUT STEAM", startDate: "13-02-2026", endDate: "13-08-2026", totalSessions: 10, usedSessions: 6, balanceSessions: 4 },
  { mrNo: "4312", patientName: "FAISAL KOYHANGATTU ABDULLA K...", mobile: "+971504523661", packageCode: "AY000068", packageName: "10 SESSIONS WITHOUT STEAM", startDate: "13-02-2026", endDate: "13-08-2026", totalSessions: 10, usedSessions: 0, balanceSessions: 10 },
  { mrNo: "1604", patientName: "Suja Shiyas Abdul karim", mobile: "+971504543007", packageCode: "AY000054", packageName: "ABHYANGAM+STEAM", startDate: "09-02-2026", endDate: "10-09-2026", totalSessions: 10, usedSessions: 3, balanceSessions: 7 },
  { mrNo: "1604", patientName: "Suja Shiyas Abdul karim", mobile: "+971504543007", packageCode: "AY000061", packageName: "40 SESSIONS WITH STEAM", startDate: "01-02-2026", endDate: "31-05-2026", totalSessions: 40, usedSessions: 9, balanceSessions: 31 },
  { mrNo: "2746", patientName: "NIDHEESH PAYYAN VALAPPIL", mobile: "+971502523415", packageCode: "2620", packageName: "NJAVARA FACIAL", startDate: "01-02-2026", endDate: "31-01-2027", totalSessions: 10, usedSessions: 4, balanceSessions: 6 },
  { mrNo: "3815", patientName: "HARY AHBULO", mobile: "+971563987125", packageCode: "2648", packageName: "30 SESSION WITH 10 STEAM", startDate: "18-01-2026", endDate: "31-01-2027", totalSessions: 30, usedSessions: 12, balanceSessions: 18 },
  { mrNo: "3016", patientName: "GOVIDHA MUKESH SHEWAKRAMANI", mobile: "+971581329323", packageCode: "2619", packageName: "ABHYANGAM+STEAM", startDate: "09-01-2026", endDate: "09-03-2027", totalSessions: 20, usedSessions: 5, balanceSessions: 15 },
  { mrNo: "3910", patientName: "AKHIL RAMACHANDRAN NAIR MY...", mobile: "+971559484664", packageCode: "AY000061", packageName: "40 SESSION WITH STEAM", startDate: "28-12-2025", endDate: "28-12-2026", totalSessions: 40, usedSessions: 10, balanceSessions: 30 },
  { mrNo: "447", patientName: "Shadab Kunju Muhammad", mobile: "+971555570527", packageCode: "AY000061", packageName: "40 SESSION WITH STEAM", startDate: "11-12-2025", endDate: "22-12-2026", totalSessions: 32, usedSessions: 7, balanceSessions: 25 },
  { mrNo: "447", patientName: "Shadab Kunju Muhammad", mobile: "+971555570527", packageCode: "2619", packageName: "ABHYANGAM+STEAM", startDate: "19-12-2025", endDate: "19-12-2027", totalSessions: 40, usedSessions: 45, balanceSessions: -5 },
  { mrNo: "3907", patientName: "VIKAS KUMAR JALAN", mobile: "+971589038981", packageCode: "2618", packageName: "ABHYANGAM+STEAM", startDate: "19-12-2025", endDate: "31-12-2026", totalSessions: 20, usedSessions: 27, balanceSessions: -7 },
  { mrNo: "3395", patientName: "NABEEL HUSSAIN HUSSAIN CHERY...", mobile: "+971507308738", packageCode: "AY000051", packageName: "20 SESSIONS WITH STEAM", startDate: "07-12-2025", endDate: "31-12-2026", totalSessions: 26, usedSessions: 22, balanceSessions: 4 },
  { mrNo: "4055", patientName: "JAWAD MOIDU MOIDU ARAKKAL", mobile: "+971580232878", packageCode: "2619", packageName: "ABHYANGAM+STEAM", startDate: "30-11-2025", endDate: "30-11-2026", totalSessions: 20, usedSessions: 14, balanceSessions: 6 },
  { mrNo: "3781", patientName: "JACOB ANTONY ARATTUKALAM JAC...", mobile: "+971504516949", packageCode: "AY000051", packageName: "20 SESSIONS WITH STEAM", startDate: "30-11-2025", endDate: "08-08-2028", totalSessions: 15, usedSessions: 0, balanceSessions: 15 },
  { mrNo: "2380", patientName: "JINOOP PUTHANPURAYIL KARTHYAYAL...", mobile: "+971543430747", packageCode: "AY000054", packageName: "10 SESSION WITHOUT STEAM", startDate: "22-11-2025", endDate: "30-06-2026", totalSessions: 10, usedSessions: 3, balanceSessions: 7 },
  { mrNo: "1973", patientName: "ROSEMARY BONNY MINACHERY PA...", mobile: "+971563279623", packageCode: "2618", packageName: "ABHYANGAM", startDate: "01-11-2025", endDate: "31-07-2026", totalSessions: 10, usedSessions: 0, balanceSessions: 10 },
  { mrNo: "1650", patientName: "George Gigi George", mobile: "+971545068375", packageCode: "2619", packageName: "ABHYANGAM+STEAM", startDate: "19-10-2025", endDate: "31-07-2026", totalSessions: 40, usedSessions: 0, balanceSessions: 40 },
  { mrNo: "2644", patientName: "RIMA JOHNSON MATHEW KALLIVE...", mobile: "+971506324089", packageCode: "2613", packageName: "POSTNATAL SERVICE - HOME SERVICE - 14 DAYS", startDate: "19-10-2025", endDate: "31-12-2025", totalSessions: 15, usedSessions: 1, balanceSessions: 14 },
  { mrNo: "3322", patientName: "SUKUMARI GURAJAS", mobile: "+971586446283", packageCode: "2618", packageName: "ABHYANGAM", startDate: "14-10-2025", endDate: "31-12-2025", totalSessions: 15, usedSessions: 3, balanceSessions: 12 },
  { mrNo: "3825", patientName: "BINCY BABY", mobile: "+971556097463", packageCode: "2636", packageName: "POSTNATAL SERVICE - CLINIC SERVICE - 7 DAYS", startDate: "02-10-2025", endDate: "02-11-2025", totalSessions: 7, usedSessions: 0, balanceSessions: 7 },
  { mrNo: "3247", patientName: "RIYAS KURISHED SHAIKH", mobile: "+971569840320", packageCode: "AY000068", packageName: "12 SESSION WITHOUT STEAM", startDate: "20-09-2025", endDate: "25-04-2026", totalSessions: 12, usedSessions: 1, balanceSessions: 11 },
  { mrNo: "3923", patientName: "ABDUL JABIR THANBET ABUNSAMA...", mobile: "+971504717340", packageCode: "AY000054", packageName: "10 SESSION WITHOUT STEAM", startDate: "20-09-2025", endDate: "20-05-2026", totalSessions: 10, usedSessions: 2, balanceSessions: 8 },
  { mrNo: "3404", patientName: "MOHAMMED SUNEESH", mobile: "+971504125027", packageCode: "AY000054", packageName: "20 SESSIONS WITH STEAM", startDate: "19-09-2025", endDate: "16-06-2026", totalSessions: 20, usedSessions: 0, balanceSessions: 20 },
  { mrNo: "4991", patientName: "JOHN KURJAN KURJAN", mobile: "+971586900819", packageCode: "AY000054", packageName: "10 SESSION WITHOUT STEAM", startDate: "16-09-2025", endDate: "07-07-2026", totalSessions: 10, usedSessions: 2, balanceSessions: 8 },
  { mrNo: "785", patientName: "Gopal Srinivasan Mangalam", mobile: "+971504311962", packageCode: "AY000069", packageName: "12 SESSION WITHOUT STEAM", startDate: "13-09-2025", endDate: "12-12-2025", totalSessions: 12, usedSessions: 8, balanceSessions: 4 },
  { mrNo: "1932", patientName: "THANVEER AHMED", mobile: "+971581693123", packageCode: "2644", packageName: "18 SESSION WITH STEAM", startDate: "30-08-2025", endDate: "31-12-2026", totalSessions: 18, usedSessions: 8, balanceSessions: 10 },
  { mrNo: "2055", patientName: "ABDOUL AWAD SADEK ELAWAD", mobile: "+971501757119", packageCode: "2643", packageName: "5 SESSION WITH STEAM", startDate: "22-08-2025", endDate: "22-11-2025", totalSessions: 5, usedSessions: 1, balanceSessions: 4 },
  { mrNo: "3100", patientName: "MINGYU SUN", mobile: "+971524290118", packageCode: "AY000054", packageName: "10 SESSION WITHOUT STEAM", startDate: "22-09-2025", endDate: "28-02-2026", totalSessions: 10, usedSessions: 5, balanceSessions: 5 },
  { mrNo: "613", patientName: "Sangeeth Mathew", mobile: "+971508999874", packageCode: "AY000059", packageName: "30 SESSION WITH STEAM", startDate: "19-08-2025", endDate: "15-09-2026", totalSessions: 30, usedSessions: 17, balanceSessions: 13 }
];

// Load the JSON database
const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
db.packageSubscriptions = subscriptions;
fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

console.log(`Seeded ${subscriptions.length} package subscriptions into clinic-data.json`);
console.log('The Patient Package Subscription Report will now display this data.');
