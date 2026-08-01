/* ═══════════════════════════════════════════════════════════
   REPORTS PAGE
═══════════════════════════════════════════════════════════ */

let reportCharts = {};

function renderReports() {
  const yearSel = document.getElementById('report-year');
  if (yearSel) {
    const years = getYears();
    const cur = yearSel.value || years[0];
    yearSel.innerHTML = years.map(y=>`<option value="${y}"${String(y)===String(cur)?' selected':''}>${y}</option>`).join('');
  }
  const year = parseInt(yearSel?.value || getYears()[0]);
  const monthKeys = getPeriods().filter(p=>p.y===year).map(p=>p.m);

  let annualBilled=0, annualCollected=0, annualUnits=0;
  monthKeys.forEach(m => { const s=getDashStatsForMonth(m,year); annualBilled+=s.totalBilled; annualCollected+=s.collected; annualUnits+=s.totalUnits; });

  document.getElementById('report-stats').innerHTML = `
    <div class="stat-card"><div class="stat-lbl">Annual billed (${year})</div><div class="stat-val">${rs(annualBilled)}</div><div class="stat-sub">${monthKeys.length} months recorded</div></div>
    <div class="stat-card"><div class="stat-lbl">Annual collected</div><div class="stat-val c-green">${rs(annualCollected)}</div><div class="stat-sub">${annualBilled?Math.round(annualCollected/annualBilled*100):0}% collection rate</div></div>
    <div class="stat-card"><div class="stat-lbl">Annual outstanding</div><div class="stat-val c-red">${rs(annualBilled-annualCollected)}</div><div class="stat-sub">To be collected</div></div>
    <div class="stat-card"><div class="stat-lbl">Total units consumed</div><div class="stat-val">${annualUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div class="stat-sub">Building-wide</div></div>
    <div class="stat-card"><div class="stat-lbl">Avg per entity/month</div><div class="stat-val">${DB.entities.length && monthKeys.length ? Math.round(annualUnits/DB.entities.length/monthKeys.length) : 0}</div><div class="stat-sub">units</div></div>
  `;

  ['annualChart','payRateChart','unitsTrendChart','typeSplitChart'].forEach(id=>{ if(reportCharts[id]){reportCharts[id].destroy();delete reportCharts[id];} });
  const chartOpts = {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}};
  const annualCol = monthKeys.map(m=>getDashStatsForMonth(m,year).collected);
  const annualOut = monthKeys.map(m=>getDashStatsForMonth(m,year).outstanding);
  const pal = chartPalette();

  reportCharts.annualChart = new Chart(document.getElementById('annualChart').getContext('2d'),{
    type:'bar',
    data:{labels:monthKeys.map(m=>MONTHS[m-1]),datasets:[
      {label:'Collected',data:annualCol,backgroundColor:pal.collected,borderRadius:4},
      {label:'Outstanding',data:annualOut,backgroundColor:pal.outstanding,borderRadius:4}
    ]},
    options:{...chartOpts,scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10},color:pal.tick}},y:{stacked:true,grid:{color:pal.grid},ticks:{font:{size:9},color:pal.tick,callback:v=>'Rs '+Math.round(v/1000)+'k'}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+rs(c.raw)}}}}
  });

  const payRates = monthKeys.map(m=>{const s=getDashStatsForMonth(m,year);return s.paidCount+s.unpaidCount?Math.round(s.paidCount/(s.paidCount+s.unpaidCount)*100):0;});
  reportCharts.payRateChart = new Chart(document.getElementById('payRateChart').getContext('2d'),{
    type:'line',
    data:{labels:monthKeys.map(m=>MONTHS[m-1]),datasets:[{label:'Payment rate %',data:payRates,borderColor:pal.payRateLine,backgroundColor:pal.payRateFill,fill:true,tension:.3,pointRadius:4,pointBackgroundColor:pal.payRateLine,borderWidth:2}]},
    options:{...chartOpts,scales:{x:{grid:{display:false},ticks:{font:{size:10},color:pal.tick}},y:{grid:{color:pal.grid},ticks:{font:{size:9},color:pal.tick,callback:v=>v+'%'},max:100}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.raw+'%'}}}}
  });

  const annualUnitsArr = monthKeys.map(m=>getDashStatsForMonth(m,year).totalUnits);
  reportCharts.unitsTrendChart = new Chart(document.getElementById('unitsTrendChart').getContext('2d'),{
    type:'bar',
    data:{labels:monthKeys.map(m=>MONTHS[m-1]),datasets:[{label:'Units',data:annualUnitsArr,backgroundColor:pal.flat,borderRadius:4}]},
    options:{...chartOpts,scales:{x:{grid:{display:false},ticks:{font:{size:10},color:pal.tick}},y:{grid:{color:pal.grid},ticks:{font:{size:9},color:pal.tick}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.raw+' units'}}}}
  });

  let flatBilled=0, shopBilled=0;
  DB.entities.forEach(ent => {
    const billed = computeBillAmounts(ent.id).filter(b=>b.year===year).reduce((s,b)=>s+b.ownCharge,0);
    if (ent.type==='shop') shopBilled += billed; else flatBilled += billed;
  });
  reportCharts.typeSplitChart = new Chart(document.getElementById('typeSplitChart').getContext('2d'),{
    type:'doughnut',
    data:{labels:['Flat','Shop'],datasets:[{data:[flatBilled,shopBilled],backgroundColor:[pal.flat,pal.shop],borderWidth:0,hoverOffset:4}]},
    options:{...chartOpts,cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.label+': '+rs(c.raw)}}}}
  });
  document.getElementById('type-split-legend').innerHTML = `
    <div class="leg-item"><div class="leg-dot" style="background:${pal.flat}"></div>Flat — ${rs(flatBilled)}</div>
    <div class="leg-item"><div class="leg-dot" style="background:${pal.shop}"></div>Shop — ${rs(shopBilled)}</div>
  `;

  document.getElementById('report-entity-body').innerHTML = DB.entities.map(ent => {
    const computed = computeBillAmounts(ent.id).filter(b=>b.year===year);
    const billed = computed.reduce((s,b)=>s+b.ownCharge,0);
    const collected = computed.filter(b=>b.paid).reduce((s,b)=>s+b.ownCharge,0);
    const outstanding = billed - collected;
    const units = computed.reduce((s,b)=>s+b.ownUnits,0);
    const rate = billed ? Math.round(collected/billed*100) : 0;
    return `
      <tr class="row-clickable" onclick="openEntityDetail(${ent.id})">
        <td><div style="display:flex;align-items:center;gap:8px"><div class="eavatar ${ent.type}" style="width:28px;height:28px;font-size:10px">${ent.id}</div><div><div style="font-weight:600">${esc(ent.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(ent.ownerName||'')}</div></div></div></td>
        <td><span class="badge badge-gray">${ent.type}</span></td>
        <td class="tbl-num">${rs(billed)}</td>
        <td class="tbl-num" style="color:var(--green-dk)">${rs(collected)}</td>
        <td class="tbl-num" style="color:${outstanding?'var(--red-dk)':'var(--text3)'}">${rs(outstanding)}</td>
        <td class="tbl-num">${units.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;background:var(--surface2);border-radius:99px;height:6px"><div style="width:${rate}%;background:${rate>80?'var(--green)':rate>50?'var(--amber)':'var(--red)'};height:6px;border-radius:99px"></div></div><span style="font-size:11px;font-weight:600;color:var(--text2);width:30px;text-align:right">${rate}%</span></div></td>
        <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-xs" onclick="printBill(${ent.id})"><svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Bill</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">No entities</td></tr>';
}

