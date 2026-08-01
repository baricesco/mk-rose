/* ═══════════════════════════════════════════════════════════
   MODAL HELPERS + TOAST
═══════════════════════════════════════════════════════════ */

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Shows/hides the red clear (×) button on a .search-wrap based on whether
// its input currently has a value.
function updateSearchClear(input) {
  input.closest('.search-wrap')?.classList.toggle('has-value', !!input.value);
}

function clearSearchInput(inputId, rerender) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = '';
  updateSearchClear(input);
  rerender();
  input.focus();
}

document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target===ov) closeModal(ov.id); });
});

function toast(msg, type='') {
  if (type === 'error') console.log('[BillFlow error]', msg);
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon = type==='success' ? '<svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>' : type==='error' ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' : '';
  t.innerHTML = icon + msg;
  tc.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

