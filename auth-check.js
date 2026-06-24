// Add this script to the top of protected pages
// It checks localStorage for login token and redirects to /login if not found
(function() {
  var token = localStorage.getItem('emr_token');
  var user = localStorage.getItem('emr_user');
  if (!token || !user) {
    window.location.href = '/login';
    return;
  }
  // Show logged in user name
  try {
    var u = JSON.parse(user);
    var el = document.getElementById('loggedUserName');
    if (el) el.textContent = u.name || u.username;
  } catch(e) {}
})();
