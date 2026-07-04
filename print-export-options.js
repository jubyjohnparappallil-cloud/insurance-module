// Adds Word and Excel export buttons to all claims report windows
// Also removes white/gray background from seal/signature images
(function() {
  var originalOpen = window.open;

  window.open = function(url, target, features) {
    var win = originalOpen.call(window, url, target, features);

    setTimeout(function() {
      try {
        if (!win || !win.document) return;

        // Add CSS to remove background from seal/signature images
        var style = win.document.createElement('style');
        style.textContent = 'img[onerror], .seal-box img, .seal-img, .sign-box img, .sig-img, .clinic-round-seal, .sign-area img { mix-blend-mode: multiply !important; }';
        win.document.head.appendChild(style);

        var toolbar = win.document.querySelector('.toolbar');
        if (!toolbar) return;
        if (toolbar.querySelector('.export-word-btn')) return;

        // Add Word button
        var wordBtn = win.document.createElement('button');
        wordBtn.className = 'export-word-btn';
        wordBtn.style.cssText = 'height:28px;padding:0 14px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;background:#1565c0;color:#fff;margin-left:6px';
        wordBtn.textContent = 'Word';
        wordBtn.onclick = function() {
          var content = win.document.querySelector('.page,.report-page');
          if (!content) content = win.document.body;
          var html = '<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:4px}th{background:#eee}body{font-family:Arial;font-size:12px}</style></head><body>' + content.innerHTML + '</body></html>';
          var blob = new Blob([html], {type: 'application/msword'});
          var a = win.document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = win.document.title.replace(/[^a-zA-Z0-9]/g, '_') + '.doc';
          a.click();
        };
        toolbar.appendChild(wordBtn);

        // Add Excel button
        var excelBtn = win.document.createElement('button');
        excelBtn.className = 'export-excel-btn';
        excelBtn.style.cssText = 'height:28px;padding:0 14px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;background:#217346;color:#fff;margin-left:6px';
        excelBtn.textContent = 'Excel';
        excelBtn.onclick = function() {
          var tables = win.document.querySelectorAll('table');
          var csv = '';
          tables.forEach(function(t) {
            t.querySelectorAll('tr').forEach(function(r) {
              var cells = [];
              r.querySelectorAll('th,td').forEach(function(c) {
                cells.push('"' + c.textContent.trim().replace(/\n/g, ' ') + '"');
              });
              csv += cells.join(',') + '\n';
            });
            csv += '\n';
          });
          var blob = new Blob([csv], {type: 'text/csv'});
          var a = win.document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = win.document.title.replace(/[^a-zA-Z0-9]/g, '_') + '.csv';
          a.click();
        };
        toolbar.appendChild(excelBtn);

      } catch(e) {}
    }, 500);

    return win;
  };
})();
