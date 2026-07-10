// Fix OMI Key Reader - reads from /api/glassreader/person instead of popup
(function() {
  // Override the simulateReadEID function after page loads
  setTimeout(function() {
    if (typeof window.simulateReadEID !== 'undefined' || document.querySelector('.read-eid')) {
      // Replace the read-eid button click handler
      var btn = document.querySelector('.read-eid');
      if (btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          readEIDDirect();
        };
        // Also remove any existing event listeners by cloning
        var newBtn = btn.cloneNode(true);
        newBtn.onclick = function(e) {
          e.preventDefault();
          readEIDDirect();
        };
        btn.parentNode.replaceChild(newBtn, btn);
      }
    }
  }, 2000);

  window.readEIDDirect = function() {
    // Show loading overlay
    var overlay = document.createElement('div');
    overlay.id = 'eidReadingOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:30px 40px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:400px"><div style="font-size:40px;margin-bottom:10px">&#128179;</div><h3 style="color:#1b5e20;margin:0 0 10px">Reading Emirates ID...</h3><p style="color:#666;font-size:13px;margin:0">Please wait while we read the card data from GlassReader</p><div style="margin-top:15px;width:40px;height:40px;border:4px solid #e0e0e0;border-top:4px solid #1b5e20;border-radius:50%;animation:spin 1s linear infinite;margin:15px auto"></div></div>';
    var style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    overlay.appendChild(style);
    document.body.appendChild(overlay);

    fetch('/api/glassreader/person')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        removeOverlay();
        if (d && d.success && d.data) {
          var c = d.data;
          // Fill the form using fillFromScan if available
          if (window.fillFromScan) {
            window.fillFromScan({
              firstName: c.firstName || '',
              middleName: c.middleName || '',
              lastName: c.lastName || '',
              emiratesId: c.emiratesId || '',
              eid: c.emiratesId || '',
              nationality: c.nationality || '',
              gender: c.gender || '',
              dob: c.dob || '',
              eidExpiry: c.eidExpiry || '',
              photoDataUrl: c.photoDataUrl || ''
            });
          }
          showSuccess(c);
        } else {
          showError(d ? d.error : 'No response from server');
        }
      })
      .catch(function(e) {
        removeOverlay();
        showError('Cannot connect to GlassReader. Make sure it is running.');
      });
  };

  function removeOverlay() {
    var el = document.getElementById('eidReadingOverlay');
    if (el) el.remove();
  }

  function showSuccess(c) {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center';
    msg.innerHTML = '<div style="background:#fff;border-radius:12px;padding:30px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:450px">' +
      '<div style="font-size:40px;margin-bottom:10px">&#9989;</div>' +
      '<h3 style="color:#1b5e20;margin:0 0 12px">Card Read Successfully!</h3>' +
      '<div style="text-align:left;font-size:13px;background:#f5f5f5;padding:12px;border-radius:6px;margin-bottom:15px">' +
        '<div><b>Name:</b> ' + (c.fullName || '') + '</div>' +
        '<div><b>Emirates ID:</b> ' + (c.emiratesId || '') + '</div>' +
        '<div><b>DOB:</b> ' + (c.dob || '') + '</div>' +
        '<div><b>Nationality:</b> ' + (c.nationality || '') + '</div>' +
        '<div><b>Gender:</b> ' + (c.gender || '') + '</div>' +
      '</div>' +
      '<button onclick="this.closest(\'div[style]\').remove()" style="padding:10px 30px;background:#1b5e20;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer">OK</button>' +
    '</div>';
    document.body.appendChild(msg);
  }

  function showError(errorMsg) {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center';
    msg.innerHTML = '<div style="background:#fff;border-radius:12px;padding:30px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:400px">' +
      '<div style="font-size:40px;margin-bottom:10px">&#9888;</div>' +
      '<h3 style="color:#c00;margin:0 0 12px">Card Read Failed</h3>' +
      '<p style="color:#666;font-size:13px;margin:0 0 15px">' + errorMsg + '</p>' +
      '<button onclick="this.closest(\'div[style]\').remove()" style="padding:10px 30px;background:#666;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin:4px">Close</button>' +
      '<button onclick="this.closest(\'div[style]\').remove();readEIDDirect()" style="padding:10px 30px;background:#ff9800;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin:4px">Try Again</button>' +
    '</div>';
    document.body.appendChild(msg);
  }
})();
