// Receipt Voucher enhancements - date picker, add/delete row buttons
(function() {
  document.addEventListener("DOMContentLoaded", function() {
    setTimeout(fixReceiptVoucher, 1500);
  });

  function fixReceiptVoucher() {
    // Watch for rvModal opening to enhance it
    var observer = new MutationObserver(function() {
      var modal = document.getElementById('rvModal');
      if (modal && modal.classList.contains('open')) {
        enhanceRvForm();
      }
    });
    var body = document.body;
    if (body) observer.observe(body, { attributes: true, subtree: true, attributeFilter: ['class'] });

    // Also enhance on button clicks
    var rvNew = document.getElementById('rvNew');
    var rvEdit = document.getElementById('rvEdit');
    var addReceipt = document.getElementById('addReceipt');
    if (rvNew) rvNew.addEventListener('click', function() { setTimeout(enhanceRvForm, 100); });
    if (rvEdit) rvEdit.addEventListener('click', function() { setTimeout(enhanceRvForm, 100); });
    if (addReceipt) addReceipt.addEventListener('click', function() { setTimeout(enhanceRvForm, 100); });
  }

  var enhanced = false;

  function enhanceRvForm() {
    var form = document.getElementById('rvForm');
    if (!form) return;

    // Convert date fields to type="date"
    var rvDate = form.elements.rvDate;
    if (rvDate && rvDate.type !== 'date') {
      rvDate.type = 'date';
      rvDate.style.width = '140px';
      var today = new Date().toISOString().split('T')[0];
      if (!rvDate.value || rvDate.value.includes('-05-') || rvDate.value.includes('-02-')) {
        rvDate.value = today;
      }
    }

    var chequeDate = form.elements.chequeDate;
    if (chequeDate && chequeDate.type !== 'date') {
      chequeDate.type = 'date';
      chequeDate.style.width = '140px';
    }

    // Add row action buttons to table if not already added
    var tbody = document.getElementById('rvTableBody');
    if (!tbody) return;

    // Add action column header if missing
    var thead = tbody.closest('table').querySelector('thead tr');
    if (thead && !thead.querySelector('.rv-act-th')) {
      var th = document.createElement('th');
      th.className = 'rv-act-th';
      th.style.cssText = 'width:50px;padding:4px;text-align:center';
      th.textContent = '';
      thead.appendChild(th);
    }

    // Add action buttons to each row
    addActionButtonsToRows(tbody);

    // Listen for new rows
    if (!enhanced) {
      enhanced = true;
      tbody.addEventListener('input', function(e) {
        var tr = e.target.closest('tr');
        if (tr === tbody.lastElementChild) {
          addNewRow(tbody);
        }
      });
    }
  }

  function addActionButtonsToRows(tbody) {
    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function(row) {
      if (row.querySelector('.rv-row-actions')) return;
      var td = document.createElement('td');
      td.className = 'rv-row-actions';
      td.style.cssText = 'border:1px solid #ddd;padding:2px;text-align:center;white-space:nowrap';
      td.innerHTML = '<button type="button" class="rv-add-btn" title="Add row" style="width:18px;height:18px;border:none;background:#2e7d32;color:#fff;cursor:pointer;font-size:11px;border-radius:2px;margin:0 1px">+</button><button type="button" class="rv-del-btn" title="Delete row" style="width:18px;height:18px;border:none;background:#c00;color:#fff;cursor:pointer;font-size:11px;border-radius:2px;margin:0 1px">&times;</button>';
      row.appendChild(td);
    });

    // Event delegation for add/delete
    tbody.onclick = function(e) {
      var btn = e.target;
      if (btn.classList.contains('rv-add-btn')) {
        var tr = btn.closest('tr');
        addNewRowAfter(tbody, tr);
      } else if (btn.classList.contains('rv-del-btn')) {
        var tr = btn.closest('tr');
        if (tbody.rows.length > 1) {
          tr.remove();
          renumberRows(tbody);
        } else {
          // Clear last row
          var cells = tr.querySelectorAll('td[contenteditable]');
          cells.forEach(function(c) { c.textContent = ''; });
        }
      }
    };
  }

  function addNewRow(tbody) {
    var rowCount = tbody.rows.length + 1;
    var row = document.createElement('tr');
    row.innerHTML = '<td contenteditable="true" style="border:1px solid #ddd;padding:3px">' + rowCount + '</td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td>';
    tbody.appendChild(row);
    addActionButtonsToRows(tbody);
  }

  function addNewRowAfter(tbody, afterRow) {
    var row = document.createElement('tr');
    row.innerHTML = '<td contenteditable="true" style="border:1px solid #ddd;padding:3px">0</td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td><td contenteditable="true" style="border:1px solid #ddd;padding:3px"></td>';
    afterRow.after(row);
    addActionButtonsToRows(tbody);
    renumberRows(tbody);
    row.cells[1].focus();
  }

  function renumberRows(tbody) {
    Array.from(tbody.rows).forEach(function(row, i) {
      row.cells[0].textContent = i + 1;
    });
  }
})();
