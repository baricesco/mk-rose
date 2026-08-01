/* ═══════════════════════════════════════════════════════════
   MONTH SELECTOR
═══════════════════════════════════════════════════════════ */

let selectedMonth = new Date().getMonth() + 1;
let selectedYear  = new Date().getFullYear();

function initMonthSelector() {
  const sel = document.getElementById('globalMonth');
  const periods = getPeriods();
  if (periods.length) {
    const latest = periods[periods.length - 1];
    selectedMonth = latest.m; selectedYear = latest.y;
  }
  sel.innerHTML = '';
  (periods.length ? periods : [{ m:selectedMonth, y:selectedYear }])
    .slice().reverse().forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.m + '-' + o.y;
      opt.textContent = MONTHS[o.m-1] + ' ' + o.y;
      if (o.m === selectedMonth && o.y === selectedYear) opt.selected = true;
      sel.appendChild(opt);
    });
}


function onMonthChange() {
  const [m,y] = document.getElementById('globalMonth').value.split('-').map(Number);
  selectedMonth = m; selectedYear = y;
  const { page, sub } = parseRoute();
  if (page==='dashboard') renderDashboard();
  else if (page==='entities' && !sub) renderEntitiesPage();
}
