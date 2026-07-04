// Insurance Claim Form Templates - Upload templates (NAS, NextCare, etc.)
// Each patient fills their own copy with auto-populated details + signature + seal
(function() {
  document.addEventListener("DOMContentLoaded", function() {
    setTimeout(init, 2000);
  });

  function init() {
    // Add buttons to claims screen
    var claimsScreen = document.getElementById("claimsListScreen");
    if (!claimsScreen) return;

    // Find a toolbar or header area
    var header = claimsScreen.querySelector(".ins-header-right,.toolbar");
    if (!header) {
      var h2 = claimsScreen.querySelector("h2,.screen-title,.ins-header-title");
      if (h2) header = h2.parentElement;
    }
    if (!header) return;

    var btnContainer = document.createElement("div");
    btnContainer.style.cssText = "display:flex;gap:6px;margin:6px 0";
    btnContainer.innerHTML =
      '<button onclick="openTemplateUpload()" style="padding:5px 12px;background:#1565c0;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer">&#128194; Upload Form Template</button>' +
      '<button onclick="openFillForm()" style="padding:5px 12px;background:#388e3c;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer">&#128221; Fill Patient Claim Form</button>';
    header.appendChild(btnContainer);
  }

  // Modal HTML
  var html = '' +
  '<div id="templateUploadModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;align-items:center;justify-content:center">' +
    '<div style="background:#fff;border-radius:8px;width:min(90vw,500px);box-shadow:0 4px 20px rgba(0,0,0,0.3)">' +
      '<div style="background:#1b5e20;color:#fff;padding:10px 16px;font-weight:700;font-size:13px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between">Upload Claim Form Template<button onclick="document.getElementById(\'templateUploadModal\').style.display=\'none\'" style="border:none;background:none;color:#fff;font-size:18px;cursor:pointer">&times;</button></div>' +
      '<div style="padding:20px">' +
        '<p style="font-size:12px;color:#666;margin-bottom:12px">Upload blank insurance claim form templates (NAS, NextCare, ADNIC, etc.). These will be available to fill for each patient.</p>' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Insurance Company Name</label><input id="templateCompany" placeholder="e.g. NAS, NextCare, ADNIC, Daman..." style="width:100%;height:30px;border:1px solid #ccc;border-radius:4px;padding:0 8px;font-size:12px"></div>' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Form Type</label><input id="templateType" placeholder="e.g. Reimbursement Form, Pre-Authorization..." style="width:100%;height:30px;border:1px solid #ccc;border-radius:4px;padding:0 8px;font-size:12px"></div>' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Form File (PDF or Image)</label><input type="file" id="templateFile" accept=".pdf,.jpg,.jpeg,.png" style="font-size:12px"></div>' +
        '<button onclick="saveTemplate()" style="padding:10px 20px;background:#1b5e20;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer">Upload Template</button>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div id="fillFormModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;align-items:center;justify-content:center">' +
    '<div style="background:#fff;border-radius:8px;width:min(90vw,550px);max-height:85vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3)">' +
      '<div style="background:#1b5e20;color:#fff;padding:10px 16px;font-weight:700;font-size:13px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between">Fill Patient Claim Form<button onclick="document.getElementById(\'fillFormModal\').style.display=\'none\'" style="border:none;background:none;color:#fff;font-size:18px;cursor:pointer">&times;</button></div>' +
      '<div style="padding:20px">' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Select Patient</label><input id="fillFormPatientSearch" placeholder="Type MR No or patient name..." style="width:100%;height:30px;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:0 8px;margin-bottom:4px" oninput="filterFillPatients()"><select id="fillFormPatient" style="width:100%;height:120px;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:4px" multiple></select></div>' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Select Form Template</label><select id="fillFormTemplate" style="width:100%;height:30px;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:0 8px"></select></div>' +
        '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Claim Amount</label><input id="fillFormAmount" type="number" value="0" style="width:100%;height:30px;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:0 8px"></div>' +
        '<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="fillFormAddSign" checked><label style="font-size:12px;font-weight:700">Include Doctor Signature & Clinic Seal</label></div>' +
        '<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="fillFormPatSign" checked><label style="font-size:12px;font-weight:700">Include Patient Signature</label></div>' +
        '<button onclick="generateFilledForm()" style="padding:10px 20px;background:#1b5e20;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer">Generate & Fill Form</button>' +
        '<button onclick="downloadAsWord()" style="padding:10px 20px;background:#1565c0;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;margin-left:8px">Download as Word</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML("beforeend", html);

  // Functions
  window.openTemplateUpload = function() {
    document.getElementById("templateUploadModal").style.display = "flex";
  };

  window.saveTemplate = function() {
    var company = document.getElementById("templateCompany").value.trim();
    var formType = document.getElementById("templateType").value.trim();
    var fileInput = document.getElementById("templateFile");
    if (!company || !formType) { alert("Enter company name and form type"); return; }
    if (!fileInput.files || !fileInput.files[0]) { alert("Select a file"); return; }

    var formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("company", company);
    formData.append("formType", formType);

    fetch("/api/claim-forms/upload", { method: "POST", body: formData })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          alert("Template uploaded: " + company + " - " + formType);
          document.getElementById("templateUploadModal").style.display = "none";
          document.getElementById("templateCompany").value = "";
          document.getElementById("templateType").value = "";
          fileInput.value = "";
        } else {
          alert("Error: " + (d.error || "Upload failed"));
        }
      }).catch(function(e) { alert("Error: " + e.message); });
  };

  window.openFillForm = function() {
    document.getElementById("fillFormModal").style.display = "flex";
    document.getElementById("fillFormPatientSearch").value = "";

    // Fetch patients from API
    fetch("/api/patients").then(function(r) { return r.json(); }).then(function(d) {
      var patients = (d.success && d.data) ? d.data : (window.patients || []);
      var patSel = document.getElementById("fillFormPatient");
      var allOptions = patients.map(function(p) {
        var name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
        return { value: p.mrNo, label: p.mrNo + ' - ' + name };
      });
      window._fillFormAllPatients = allOptions;
      patSel.innerHTML = allOptions.slice(0, 50).map(function(o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join("");
    }).catch(function() {
      var patients = window.patients || [];
      var patSel = document.getElementById("fillFormPatient");
      var allOptions = patients.map(function(p) {
        var name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
        return { value: p.mrNo, label: p.mrNo + ' - ' + name };
      });
      window._fillFormAllPatients = allOptions;
      patSel.innerHTML = allOptions.slice(0, 50).map(function(o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join("");
    });

    // Populate templates
    fetch("/api/claim-forms").then(function(r) { return r.json(); }).then(function(d) {
      var tplSel = document.getElementById("fillFormTemplate");
      if (d.success && d.data && d.data.length > 0) {
        tplSel.innerHTML = d.data.map(function(f) {
          return '<option value="' + f.filename + '">' + (f.company || '') + ' - ' + (f.formType || f.description || f.filename) + '</option>';
        }).join("");
      } else {
        tplSel.innerHTML = '<option value="">No templates uploaded yet</option>';
      }
    });
  };

  window.filterFillPatients = function() {
    var query = document.getElementById("fillFormPatientSearch").value.toLowerCase().trim();
    var patSel = document.getElementById("fillFormPatient");
    var allOptions = window._fillFormAllPatients || [];
    var filtered = query ? allOptions.filter(function(o) {
      return o.label.toLowerCase().indexOf(query) !== -1;
    }) : allOptions.slice(0, 50);
    patSel.innerHTML = filtered.slice(0, 30).map(function(o) {
      return '<option value="' + o.value + '">' + o.label + '</option>';
    }).join("");
    // Auto-select first match
    if (filtered.length > 0) patSel.value = filtered[0].value;
  };

  window.generateFilledForm = function() {
    var mrNo = document.getElementById("fillFormPatient").value || (document.getElementById("fillFormPatient").selectedOptions[0] ? document.getElementById("fillFormPatient").selectedOptions[0].value : "");
    var template = document.getElementById("fillFormTemplate").value;
    var amount = document.getElementById("fillFormAmount").value;
    var addSign = document.getElementById("fillFormAddSign").checked;
    var addPatSign = document.getElementById("fillFormPatSign").checked;

    if (!mrNo) { alert("Select a patient"); return; }
    if (!template) { alert("Select a form template"); return; }

    document.getElementById("fillFormModal").style.display = "none";

    var ext = template.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      // Open PDF in editor mode - click anywhere to type on the PDF
      var editorUrl = "/pdf-editor?file=" + encodeURIComponent("/uploads/claim-forms/" + template) + "&mrNo=" + encodeURIComponent(mrNo) + "&amount=" + encodeURIComponent(amount);
      window.open(editorUrl, "_blank", "width=1000,height=800");
    } else {
      // Image-based form - use overlay approach
      openWithOverlay(template, mrNo, amount, addSign, addPatSign);
    }
  };

  function openWithOverlay(template, mrNo, amount, addSign, addPatSign) {
    // Get patient data
    var patients = window.patients || [];
    var pat = patients.find(function(p) { return p.mrNo === mrNo; });
    var patientName = pat ? [pat.firstName, pat.middleName, pat.lastName].filter(Boolean).join(" ") : "";
    var mobile = pat ? (pat.mobile || "") : "";
    var eid = pat ? (pat.eid || "") : "";
    var dob = pat ? (pat.dob || "") : "";
    var nationality = pat ? (pat.nationality || "") : "";
    var doctorSig = addSign ? (localStorage.getItem("doctorSignature") || "") : "";
    var clinicSeal = addSign ? (localStorage.getItem("clinicSeal") || "") : "";
    var patientSig = addPatSign ? (localStorage.getItem("patSign_" + mrNo) || "") : "";

    var win = window.open("", "_blank", "width=900,height=700");
    var fileUrl = "/uploads/claim-forms/" + template;
    var ext = template.split(".").pop().toLowerCase();

    var winHtml = '<!DOCTYPE html><html><head><title>Claim Form - ' + patientName + '</title><style>' +
      'body{margin:0;font-family:Arial,sans-serif}' +
      '.toolbar{position:fixed;top:0;left:0;right:0;height:40px;background:#1b5e20;display:flex;align-items:center;padding:0 12px;gap:8px;z-index:999}' +
      '.toolbar button{height:28px;padding:0 12px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;background:#fff;color:#1b5e20}' +
      '.toolbar span{color:#fff;font-size:12px;font-weight:700}' +
      '.content{margin-top:50px;padding:20px}' +
      '.form-area{position:relative;display:inline-block;border:1px solid #ccc}' +
      '.form-area img{max-width:100%;display:block}' +
      '.form-area iframe{width:800px;height:1000px;border:none}' +
      '.overlay-field{position:absolute;font-size:11px;font-weight:700;color:#000;padding:1px 3px;background:rgba(255,255,255,0.9);border-bottom:1px solid #333;cursor:move}' +
      '.overlay-field:focus{outline:1px solid #1b5e20;background:#fff}' +
      '.sig-overlay{position:absolute;bottom:80px;right:40px}' +
      '.sig-overlay img{height:50px;mix-blend-mode:multiply}' +
      '.pat-sig-overlay{position:absolute;bottom:80px;left:40px}' +
      '.pat-sig-overlay img{height:40px;mix-blend-mode:multiply}' +
      '@media print{.toolbar{display:none}.content{margin-top:0;padding:0}}' +
      '</style></head><body>' +
      '<div class="toolbar"><span>' + patientName + ' - Claim Form</span>' +
        '<button onclick="window.print()">Print / PDF</button>' +
        '<button onclick="addField()">+ Add Field</button>' +
      '</div>' +
      '<div class="content"><div class="form-area" id="formArea">';

    if (ext === "pdf") {
      winHtml += '<iframe src="' + fileUrl + '"></iframe>';
    } else {
      winHtml += '<img src="' + fileUrl + '">';
    }

    // Add patient info overlay fields
    winHtml += '<div class="overlay-field" style="top:10px;left:10px" contenteditable="true">Patient: ' + patientName + '</div>';
    winHtml += '<div class="overlay-field" style="top:30px;left:10px" contenteditable="true">MR No: ' + mrNo + ' | Mobile: ' + mobile + '</div>';
    winHtml += '<div class="overlay-field" style="top:50px;left:10px" contenteditable="true">EID: ' + eid + ' | DOB: ' + dob + ' | Nationality: ' + nationality + '</div>';
    winHtml += '<div class="overlay-field" style="top:70px;left:10px" contenteditable="true">Amount: ' + amount + ' AED</div>';

    // Doctor signature + seal
    if (doctorSig || clinicSeal) {
      winHtml += '<div class="sig-overlay">';
      if (clinicSeal) winHtml += '<img src="' + clinicSeal + '" title="Clinic Seal">';
      if (doctorSig) winHtml += '<img src="' + doctorSig + '" title="Doctor Signature">';
      winHtml += '</div>';
    }

    // Patient signature
    if (patientSig) {
      winHtml += '<div class="pat-sig-overlay"><img src="' + patientSig + '" title="Patient Signature"></div>';
    }

    winHtml += '</div></div>' +
      '<script>' +
      'function addField(){var d=document.createElement("div");d.className="overlay-field";d.contentEditable="true";d.style.top="100px";d.style.left="100px";d.textContent="Type here";d.onmousedown=startDrag;document.getElementById("formArea").appendChild(d);d.focus()}' +
      'document.querySelectorAll(".overlay-field").forEach(function(f){f.onmousedown=startDrag});' +
      'var dragEl=null,ox=0,oy=0;' +
      'function startDrag(e){if(e.detail>1)return;dragEl=e.target;ox=e.clientX-dragEl.offsetLeft;oy=e.clientY-dragEl.offsetTop;document.onmousemove=function(e){dragEl.style.left=(e.clientX-ox)+"px";dragEl.style.top=(e.clientY-oy)+"px"};document.onmouseup=function(){dragEl=null;document.onmousemove=null;document.onmouseup=null}}' +
      '<\/script></body></html>';

    win.document.write(winHtml);
    win.document.close();
  };

  window.downloadAsWord = function() {
    var mrNo = document.getElementById("fillFormPatient").value || (document.getElementById("fillFormPatient").selectedOptions[0] ? document.getElementById("fillFormPatient").selectedOptions[0].value : "");
    var template = document.getElementById("fillFormTemplate").value;
    var amount = document.getElementById("fillFormAmount").value;

    if (!mrNo) { alert("Select a patient"); return; }

    // Get the form type/company name from the template dropdown text
    var tplSel = document.getElementById("fillFormTemplate");
    var formType = tplSel.options[tplSel.selectedIndex] ? tplSel.options[tplSel.selectedIndex].textContent : "Claim Form";

    document.getElementById("fillFormModal").style.display = "none";

    // Request Word document from server
    var url = "/api/claim-forms/generate-word";
    fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ mrNo: mrNo, formType: formType, amount: amount })
    }).then(function(r) {
      if (r.ok) return r.blob();
      throw new Error("Server error");
    }).then(function(blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ClaimForm_" + mrNo + ".docx";
      a.click();
      alert("Word document downloaded! Open in Microsoft Word to edit, add signature, and print.");
    }).catch(function(e) {
      alert("Error generating Word document: " + e.message);
    });
  };
})();
