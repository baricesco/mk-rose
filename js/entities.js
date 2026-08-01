/* ═══════════════════════════════════════════════════════════
   ENTITY DETAIL
═══════════════════════════════════════════════════════════ */

// openEntityDetail(entityId) lives in router.js (navigate('entities', entityId))
// — the hash is the single source of truth for which entity is drilled into.

function showEntityList() {
  document.getElementById('entities-list-view').style.display = '';
  document.getElementById('entity-detail-view').style.display = 'none';
  renderEntitiesPage();
}

function showEntityDetail(entityId) {
  document.getElementById('entities-list-view').style.display = 'none';
  const detailView = document.getElementById('entity-detail-view');
  detailView.style.display = '';

  const ent = DB.entities.find(e=>e.id===entityId);
  if (!ent) { showEntityList(); return; }

  const computed = computeBillAmounts(entityId);
  const totalBilled    = computed.reduce((s,b)=>s+b.ownCharge,0);
  const totalCollected = computed.filter(b=>b.paid).reduce((s,b)=>s+b.ownCharge,0);
  const outstanding    = computed.filter(b=>!b.paid).reduce((s,b)=>s+b.ownCharge,0);
  const totalUnits     = computed.reduce((s,b)=>s+b.ownUnits,0);
  const latestReading  = computed.length ? computed[computed.length-1].currReading : 0;

  const billRows = computed.slice().reverse().map(b => {
    const hasArrears = b.arrearsMonths.length > 0;
    return `
      <tr class="${!b.paid && hasArrears ? 'bill-row-chain' : ''}">
        <td><strong>${MONTHS_FULL[b.month-1]} ${b.year}</strong></td>
        <td class="tbl-mono tbl-num">${num(b.prevReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td class="tbl-mono tbl-num">${num(b.currReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td class="tbl-mono tbl-num">${num(b.ownUnits).toFixed(2)}</td>
        <td class="tbl-mono tbl-num">Rs ${b.rate}</td>
        <td class="tbl-num"><strong>${rs(b.ownCharge)}</strong>
          ${!b.paid && hasArrears ? `<div class="bill-breakdown">+ arrears ${rs(b.arrears)} → due ${rs(b.totalDue)}</div>` : ''}
        </td>
        <td>
          <span class="badge ${b.paid?'badge-green':'badge-red'}">
            ${b.paid ? `<svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Paid` : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Unpaid`}
          </span>
          ${b.paid && b.paymentMode ? `<div class="bill-breakdown">${esc(paymentModeLabel(b.paymentMode))}${b.paidAt?' · '+formatPaidDate(b.paidAt):''}${b.paymentRemarks?'<br>'+esc(b.paymentRemarks):''}</div>` : ''}
        </td>
        <td>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${!b.paid ? `<button class="btn btn-primary btn-xs" onclick="confirmMarkPaid(${entityId},${b.month},${b.year})">
              <svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Mark paid
            </button>` : ''}
            <button class="btn btn-ghost btn-xs" title="Print bill" aria-label="Print bill" onclick="printBill(${entityId},${b.month},${b.year})">
              <svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <button class="btn btn-ghost btn-xs" title="Edit reading" aria-label="Edit reading" onclick="requestUnlockEdit('bill', ${b.id})">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  detailView.innerHTML = `
    <div class="breadcrumb">
      <a onclick="showEntityList()"><svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>Entities</a>
      <svg viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6"/></svg>
      <span>${esc(ent.name)}</span>
    </div>

    <div class="detail-hdr">
      <div style="display:flex;align-items:center">
        <div class="detail-avatar eavatar ${ent.type}" style="width:48px;height:48px;font-size:14px;margin-right:14px">${ent.id}</div>
        <div>
          <div class="detail-name">${esc(ent.name)}</div>
          <div class="detail-meta">
            ${ent.ownerName ? `<span><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(ent.ownerName)}</span>` : ''}
            <span><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Meter: ${esc(ent.meter||'—')}</span>
            <span><span class="badge badge-gray">${ent.type}</span>${ent.vacatedAt ? ` <span class="badge badge-amber" style="margin-left:4px">Vacated ${formatPaidDate(ent.vacatedAt)}</span>` : ''}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="requestUnlockEdit('entity', ${ent.id})">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Edit
        </button>
        <button class="btn btn-ghost" title="${ent.vacatedAt ? 'Mark as occupied again' : 'Flag this entity as vacated — tenant/owner has left'}" onclick="${ent.vacatedAt ? `markEntityOccupied(${ent.id})` : `openVacateModal(${ent.id})`}">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>${ent.vacatedAt ? 'Mark occupied' : 'Mark vacated'}
        </button>
        <button class="btn btn-ghost" title="Share with tenant" aria-label="Share with tenant" onclick="openEntityShare(${ent.id})">
          <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share
        </button>
        <button class="btn btn-ghost" onclick="openAddBillForEntity(${ent.id})">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add reading
        </button>
        <button class="btn btn-primary" onclick="printBill(${ent.id})">
          <svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print latest bill
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-hdr">
        <div>
          <div class="card-title">Entity Detail</div>
          <div class="card-sub">Locked — use the Edit button to change anything</div>
        </div>
        <svg class="locked-hdr-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
      <div class="card-body">
        <div class="detail-grid">
          <div><div class="detail-field-lbl">Entity name</div><div class="detail-field-val">${esc(ent.name)}</div></div>
          <div><div class="detail-field-lbl">Owner name</div><div class="detail-field-val">${ent.ownerName ? esc(ent.ownerName) : '<span style="color:var(--text3);font-weight:500">N/A</span>'}</div></div>
          <div><div class="detail-field-lbl">Contact no</div><div class="detail-field-val">${ent.ownerPhone ? esc(ent.ownerPhone) : '<span style="color:var(--text3);font-weight:500">N/A</span>'}</div></div>
          <div><div class="detail-field-lbl">Meter number</div><div class="detail-field-val" style="font-family:var(--mono)">${esc(ent.meter||'—')}</div></div>
          <div><div class="detail-field-lbl">Type</div><div class="detail-field-val"><span class="badge badge-gray">${ent.type}</span></div></div>
          <div><div class="detail-field-lbl">Entity ID</div><div class="detail-field-val" style="font-family:var(--mono)">#${ent.id}</div></div>
        </div>
      </div>
    </div>

    <div class="detail-stats">
      <div class="stat-card"><div class="stat-lbl">Latest reading</div><div class="stat-val" style="font-family:var(--mono);font-size:20px">${num(latestReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div class="stat-sub">units</div></div>
      <div class="stat-card"><div class="stat-lbl">Total billed</div><div class="stat-val" style="font-size:18px">${rs(totalBilled)}</div><div class="stat-sub">${computed.length} months</div></div>
      <div class="stat-card"><div class="stat-lbl">Collected</div><div class="stat-val c-green" style="font-size:18px">${rs(totalCollected)}</div><div class="stat-sub">${computed.filter(b=>b.paid).length} paid</div></div>
      <div class="stat-card"><div class="stat-lbl">Outstanding</div><div class="stat-val c-red" style="font-size:18px">${rs(outstanding)}</div><div class="stat-sub">${computed.filter(b=>!b.paid).length} unpaid</div></div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div>
          <div class="card-title">Billing history</div>
          <div class="card-sub">${ent.ownerPhone?esc(ent.ownerPhone):''}</div>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Month</th><th class="tbl-num">Prev Reading</th><th class="tbl-num">Curr Reading</th>
              <th class="tbl-num">Units Used</th><th class="tbl-num">Rate</th>
              <th class="tbl-num">Charge</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${billRows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">No bills yet. Add a reading to get started.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════
   ENTITIES PAGE (LIST)
═══════════════════════════════════════════════════════════ */

function renderEntitiesPage() {
  const search = document.getElementById('entity-search')?.value.toLowerCase() || '';
  const typeF = document.getElementById('entity-filter-type')?.value || '';
  const occF = document.getElementById('entity-filter-occupancy')?.value || '';

  const ents = DB.entities.filter(e => {
    if (typeF && e.type!==typeF) return false;
    if (occF==='vacated' && !e.vacatedAt) return false;
    if (occF==='occupied' && e.vacatedAt) return false;
    if (search && ![e.name,e.meter,e.ownerName].some(v=>String(v||'').toLowerCase().includes(search))) return false;
    return true;
  });

  const tbody = document.getElementById('entities-tbl-body');
  if (!tbody) return;
  if (!ents.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">No entities found</td></tr>';
    return;
  }

  tbody.innerHTML = ents.map(e => {
    const b = getBillForMonth(e.id, selectedMonth, selectedYear);
    const paid = b?.paid ?? null;
    const charge = b ? b.ownCharge : null;
    return `
      <tr class="row-clickable" onclick="openEntityDetail(${e.id})" style="${e.vacatedAt?'opacity:.6':''}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="eavatar ${e.type}" style="width:32px;height:32px;font-size:11px">${e.id}</div>
            <div><div style="font-weight:600;font-size:13px">${esc(e.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(e.meter||'—')}</div></div>
          </div>
        </td>
        <td>${e.ownerName ? esc(e.ownerName) : '<span style="color:var(--text3)">—</span>'}</td>
        <td><span class="badge badge-gray">${e.type}</span>${e.vacatedAt ? ` <span class="badge badge-amber" title="Vacated ${formatPaidDate(e.vacatedAt)}">Vacated</span>` : ''}</td>
        <td><span style="font-family:var(--mono);font-size:12px">${esc(e.meter||'—')}</span></td>
        <td class="tbl-num">${charge!==null ? rs(charge) : '<span style="color:var(--text3)">—</span>'}</td>
        <td>${paid===null ? '<span style="color:var(--text3)">—</span>' : `<span class="badge ${paid?'badge-green':'badge-red'}">${paid?'Paid':'Unpaid'}</span>`}</td>
        <td>
          <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-xs" onclick="openEntityDetail(${e.id})"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View</button>
            <button class="btn btn-ghost btn-xs" title="Print bill" aria-label="Print bill" onclick="printBill(${e.id})"><svg viewBox="0 0 24 24"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
            <button class="btn btn-ghost btn-xs" title="Edit entity" aria-label="Edit entity" onclick="requestUnlockEdit('entity', ${e.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Flags an entity as vacated (tenant/shop owner has left) or reverses
// that — doesn't touch bills, billing, or the share link, purely a
// status marker so a vacated entity is still visible (dimmed + badged)
// rather than hidden like a soft-deleted one. Vacated-as-of date is
// stored as the last day of the chosen month (noon, to dodge timezone
// rounding) — matches how meter photo dates are treated elsewhere.
async function setEntityVacated(entityId, vacatedAtIso) {
  const ent = DB.entities.find(e=>e.id===entityId);
  if (!ent) return;
  const { error } = await sb.from('entities').update({ vacated_at: vacatedAtIso }).eq('id', entityId);
  if (error) { toast('Error: '+error.message, 'error'); return; }
  logAudit('entities', entityId, 'update', vacatedAtIso
    ? `Marked "${ent.name}" as vacated (${formatPaidDate(vacatedAtIso)})`
    : `Unmarked "${ent.name}" as vacated`);
  await loadAll();
  rerenderCurrent();
  toast(vacatedAtIso ? 'Entity marked as vacated' : 'Entity marked as occupied', 'success');
}

function markEntityOccupied(entityId) { setEntityVacated(entityId, null); }

let vacateModalEntityId = null;

function openVacateModal(entityId) {
  const ent = DB.entities.find(e=>e.id===entityId);
  if (!ent) return;
  vacateModalEntityId = entityId;
  document.getElementById('vacate-entity-name').textContent = ent.name;
  const now = new Date();
  document.getElementById('vacate-month').value = now.getMonth()+1;
  document.getElementById('vacate-year').value = now.getFullYear();
  openModal('modal-vacate');
}

async function submitVacateEntity() {
  const month = parseInt(document.getElementById('vacate-month').value);
  const year = parseInt(document.getElementById('vacate-year').value);
  if (!year) { toast('Enter a year', 'error'); return; }
  closeModal('modal-vacate');
  const vacatedAtIso = new Date(year, month, 0, 12, 0, 0).toISOString();
  await setEntityVacated(vacateModalEntityId, vacatedAtIso);
}

/* ═══════════════════════════════════════════════════════════
   SHARE MODAL  (Drive-style "share" dialog — link + active/inactive)

   The link is keyed off share_token (a random uuid), not the entity's
   plain sequential id — so there's nothing to increment/guess in the
   URL to land on a different entity's bills. The link itself never
   changes and never expires: share.html always pulls live data by
   that token, so future months' bills/photos show up automatically
   without ever generating a new link. share_enabled (toggled below)
   is the only thing that can take it offline — flipping it back on
   brings the exact same URL back to life.
═══════════════════════════════════════════════════════════ */

let shareModalEntityId = null;

function shareLinkFor(ent) {
  return new URL('share.html?s=' + encodeURIComponent(ent.shareToken), location.href).href;
}

function openEntityShare(entityId) {
  shareModalEntityId = entityId;
  renderShareModal();
  openModal('modal-share');
}

function renderShareModal() {
  const ent = DB.entities.find(e=>e.id===shareModalEntityId);
  if (!ent) return;

  document.getElementById('modal-share-title').textContent = `Share — ${ent.name}`;
  document.getElementById('share-link-input').value = shareLinkFor(ent);

  const activeBtn = document.getElementById('share-modal-active-btn');
  const inactiveBtn = document.getElementById('share-modal-inactive-btn');
  activeBtn.className = 'btn btn-sm ' + (ent.shareEnabled ? 'btn-primary' : 'btn-ghost');
  inactiveBtn.className = 'btn btn-sm ' + (!ent.shareEnabled ? 'btn-danger' : 'btn-ghost');

  document.getElementById('share-status-note').textContent = ent.shareEnabled
    ? 'Anyone with this link can view billing history, download bills, and see dated meter photos — no login needed.'
    : 'This link is inactive — anyone opening it sees a "turned off" message instead of any data.';
}

// Sets share_enabled directly (not a blind toggle), so clicking the
// button matching the current state is a harmless no-op.
async function setEntityShareActive(active) {
  const ent = DB.entities.find(e=>e.id===shareModalEntityId);
  if (!ent || ent.shareEnabled === active) return;
  const { error } = await sb.from('entities').update({ share_enabled: active }).eq('id', ent.id);
  if (error) { toast('Error: '+error.message, 'error'); return; }
  logAudit('entities', ent.id, 'update', `${active ? 'Activated' : 'Deactivated'} share link for "${ent.name}"`);
  await loadAll();
  renderShareModal();
  rerenderCurrent();
  toast(active ? 'Share link is now active' : 'Share link is now inactive', 'success');
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  input.select();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(input.value)
      .then(() => toast('Link copied', 'success'))
      .catch(() => toast('Copy failed — select the link and copy manually', 'error'));
  } else {
    toast('Link selected — copy with Ctrl+C', '');
  }
}

function openShareLinkNewTab() {
  const ent = DB.entities.find(e=>e.id===shareModalEntityId);
  if (!ent) return;
  window.open(shareLinkFor(ent), '_blank');
}

