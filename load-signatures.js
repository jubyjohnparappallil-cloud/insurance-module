// Auto-load clinic seal and doctor signature from local files
(function() {
  function loadImageAsBase64(url, callback) {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
      var canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      callback(canvas.toDataURL("image/png"));
    };
    img.onerror = function() { callback(null); };
    img.src = url;
  }

  setTimeout(function() {
    // Load clinic seal (transparent PNG)
    loadImageAsBase64("clinic-seal.png", function(data) {
      if (data) {
        localStorage.setItem("clinicSeal", data);
        fetch("/api/signatures", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ type: "seal", data: data })
        }).catch(function(){});
        var img = document.getElementById("savedSeal");
        if (img) img.src = data;
      }
    });

    // Load doctor signature
    loadImageAsBase64("doctor-sign.jpg", function(data) {
      if (data) {
        localStorage.setItem("doctorSignature", data);
        fetch("/api/signatures", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ type: "doctor", data: data })
        }).catch(function(){});
        var img = document.getElementById("savedDoctorSig");
        if (img) img.src = data;
      }
    });
  }, 3000);

  // CSS to ensure transparent seal shows cleanly on all pages
  var style = document.createElement("style");
  style.textContent = ".seal-box img, .seal-img, img[onerror] { mix-blend-mode: multiply; }";
  document.head.appendChild(style);
})();
