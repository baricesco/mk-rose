/* ═══════════════════════════════════════════════════════════
   PAYMENTS PAGE  — every paid bill, split into cash vs account
═══════════════════════════════════════════════════════════ */

// 'm-y' for one month, '' for all months. Starts as null so the first
// visit opens on whatever month the global selector is showing.
let paymentsPeriod = null;

function openPaymentsForMonth(m, y) {
  paymentsPeriod = m + '-' + y;
  navigate('payments');
}

// Account = any recorded mode that isn't cash (Easypaisa, bank, JazzCash,
// other). Bills paid before payment mode was recorded have no mode at all.
const PAYMENT_GROUPS = [
  { key:'cash',    title:'Cash',                color:'var(--green)',   sub:'Paid in cash' },
  { key:'account', title:'Account',             color:'var(--purple)',  sub:'Easypaisa, bank, JazzCash' },
  { key:'',        title:'Method not recorded', color:'var(--border2)', sub:'Paid before the payment method was recorded' },
];
const paymentGroupOf = mode => !mode ? '' : mode === 'cash' ? 'cash' : 'account';

function renderPaymentsPage() {
  if (paymentsPeriod === null) paymentsPeriod = selectedMonth + '-' + selectedYear;
  const monthSel = document.getElementById('pay-filter-month');
  monthSel.innerHTML = '<option value="">All months</option>' +
    getPeriods().slice().reverse().map(p => `<option value="${p.m}-${p.y}"${paymentsPeriod===p.m+'-'+p.y?' selected':''}>${MONTHS_FULL[p.m-1]} ${p.y}</option>`).join('');
  paymentsPeriod = monthSel.value;   // a period that no longer exists falls back to All months

  const search = document.getElementById('pay-search').value.toLowerCase();
  const allMonths = !paymentsPeriod;
  const [fm, fy] = allMonths ? [] : paymentsPeriod.split('-').map(Number);
  const scope = allMonths ? 'all months' : MONTHS_FULL[fm-1] + ' ' + fy;

  const rowsByGroup = { cash: [], account: [], '': [] };
  let unpaid = 0;
  DB.entities.forEach(ent => {
    if (search && ![ent.name, ent.ownerName].some(v => String(v||'').toLowerCase().includes(search))) return;
    computeBillAmounts(ent.id).forEach(b => {
      if (!allMonths && (b.month !== fm || b.year !== fy)) return;
      if (!b.paid) { unpaid++; return; }
      rowsByGroup[paymentGroupOf(b.paymentMode)].push({ ...b, ent });
    });
  });
  // Newest month first; the sort is stable, so within a month rows keep
  // the same entity order as every other page.
  Object.values(rowsByGroup).forEach(rows => rows.sort((a,b) => a.year!==b.year ? b.year-a.year : b.month-a.month));

  // ownCharge, same as the dashboard's Collected stat, so the groups for a
  // month always add up to it.
  const sum = rows => round2(rows.reduce((s,r) => s + r.ownCharge, 0));
  const plural = n => n + ' bill' + (n === 1 ? '' : 's');
  const paidRows = Object.values(rowsByGroup).flat();
  const collected = sum(paidRows);
  const share = rows => collected ? Math.round(sum(rows) / collected * 100) + '%' : '0%';
  const order = Object.keys(PAYMENT_MODE_LABELS);
  const accountMethods = [...new Set(rowsByGroup.account.map(r => r.paymentMode))]
    .sort((a,b) => order.indexOf(a) - order.indexOf(b)).map(paymentModeLabel);

  document.getElementById('pay-stats').innerHTML = `
    <div class="stat-card">
      <div class="pm-lbl"><span class="leg-dot" style="background:var(--green)"></span>Cash</div>
      <div class="stat-val">${rs(sum(rowsByGroup.cash))}</div>
      <div class="stat-sub">${plural(rowsByGroup.cash.length)} · ${share(rowsByGroup.cash)}</div>
    </div>
    <div class="stat-card">
      <div class="pm-lbl"><span class="leg-dot" style="background:var(--purple)"></span>Account</div>
      <div class="stat-val">${rs(sum(rowsByGroup.account))}</div>
      <div class="stat-sub">${plural(rowsByGroup.account.length)} · ${share(rowsByGroup.account)}${accountMethods.length ? ' · ' + esc(accountMethods.join(', ')) : ''}</div>
    </div>
    ${rowsByGroup[''].length ? `<div class="stat-card">
      <div class="pm-lbl"><span class="leg-dot" style="background:var(--border2)"></span>Not recorded</div>
      <div class="stat-val">${rs(sum(rowsByGroup['']))}</div>
      <div class="stat-sub">${plural(rowsByGroup[''].length)} · ${share(rowsByGroup[''])}</div>
    </div>` : ''}
    <div class="stat-card">
      <div class="stat-lbl">Total collected</div>
      <div class="stat-val c-green">${rs(collected)}</div>
      <div class="stat-sub">${plural(paidRows.length)} paid${unpaid ? ` · ${unpaid} unpaid not included` : ''}</div>
    </div>
  `;

  const groupsEl = document.getElementById('pay-groups');
  if (!paidRows.length) {
    groupsEl.innerHTML = `<div class="card"><div class="empty-state"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><p>No paid bills for ${scope}${search ? ' matching your search' : ''}</p></div></div>`;
    return;
  }
  const [cash, account, unrecorded] = PAYMENT_GROUPS.map(g => paymentGroupCard(g, rowsByGroup[g.key], allMonths));
  groupsEl.innerHTML = `
    <div class="charts-grid-4">${cash}${account}</div>
    ${rowsByGroup[''].length ? `<div class="pay-unrecorded">${unrecorded}</div>` : ''}
  `;
}

