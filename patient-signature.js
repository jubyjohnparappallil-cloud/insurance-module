// Patient Signature - capture/upload signature per patient
// Adds a "Sign" button in patient view and stores signature per MR number
(function() {
  document.addEventListener("DOMContentLoaded", function() {
    setTimeout(init, 2000);
  });

  function init() {
    // Add "Patient Sign" button to the arrived appointment menu
    var arrivedMenu = document.getElementById("arrivedMenu");
    if (arrivedMenu) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-arrived-action", "patientSign");
      btn.innerHTML = '<span class="menu-icon arr-green">&#9998;</span>Patient Signature';
      // Insert before the last buttons
      var deleteBtn = arrivedMenu.querySelector('[data-arrived-action="deleteVisits"]');
      if (deleteBtn) arrivedMenu.insertBefore(btn, deleteBtn);
    }

    // Listen for patientSign action
    document.addEventListener("click", function(e) {
      var btn = e.target.closest('[data-arrived-action="patientSign"]');
      if (btn) {
        var appointments = window.appointments || [];
        var idx = window.selectedAppointmentIndex;
        if (idx != null && appointments[idx]) {
          var appt = appointments[idx];
          openPatientSignModal(appt.mrNo, appt.patient || appt.patientName || "");
        }
      }
    });
  }

  // Create the patient signature modal
  var modalHtml = '<div id="patientSignModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;align-items:center;justify-content:center">' +
    '<div style="background:#fff;border-radius:8px;padding:20px;width:min(90vw,500px);box-shadow:0 4px 20px rgba(0,0,0,0.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0;font-size:14px;color:#1b5e20">Patient Signature</h3><button onclick="closePatientSign()" style="border:none;background:none;font-size:20px;cursor:pointer">&times;</button></div>' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Patient: <span id="patSignPatientName"></span> (MR: <span id="patSignMrNo"></span>)</div>' +
      '<div style="margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;margin-bottom:4px">Option 1: Draw signature below</div>' +
        '<canvas id="patSignCanvas" width="450" height="150" style="border:2px solid #2e7d32;border-radius:4px;cursor:crosshair;display:block;touch-action:none;background:#fff"></canvas>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
          '<button onclick="clearPatSignCanvas()" style="padding:4px 12px;font-size:11px;border:1px solid #999;border-radius:3px;cursor:pointer">Clear</button>' +
          '<button onclick="savePatSignDrawn()" style="padding:4px 12px;font-size:11px;background:#1b5e20;color:#fff;border:none;border-radius:3px;cursor:pointer">Save Drawn Signature</button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;margin-bottom:4px">Option 2: Upload signature image</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<input type="file" id="patSignUpload" accept="image/*" style="font-size:11px">' +
          '<button onclick="uploadPatSign()" style="padding:4px 12px;font-size:11px;background:#1b5e20;color:#fff;border:none;border-radius:3px;cursor:pointer">Upload & Save</button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;margin-bottom:4px">Option 3: Send Signature Link to Patient</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<button onclick="copyPatSignLink()" style="padding:4px 12px;font-size:11px;background:#388e3c;color:#fff;border:none;border-radius:3px;cursor:pointer">&#128279; Copy Sign Link</button>' +
          '<button onclick="sendPatSignWhatsApp()" style="padding:4px 12px;font-size:11px;background:#25d366;color:#fff;border:none;border-radius:3px;cursor:pointer">&#128172; Send via WhatsApp</button>' +
          '<span id="patSignLinkCopied" style="font-size:10px;color:#2e7d32;display:none">Link copied!</span>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;text-align:center">' +
        '<div style="font-size:11px;font-weight:700;margin-bottom:4px">Current Saved Signature:</div>' +
        '<img id="patSignPreview" style="max-height:60px;max-width:200px;border:1px solid #ddd;border-radius:4px" src="" onerror="this.style.display=\'none\'">' +
        '<div id="patSignNoSig" style="font-size:11px;color:#999">No signature saved</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Canvas drawing
  var drawing = false;
  var canvas, ctx;

  window.openPatientSignModal = function(mrNo, patientName) {
    document.getElementById("patSignPatientName").textContent = patientName;
    document.getElementById("patSignMrNo").textContent = mrNo;
    document.getElementById("patientSignModal").style.display = "flex";
    document.getElementById("patientSignModal").dataset.mrNo = mrNo;

    canvas = document.getElementById("patSignCanvas");
    ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";

    // Load existing signature
    fetch("/api/patient-signature/" + encodeURIComponent(mrNo))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success && d.data) {
          document.getElementById("patSignPreview").src = d.data;
          document.getElementById("patSignPreview").style.display = "block";
          document.getElementById("patSignNoSig").style.display = "none";
        } else {
          document.getElementById("patSignPreview").style.display = "none";
          document.getElementById("patSignNoSig").style.display = "block";
        }
      }).catch(function() {});

    // Setup drawing
    canvas.onmousedown = function(e) { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
    canvas.onmousemove = function(e) { if (drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } };
    canvas.onmouseup = function() { drawing = false; };
    canvas.onmouseleave = function() { drawing = false; };
    // Touch support
    canvas.ontouchstart = function(e) { e.preventDefault(); drawing = true; var r = canvas.getBoundingClientRect(); var t = e.touches[0]; ctx.beginPath(); ctx.moveTo(t.clientX - r.left, t.clientY - r.top); };
    canvas.ontouchmove = function(e) { e.preventDefault(); if (!drawing) return; var r = canvas.getBoundingClientRect(); var t = e.touches[0]; ctx.lineTo(t.clientX - r.left, t.clientY - r.top); ctx.stroke(); };
    canvas.ontouchend = function() { drawing = false; };
  };

  window.closePatientSign = function() {
    document.getElementById("patientSignModal").style.display = "none";
  };

  window.clearPatSignCanvas = function() {
    var c = document.getElementById("patSignCanvas");
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  window.savePatSignDrawn = function() {
    var c = document.getElementById("patSignCanvas");
    var data = c.toDataURL("image/png");
    var mrNo = document.getElementById("patientSignModal").dataset.mrNo;
    savePatientSignature(mrNo, data);
  };

  window.uploadPatSign = function() {
    var input = document.getElementById("patSignUpload");
    if (!input.files || !input.files[0]) { alert("Select an image first"); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var mrNo = document.getElementById("patientSignModal").dataset.mrNo;
      savePatientSignature(mrNo, e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
  };

  function savePatientSignature(mrNo, data) {
    fetch("/api/patient-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mrNo: mrNo, signature: data })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) {
        alert("Patient signature saved!");
        document.getElementById("patSignPreview").src = data;
        document.getElementById("patSignPreview").style.display = "block";
        document.getElementById("patSignNoSig").style.display = "none";
      }
    }).catch(function() {
      // Save locally as fallback
      localStorage.setItem("patSign_" + mrNo, data);
      alert("Patient signature saved (local)!");
      document.getElementById("patSignPreview").src = data;
      document.getElementById("patSignPreview").style.display = "block";
      document.getElementById("patSignNoSig").style.display = "none";
    });
  }

  // Make getPatientSignature available globally for reports
  window.getPatientSignature = function(mrNo) {
    return localStorage.getItem("patSign_" + mrNo) || "";
  };

  // Copy signature link
  window.copyPatSignLink = function() {
    var mrNo = document.getElementById("patientSignModal").dataset.mrNo;
    // Use ngrok public URL for external access, fallback to LAN IP
    var link = "https://shirt-splotchy-march.ngrok-free.dev/sign?type=patient&mrNo=" + encodeURIComponent(mrNo);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function() {
        var msg = document.getElementById("patSignLinkCopied");
        if (msg) { msg.textContent = "Link copied!"; msg.style.display = "inline"; setTimeout(function() { msg.style.display = "none"; }, 5000); }
      });
    } else {
      prompt("Copy this link and send to patient:", link);
    }
  };

  // Send via WhatsApp
  window.sendPatSignWhatsApp = function() {
    var mrNo = document.getElementById("patientSignModal").dataset.mrNo;
    var link = "https://shirt-splotchy-march.ngrok-free.dev/sign?type=patient&mrNo=" + encodeURIComponent(mrNo);
    // Find patient mobile
    var patientsList = window.patients || [];
    var pat = patientsList.find(function(p) { return p.mrNo === mrNo; });
    var mobile = pat ? (pat.mobile || pat.whatsapp || "") : "";
    // Clean mobile number - ensure it starts with country code
    mobile = mobile.replace(/[^0-9]/g, "");
    if (mobile.length > 0 && !mobile.startsWith("971")) {
      if (mobile.startsWith("0")) mobile = "971" + mobile.substring(1);
      else if (mobile.length === 9) mobile = "971" + mobile;
    }
    var patientName = pat ? [pat.firstName, pat.lastName].filter(Boolean).join(" ") : "";
    var text = "Dear " + patientName + ", please sign here for your medical records at Hridhya Ayurvedic:\n" + link;
    var whatsappUrl = "https://wa.me/" + mobile + "?text=" + encodeURIComponent(text);
    window.open(whatsappUrl, "_blank");
  };
})();
