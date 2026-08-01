/* ═══════════════════════════════════════════════════════════
   BILLS PAGE
═══════════════════════════════════════════════════════════ */

function renderBillsPage() {
  const monthSel = document.getElementById('bills-filter-month');
  if (monthSel) {
    const cur = monthSel.value;
    const periods = getPeriods().slice().reverse();
    monthSel.innerHTML = '<option value="">All months</option>' +
      periods.map(p => `<option value="${p.m}-${p.y}"${cur===p.m+'-'+p.y?' selected':''}>${MONTHS_FULL[p.m-1]} ${p.y}</option>`).join('');
  }

  const search = document.getElementById('bills-search')?.value.toLowerCase() || '';
  const monthF = document.getElementById('bills-filter-month')?.value || '';
  const statusF = document.getElementById('bills-filter-status')?.value || '';

  let rows = [];
  DB.entities.forEach(ent => {
    computeBillAmounts(ent.id).forEach(b => {
      if (monthF) { const [fm,fy] = monthF.split('-').map(Number); if (b.month!==fm || b.year!==fy) return; }
      if (statusF==='paid' && !b.paid) return;
      if (statusF==='unpaid' && b.paid) return;
      if (search && ![ent.name,ent.ownerName].some(v=>String(v||'').toLowerCase().includes(search))) return;
      rows.push({...b, ent});
    });
  });
  rows.sort((a,b) => a.year!==b.year?b.year-a.year:b.month-a.month);

  const tbody = document.getElementById('bills-tbl-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">No bills found</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(b => `
    <tr class="row-clickable" onclick="openEntityDetail(${b.entityId})">
      <td><div style="font-weight:600">${esc(b.ent.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(b.ent.ownerName||'')}</div></td>
      <td>${MONTHS[b.month-1]} ${b.year}</td>
      <td class="tbl-num tbl-mono">${num(b.prevReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
      <td class="tbl-num tbl-mono">${num(b.currReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
      <td class="tbl-num">${num(b.ownUnits).toFixed(2)}${b.arrearsMonths.length?` <span class="chain-label">+${b.arrearsMonths.length} arrears</span>`:''}</td>
      <td class="tbl-num">Rs ${b.rate}</td>
      <td class="tbl-num"><strong>${rs(b.ownCharge)}</strong>${!b.paid&&b.arrears?`<div class="bill-breakdown">due ${rs(b.totalDue)}</div>`:''}</td>
      <td><span class="badge ${b.paid?'badge-green':'badge-red'}">${b.paid?'Paid':'Unpaid'}</span>${b.paid && b.paymentMode ? `<div class="bill-breakdown">${esc(paymentModeLabel(b.paymentMode))}${b.paidAt?' · '+formatPaidDate(b.paidAt):''}</div>` : ''}</td>
      <td>
        <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
          ${!b.paid ? `<button class="btn btn-primary btn-xs" onclick="confirmMarkPaid(${b.entityId},${b.month},${b.year})"><svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Pay</button>` : ''}
          <button class="btn btn-ghost btn-xs" title="Print bill" aria-label="Print bill" onclick="printBill(${b.entityId},${b.month},${b.year})"><svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
          <button class="btn btn-ghost btn-xs" title="Edit reading" aria-label="Edit reading" onclick="requestUnlockEdit('bill', ${b.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-xs" title="Delete reading" aria-label="Delete reading" onclick="confirmDeleteBill(${b.id})"><svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
}

