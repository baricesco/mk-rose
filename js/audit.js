/* ═══════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════ */

function localDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function clearAuditDate() {
  const dateInput = document.getElementById('audit-date');
  if (dateInput) dateInput.value = '';
  loadAudit();
}

async function loadAudit() {
  const list = document.getElementById('audit-list');
  if (!list) return;

  // No date selected = show everything ever recorded, not just today.
  // The date input is left empty (native "mm/dd/yyyy" placeholder shows
  // through) instead of being force-filled back to today's date.
  const dateVal = document.getElementById('audit-date')?.value || '';

  list.innerHTML = '<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:12.5px">Loading…</div>';

  let query = sb.from('audit_log').select('*').order('created_at', { ascending: false });
  let emptyMsg = 'No changes recorded yet.';
  if (dateVal) {
    const [y, m, d] = dateVal.split('-').map(Number);
    const dayStart = new Date(y, m-1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m-1, d+1, 0, 0, 0, 0);
    const isToday = localDateInputValue(new Date()) === dateVal;
    query = query.gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString());
    emptyMsg = `No changes recorded ${isToday ? 'today' : 'on this date'}.`;
  }

  const { data, error } = await query;
  if (error) { list.innerHTML = '<div style="padding:16px 0;color:var(--red-dk);font-size:12.5px">Failed to load change history.</div>'; return; }

  if (!data || !data.length) {
    list.innerHTML = `<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:12.5px">${emptyMsg}</div>`;
    return;
  }

  const actionBadge = { create:'badge-green', update:'badge-blue', delete:'badge-red', restore:'badge-amber' };
  list.innerHTML = data.map(row => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${actionBadge[row.action]||'badge-gray'}">${esc(row.action)}</span>
        <span style="font-size:12.5px">${esc(row.summary)}</span>
      </div>
      <div style="font-size:11px;color:var(--text3);white-space:nowrap;margin-left:12px">${new Date(row.created_at).toLocaleTimeString('en-PK', { hour:'numeric', minute:'2-digit' })}</div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════
   TRASH  (soft-deleted entities & bills — restorable, never erased)
═══════════════════════════════════════════════════════════ */

const fmtDeletedAt = ts => ts ? new Date(ts).toLocaleString('en-PK', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' }) : '';

async function loadTrash() {
  const list = document.getElementById('trash-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:12.5px">Loading…</div>';

  const [entRes, billRes] = await Promise.all([
    sb.from('entities').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    sb.from('bills').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
  ]);
  if (entRes.error || billRes.error) { list.innerHTML = '<div style="padding:16px 0;color:var(--red-dk);font-size:12.5px">Failed to load trash.</div>'; return; }

  const trashedEntities = entRes.data || [];
  const trashedBills = billRes.data || [];
  const entityName = id => DB.entities.find(e => e.id === id)?.name
    || trashedEntities.find(e => e.id === id)?.name
    || `Entity #${id}`;

  if (!trashedEntities.length && !trashedBills.length) {
    list.innerHTML = '<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:12.5px">Nothing in the trash.</div>';
    return;
  }

  const entityRows = trashedEntities.map(e => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-weight:600;font-size:13px">${esc(e.name)} <span class="badge badge-gray" style="margin-left:4px">entity</span></div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Deleted ${fmtDeletedAt(e.deleted_at)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="restoreEntity(${e.id})"><svg viewBox="0 0 24 24"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Restore</button>
    </div>
  `).join('');

  const billRows = trashedBills.map(b => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-weight:600;font-size:13px">${esc(entityName(b.entity_id))} — ${MONTHS_FULL[b.month-1]} ${b.year} <span class="badge badge-gray" style="margin-left:4px">bill</span></div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Deleted ${fmtDeletedAt(b.deleted_at)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="restoreBill(${b.id}, ${b.month}, ${b.year})"><svg viewBox="0 0 24 24"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Restore</button>
    </div>
  `).join('');

  list.innerHTML = entityRows + billRows;
}

async function restoreEntity(id) {
  const { error } = await sb.from('entities').update({ deleted_at: null }).eq('id', id);
  if (error) { toast('Error: '+error.message, 'error'); return; }
  await loadAll();
  initMonthSelector();
  logAudit('entities', id, 'restore', `Restored entity "${DB.entities.find(e=>e.id===id)?.name}"`);
  await loadTrash();
  toast('Entity restored', 'success');
}

async function restoreBill(id, month, year) {
  if (isPeriodLocked(month, year)) { toast(`${MONTHS_FULL[month-1]} ${year} is locked — unlock it in Settings to make changes`, 'error'); return; }
  const { error } = await sb.from('bills').update({ deleted_at: null }).eq('id', id);
  if (error) { toast('Error: '+error.message, 'error'); return; }
  await loadAll();
  initMonthSelector();
  const b = DB.bills.find(x=>x.id===id);
  const entName = DB.entities.find(e=>e.id===b?.entityId)?.name;
  logAudit('bills', id, 'restore', `Restored ${MONTHS_FULL[b?.month-1]} ${b?.year} bill for "${entName}"`);
  await loadTrash();
  toast('Bill restored', 'success');
}