function paymentGroupCard(group, rows, allMonths) {
  const showMethod = group.key === 'account';
  const cols = 3 + (allMonths ? 1 : 0) + (showMethod ? 1 : 0);
  const total = round2(rows.reduce((s,r) => s + r.ownCharge, 0));
  const plural = n => n + ' bill' + (n === 1 ? '' : 's');
  const body = rows.length ? rows.map(b => `
    <tr class="row-clickable" onclick="openEntityDetail(${b.entityId})">
      <td><div style="font-weight:600">${esc(b.ent.name)}</div>${b.ent.ownerName ? `<div style="font-size:11px;color:var(--text3)">${esc(b.ent.ownerName)}</div>` : ''}${b.paymentRemarks ? `<div class="bill-breakdown">${esc(b.paymentRemarks)}</div>` : ''}</td>
      ${allMonths ? `<td style="white-space:nowrap">${MONTHS[b.month-1]} ${b.year}</td>` : ''}
      ${showMethod ? `<td>${esc(paymentModeLabel(b.paymentMode))}</td>` : ''}
      <td style="white-space:nowrap">${formatPaidDate(b.paidAt) || '—'}</td>
      <td class="tbl-num"><strong>${rs(b.ownCharge)}</strong></td>
    </tr>`).join('')
    : `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:var(--text3)">No ${group.title.toLowerCase()} payments</td></tr>`;
  return `
    <div class="card">
      <div class="card-hdr">
        <div><div class="card-title pay-group-title"><span class="leg-dot" style="background:${group.color}"></span>${group.title}</div><div class="card-sub">${group.sub} · ${plural(rows.length)}</div></div>
        <div class="pay-group-total">${rs(total)}</div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Entity</th>
            ${allMonths ? '<th>Month</th>' : ''}
            ${showMethod ? '<th>Method</th>' : ''}
            <th>Paid on</th>
            <th class="tbl-num">Amount</th>
          </tr></thead>
          <tbody>${body}</tbody>
          ${rows.length ? `<tfoot><tr><td colspan="${cols-1}">Total</td><td class="tbl-num">${rs(total)}</td></tr></tfoot>` : ''}
        </table>
      </div>
    </div>
  `;
}
