const fs = require('fs');
let html = fs.readFileSync('user-management.html', 'utf8');

// Change the top bar heading from "Insurance" to "User Management"
html = html.replace(
  'data-menu="Insurance">Insurance</button>',
  'data-menu="Insurance">User Management</button>'
);

// Change the window title bar text
html = html.replace(
  'activeMenu === "Home" ? "User Management" : activeMenu',
  'activeMenu === "Home" ? "User Management" : activeMenu'
);

// The top dark bar title
html = html.replace(
  '>MasterPage<',
  '>User Management<'
);

// Change "Insurance" heading when that menu is active to "User Management"  
html = html.replace(
  '"Insurance"',
  '"User Management"'
);

fs.writeFileSync('user-management.html', html, 'utf8');
console.log('Fixed headings in user-management.html');
