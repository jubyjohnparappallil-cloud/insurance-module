// L2 Logsheet - adds L2 button to claims and generates L2 format
(function() {
  // Wait for page to load
  document.addEventListener("DOMContentLoaded", function() {
    setTimeout(addL2Button, 2000);
  });

  function addL2Button() {
    // Find the claims actions HTML and inject L2 button via MutationObserver
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            var logBtns = node.querySelectorAll ? node.querySelectorAll('.claims-act-btn.logsheet') : [];
            logBtns.forEach(function(btn) {
              if (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('logsheet2')) {
                var l2btn = document.createElement('button');
                l2btn.className = 'claims-act-btn logsheet2';
                l2btn.title = 'Logsheet L2';
                l2btn.textContent = 'L2';
                l2btn.style.cssText = 'background:linear-gradient(#7b1fa2,#4a148c);border-color:#4a148c;';
                btn.after(l2btn);
              }
            });
          }
        });
      });
    });
    var claimsScreen = document.getElementById('claimsListScreen');
    if (claimsScreen) {
      observer.observe(claimsScreen, { childList: true, subtree: true });
    }

    // Handle L2 button clicks via event delegation
    document.addEventListener('click', function(e) {
      if (e.target.classList && e.target.classList.contains('logsheet2')) {
        var row = e.target.closest('tr');
        if (!row) return;
        var claimId = row.cells[0] ? row.cells[0].textContent.trim() : '';
        var fromDate = row.cells[1] ? row.cells[1].textContent.trim() : '';
        var toDate = row.cells[2] ? row.cells[2].textContent.trim() : '';
        var mrNo = row.cells[3] ? row.cells[3].textContent.trim() : '';
        var patientName = row.cells[4] ? row.cells[4].textContent.trim() : '';

        // Fetch data same as L
        fetch('/api/consultations?mrNo=' + encodeURIComponent(mrNo))
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var entries = [];
            if (d.success && d.data && d.data.length > 0) {
              var consult = d.data[0];
              var procs = consult.procedures || [];
              var slNo = 1;
              var startParts = fromDate.split('-');
              var startDt = startParts.length === 3 ? new Date(startParts[2] + '-' + startParts[1] + '-' + startParts[0]) : new Date();
              procs.forEach(function(proc, idx) {
                var dt = new Date(startDt);
                dt.setDate(dt.getDate() + idx);
                entries.push({
                  slNo: slNo++,
                  entryDate: String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear(),
                  treatmentDone: proc.description || '',
                  inTime: proc.inTime || '10:00 AM',
                  outTime: proc.outTime || '11:00 AM',
                  progress: proc.progress || ''
                });
              });
            }
            if (entries.length === 0) {
              // Try claim details
              fetch('/api/claim-details/' + claimId)
                .then(function(r2) { return r2.json(); })
                .then(function(d2) {
                  if (d2.success && d2.data && d2.data.details && d2.data.details.length > 0) {
                    var sn = 1;
                    var sp = fromDate.split('-');
                    var sd = new Date(sp[2] + '-' + sp[1] + '-' + sp[0]);
                    d2.data.details.forEach(function(det, idx) {
                      var dt = new Date(sd);
                      dt.setDate(dt.getDate() + idx);
                      entries.push({
                        slNo: sn++,
                        entryDate: String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear(),
                        treatmentDone: det.description || '',
                        inTime: det.inTime || '10:00 AM',
                        outTime: det.outTime || '11:00 AM',
                        progress: det.progress || ''
                      });
                    });
                  }
                  openL2(patientName, fromDate, toDate, mrNo, entries);
                }).catch(function() { openL2(patientName, fromDate, toDate, mrNo, []); });
            } else {
              openL2(patientName, fromDate, toDate, mrNo, entries);
            }
          }).catch(function() { openL2(patientName, fromDate, toDate, mrNo, []); });
      }
    });
  }

  function openL2(patientName, fromDate, toDate, mrNo, entries) {
    var win = window.open('', '_blank', 'width=750,height=950');
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Log Sheet L2 - ' + patientName + '</title><style>' +
      '@page{size:A4;margin:12mm 14mm}' +
      'body{margin:0;padding:0;font-family:Arial,sans-serif;font-size:11px;color:#000}' +
      '.page{padding:20px 30px}' +
      '.page-title{text-align:center;font-size:16px;font-weight:700;letter-spacing:2px;text-decoration:underline;margin:6px 0 12px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{border:1px solid #444;padding:6px 5px;font-size:10px;font-weight:700;background:#d0d0d0;text-align:center}' +
      'td{border:1px solid #444;padding:8px 6px;font-size:10px;vertical-align:top;line-height:1.5}' +
      '.sl{width:32px;text-align:center}.date-col{width:70px;text-align:center}.treatment-col{width:130px}.time-col{width:55px;text-align:center}.progress-col{width:auto}.sig-col{width:60px;text-align:center}' +
      '.sign-row{margin-top:20px;display:flex;justify-content:flex-end;align-items:flex-end;gap:20px;padding-right:20px}' +
      '.sign-box{text-align:center}.sign-box img{height:44px;display:block;margin:0 auto}.sign-box .sig-label{font-size:9px;font-weight:700;line-height:1.4;margin-top:2px}' +
      '.seal-box img{height:65px}' +
      '.no-sign .sign-row{display:none!important}' +
      '.toolbar{position:fixed;top:0;left:0;right:0;height:40px;background:#fff;border-bottom:2px solid #2e7d32;display:flex;align-items:center;padding:0 15px;gap:8px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.1)}' +
      '.toolbar button{height:28px;padding:0 14px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer}' +
      '.btn-sign{background:#2e7d32;color:#fff}.btn-nosign{background:#fff;color:#2e7d32;border:1.5px solid #2e7d32}.btn-pdf{background:#555;color:#fff}.btn-export{background:#333;color:#fff}' +
      '.dropdown{position:relative;display:inline-block}.dropdown-menu{display:none;position:absolute;top:32px;left:0;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:99;min-width:100px}.dropdown-menu button{display:block;width:100%;padding:8px 12px;border:none;background:none;text-align:left;cursor:pointer;font-size:12px;font-weight:700}.dropdown-menu button:hover{background:#f0f0f0}' +
      '@media print{.toolbar{display:none!important}.page{padding:0}}' +
      '</style></head><body>' +
      '<div class="toolbar">' +
        '<button class="btn-sign" onclick="document.body.classList.remove(\'no-sign\');window.print()">Print WITH Sign & Seal</button>' +
        '<button class="btn-nosign" onclick="document.body.classList.add(\'no-sign\');window.print();setTimeout(function(){document.body.classList.remove(\'no-sign\')},1000)">Print WITHOUT Sign</button>' +
        '<button class="btn-pdf" onclick="window.print()">Save as PDF</button>' +
        '<div class="dropdown"><button class="btn-export" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'">&#9660; Export</button><div class="dropdown-menu"><button onclick="doWord()">Word</button><button onclick="doExcel()">Excel</button></div></div>' +
      '</div>' +
      '<div class="page" style="margin-top:50px">' +
        '<div style="text-align:center"><img src="logo.png" style="height:55px" onerror="this.style.display=\'none\'"></div>' +
        '<div class="page-title">LOG SHEET</div>' +
        '<table><thead><tr><th class="sl">SL NO.</th><th class="date-col">DATE</th><th class="treatment-col">TREATMENT DONE</th><th class="time-col">IN TIME</th><th class="time-col">OUT TIME</th><th class="progress-col">PROGRESS</th><th class="sig-col">DR. SIGN</th><th class="sig-col">PT. SIGN</th></tr></thead><tbody>';

    if (entries.length > 0) {
      entries.forEach(function(e, i) {
        html += '<tr><td class="sl">' + (e.slNo || (i + 1)) + '</td><td class="date-col">' + (e.entryDate || '') + '</td><td class="treatment-col">' + (e.treatmentDone || '') + '</td><td class="time-col">' + (e.inTime || '') + '</td><td class="time-col">' + (e.outTime || '') + '</td><td class="progress-col">' + (e.progress || '').replace(/\n/g, '<br>') + '</td><td class="sig-col"></td><td class="sig-col"></td></tr>';
      });
    } else {
      for (var i = 1; i <= 15; i++) {
        html += '<tr><td class="sl">' + i + '</td><td class="date-col" contenteditable="true"></td><td class="treatment-col" contenteditable="true"></td><td class="time-col" contenteditable="true"></td><td class="time-col" contenteditable="true"></td><td class="progress-col" contenteditable="true"></td><td class="sig-col"></td><td class="sig-col"></td></tr>';
      }
    }

    html += '</tbody></table>' +
      '<div class="sign-row"><div class="seal-box"><img src="seal.png" onerror="this.style.display=\'none\'"></div><div class="sign-box"><img src="signature.png" onerror="this.style.display=\'none\'"><div class="sig-label">Doctor<br>AYURVEDA PRACTITIONER<br>DHA Lic. No.: 02548615-004</div></div></div>' +
      '</div>' +
      '<script>' +
      'function doWord(){var c="<html><head><meta charset=utf-8><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:3px}th{background:#ddd}</style></head><body>"+document.querySelector(".page").innerHTML+"</body></html>";var b=new Blob([c],{type:"application/msword"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="LogSheet_L2.doc";a.click()}' +
      'function doExcel(){var t=document.querySelector("table");var rows=t.querySelectorAll("tr");var csv="";rows.forEach(function(r){var c=[];r.querySelectorAll("th,td").forEach(function(td){c.push(td.textContent.trim())});csv+=c.join(",")+String.fromCharCode(10)});var b=new Blob([csv],{type:"text/csv"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="LogSheet_L2.csv";a.click()}' +
      '<\/script></body></html>';

    win.document.write(html);
    win.document.close();
  }
})();
