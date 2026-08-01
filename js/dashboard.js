/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */

let chartInstances = {};

function destroyChart(name) {
  if (chartInstances[name]) { chartInstances[name].destroy(); delete chartInstances[name]; }
}

function renderDashboard() {
  renderDashStats();
  renderDashCharts();
  renderDashEntities();
  document.getElementById('month-label-dash').textContent = MONTHS[selectedMonth-1]+' '+selectedYear;
}

// Building stats use ownCharge so monthly totals never double-count arrears.
function getDashStatsForMonth(m, y) {
  let totalBilled=0, collected=0, outstanding=0, totalUnits=0, paidCount=0, unpaidCount=0;
  DB.entities.forEach(ent => {
    const b = getBillForMonth(ent.id, m, y);
    if (!b) return;
    totalBilled += b.ownCharge;
    totalUnits  += b.ownUnits;
    if (b.paid) { collected += b.ownCharge; paidCount++; }
    else { outstanding += b.ownCharge; unpaidCount++; }
  });
  return { totalBilled, collected, outstanding, totalUnits, paidCount, unpaidCount };
}

function renderDashStats() {
  const s = getDashStatsForMonth(selectedMonth, selectedYear);
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-accent sa-blue"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div>
      <div class="stat-lbl">Total entities</div>
      <div class="stat-val">${DB.entities.length}</div>
      <div class="stat-sub">${DB.entities.filter(e=>e.type==='flat').length} flats · ${DB.entities.filter(e=>e.type==='shop').length} shops</div>
    </div>
    <div class="stat-card">
      <div class="stat-accent sa-purple"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg></div>
      <div class="stat-lbl">Billed ${MONTHS[selectedMonth-1]}</div>
      <div class="stat-val">${rs(s.totalBilled)}</div>
      <div class="stat-sub">${s.paidCount+s.unpaidCount} entries</div>
    </div>
    <div class="stat-card">
      <div class="stat-accent sa-green"><svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg></div>
      <div class="stat-lbl">Collected</div>
      <div class="stat-val c-green">${rs(s.collected)}</div>
      <div class="stat-sub">${s.paidCount} paid</div>
    </div>
    <div class="stat-card">
      <div class="stat-accent sa-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <div class="stat-lbl">Outstanding</div>
      <div class="stat-val c-red">${rs(s.outstanding)}</div>
      <div class="stat-sub">${s.unpaidCount} unpaid</div>
    </div>
    <div class="stat-card">
      <div class="stat-accent sa-amber"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
      <div class="stat-lbl">Total units</div>
      <div class="stat-val">${s.totalUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <div class="stat-sub">${s.totalUnits ? 'Avg Rs '+(s.totalBilled/s.totalUnits).toFixed(2)+'/unit' : 'No bills yet'}</div>
    </div>
  `;
}

function renderDashCharts() {
  const periods = getPeriods();
  const monthLabels = periods.map(k => MONTHS[k.m-1] + (periods.some(p=>p.m===k.m&&p.y!==k.y)?(" '"+String(k.y).slice(2)):''));
  const collected = [], outstanding = [], unitsArr = [];
  periods.forEach(k => {
    const s = getDashStatsForMonth(k.m, k.y);
    collected.push(s.collected); outstanding.push(s.outstanding); unitsArr.push(s.totalUnits);
  });

  ['billing','donut','units','trend'].forEach(destroyChart);
  const opts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} };
  const pal = chartPalette();

  chartInstances.billing = new Chart(document.getElementById('billingChart').getContext('2d'), {
    type:'bar',
    data:{ labels:monthLabels, datasets:[
      {label:'Collected',data:collected,backgroundColor:pal.collected,borderRadius:4},
      {label:'Outstanding',data:outstanding,backgroundColor:pal.outstanding,borderRadius:4}
    ]},
    options:{...opts,scales:{
      x:{stacked:true,grid:{display:false},ticks:{font:{size:11},color:pal.tick}},
      y:{stacked:true,grid:{color:pal.grid},ticks:{font:{size:10},color:pal.tick,callback:v=>'Rs '+Math.round(v/1000)+'k'}}
    },plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+rs(c.raw)}}}}
  });

  const s = getDashStatsForMonth(selectedMonth, selectedYear);
  chartInstances.donut = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type:'doughnut',
    data:{labels:['Paid','Unpaid'],datasets:[{data:[s.paidCount,s.unpaidCount],backgroundColor:[pal.paid,pal.unpaid],borderWidth:0,hoverOffset:4}]},
    options:{...opts,cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.label+': '+c.raw}}}}
  });
  document.getElementById('donut-sub').textContent = `${s.paidCount} paid, ${s.unpaidCount} unpaid`;
  document.getElementById('donut-legend').innerHTML = `
    <div class="leg-item"><div class="leg-dot" style="background:${pal.paid}"></div>${s.paidCount} Paid</div>
    <div class="leg-item"><div class="leg-dot" style="background:${pal.unpaid}"></div>${s.unpaidCount} Unpaid</div>
  `;

  // Entity names are dropped from the x-axis entirely (too many/too long
  // to ever "fit") — the tooltip still shows the full name on a single
  // click/hover like before; a double-click jumps to that entity's detail.
  const entUnits = DB.entities.map(e=>{ const b=getBillForMonth(e.id,selectedMonth,selectedYear); return b?b.ownUnits:0; });
  const entColors = DB.entities.map(e=>e.type==='shop'?pal.shop:pal.flat);
  chartInstances.units = new Chart(document.getElementById('unitsChart').getContext('2d'), {
    type:'bar',
    data:{labels:DB.entities.map(e=>e.name),datasets:[{label:'Units',data:entUnits,backgroundColor:entColors,borderRadius:3}]},
    options:{...opts,scales:{
      x:{grid:{display:false},ticks:{display:false}},
      y:{grid:{color:pal.grid},ticks:{font:{size:10},color:pal.tick}}
    },
    onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.raw+' units'}}}}
  });
  // .ondblclick (not addEventListener) so re-rendering the chart on month
  // change replaces this instead of stacking duplicate listeners.
  document.getElementById('unitsChart').ondblclick = (evt) => {
    const els = chartInstances.units.getElementsAtEventForMode(evt, 'nearest', {intersect:true}, true);
    if (!els.length) return;
    const ent = DB.entities[els[0].index];
    if (ent) openEntityDetail(ent.id);
  };

  chartInstances.trend = new Chart(document.getElementById('trendChart').getContext('2d'), {
    type:'line',
    data:{labels:monthLabels,datasets:[{label:'Units',data:unitsArr,borderColor:pal.trendLine,backgroundColor:pal.trendFill,fill:true,tension:.35,pointRadius:4,pointBackgroundColor:pal.trendLine,borderWidth:2}]},
    options:{...opts,scales:{
      x:{grid:{display:false},ticks:{font:{size:11},color:pal.tick}},
      y:{grid:{color:pal.grid},ticks:{font:{size:10},color:pal.tick}}
    },plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.raw+' units'}}}}
  });
}

function renderDashEntities() {
  const typeFilter = document.getElementById('dash-filter-type').value;
  const statusFilter = document.getElementById('dash-filter-status').value;
  const grid = document.getElementById('dash-entity-grid');

  const ents = DB.entities.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    const b = getBillForMonth(e.id, selectedMonth, selectedYear);
    if (statusFilter==='paid' && (!b || !b.paid)) return false;
    if (statusFilter==='unpaid' && (!b || b.paid)) return false;
    return true;
  });

  if (!ents.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg><p>No entities match filter</p></div>`;
    return;
  }

  grid.innerHTML = ents.map(e => {
    const b = getBillForMonth(e.id, selectedMonth, selectedYear);
    const paid = b?.paid ?? false;
    const arrears = b?.arrears ?? 0;
    const own = b?.ownCharge ?? 0;
    const units = b?.ownUnits ?? 0;
    return `
      <div class="ecard ${paid?'paid':'unpaid'}" onclick="openEntityDetail(${e.id})">
        <div class="ecard-top">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="eavatar ${e.type}">${e.id}</div>
            <div>
              <div class="ename">${esc(e.name)}</div>
              <div class="emeta">${esc(e.ownerName || e.type)}</div>
            </div>
          </div>
          <span class="badge ${b ? (paid?'badge-green':'badge-red') : 'badge-gray'}">${b ? (paid?'Paid':'Unpaid') : 'No bill'}</span>
        </div>
        <div class="ecard-body">
          <div class="erow">
            <span class="erow-lbl">Units used</span>
            <span class="erow-val">${units} u</span>
          </div>
          <div class="erow">
            <span class="erow-lbl">Charge (${MONTHS[selectedMonth-1]})</span>
            <span class="erow-val ${paid?'green':'red'}">${rs(own)}</span>
          </div>
          ${arrears ? `<div class="erow"><span class="erow-lbl" style="color:var(--amber)">+ arrears</span><span class="erow-val" style="color:var(--amber)">${rs(arrears)}</span></div>
          <div class="erow"><span class="erow-lbl">Total due</span><span class="erow-val red">${rs(b.totalDue)}</span></div>` : ''}
        </div>
        <div class="ecard-foot">
          ${!paid && b ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();confirmMarkPaid(${e.id},${b.month},${b.year})">
            <svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Mark paid
          </button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();printBill(${e.id})">
            <svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print bill
          </button>
        </div>
      </div>
    `;
  }).join('');
}

