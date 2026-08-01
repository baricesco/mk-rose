/* ═══════════════════════════════════════════════════════════
   ENTITY MODAL
═══════════════════════════════════════════════════════════ */

function openAddEntity() {
  document.getElementById('modal-entity-title').textContent = 'Add entity';
  document.getElementById('entity-edit-id').value = '';
  document.getElementById('ef-name').value = '';
  document.getElementById('ef-type').value = 'flat';
  document.getElementById('ef-owner').value = '';
  document.getElementById('ef-owner-phone').value = '';
  document.getElementById('ef-meter').value = '';
  document.getElementById('ef-init-reading').value = 0;
  openModal('modal-entity');
}

/* ── locked-record unlock flow: every edit action in the app must be
   confirmed by typing "EDIT" first, no exceptions ────────────────── */
let unlockEditTarget = null; // { type: 'entity'|'bill'|'rate', id }

function requestUnlockEdit(type, id) {
  unlockEditTarget = { type, id };
  const inp = document.getElementById('unlock-edit-input');
  inp.value = '';
  document.getElementById('unlock-edit-btn').disabled = true;
  openModal('modal-confirm-edit');
  setTimeout(() => inp.focus(), 50);
}

function onUnlockEditInput() {
  const val = document.getElementById('unlock-edit-input').value.trim().toLowerCase();
  document.getElementById('unlock-edit-btn').disabled = val !== 'edit';
}

function submitUnlockEdit() {
  const val = document.getElementById('unlock-edit-input').value.trim().toLowerCase();
  if (val !== 'edit' || !unlockEditTarget) return;
  const { type, id } = unlockEditTarget;
  closeModal('modal-confirm-edit');
  unlockEditTarget = null;
  if (type === 'entity') openEditEntity(id);
  else if (type === 'bill') openEditBill(id);
}

function openEditEntity(id) {
  const ent = DB.entities.find(e=>e.id===id);
  if (!ent) return;
  document.getElementById('modal-entity-title').textContent = 'Edit entity';
  document.getElementById('entity-edit-id').value = id;
  document.getElementById('ef-name').value = ent.name;
  document.getElementById('ef-type').value = ent.type;
  document.getElementById('ef-owner').value = ent.ownerName;
  document.getElementById('ef-owner-phone').value = ent.ownerPhone;
  document.getElementById('ef-meter').value = ent.meter;
  document.getElementById('ef-init-reading').value = '';
  openModal('modal-entity');
}

async function saveEntity() {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { toast('Entity name is required', 'error'); return; }
  const editId = document.getElementById('entity-edit-id').value;
  const payload = {
    name,
    type: document.getElementById('ef-type').value,
    owner_name: document.getElementById('ef-owner').value.trim(),
    owner_phone: document.getElementById('ef-owner-phone').value.trim(),
    meter: document.getElementById('ef-meter').value.trim(),
  };
  const initReading = num(document.getElementById('ef-init-reading').value);

  setBtnLoading('btn-save-entity', true, 'Saving…');
  try {
    if (editId) {
      const { error } = await sb.from('entities').update(payload).eq('id', parseInt(editId));
      if (error) { toast('Error: '+error.message, 'error'); return; }
      logAudit('entities', parseInt(editId), 'update', `Updated entity "${name}"`);
      toast('Entity updated', 'success');
    } else {
      const { data, error } = await sb.from('entities').insert(payload).select().single();
      if (error) { toast('Error: '+error.message, 'error'); return; }
      // Optional opening reading: seed an initial bill row so the first real reading has a "previous".
      if (initReading > 0 && data) {
        const now = new Date();
        const rate = DB.settings.currentRate;
        await sb.from('bills').insert({ entity_id:data.id, month:now.getMonth()+1, year:now.getFullYear(), prev_reading:initReading, curr_reading:initReading, units_used:0, rate, paid:true, paid_at:now.toISOString() });
      }
      logAudit('entities', data?.id, 'create', `Added entity "${name}"`);
      toast('Entity added', 'success');
    }
    closeModal('modal-entity');
    await loadAll();
    initMonthSelector();
    rerenderCurrent();
  } finally {
    setBtnLoading('btn-save-entity', false);
  }
}


