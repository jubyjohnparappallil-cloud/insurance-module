const fs = require('fs');
let html = fs.readFileSync('user-management.html', 'utf8');

// The dark bar at very top showing the section name
// When Insurance menu is active, it shows "Insurance" in the title bar
// Change all visible "Insurance" text in menus/headers to "User Management"
// But keep internal data references (insurance companies list, etc.) as-is

// Fix the windowTitle display
html = html.replace(
  /byId\("windowTitle"\)\.textContent = activeMenu === "Home" \? "User Management" : activeMenu/g,
  'byId("windowTitle").textContent = activeMenu === "Home" ? "User Management" : (activeMenu === "User Management" ? "User Management" : activeMenu)'
);

fs.writeFileSync('user-management.html', html, 'utf8');
console.log('Done - heading shows User Management');
