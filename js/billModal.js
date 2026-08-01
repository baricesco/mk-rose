/* ═══════════════════════════════════════════════════════════
   BILL MODAL
═══════════════════════════════════════════════════════════ */

/* ── bill photo upload state + helpers ─────────────────────── */
let billImageFile = null;        // newly picked File (null if none)
let billImageExistingUrl = '';   // url already saved on the bill (edit mode)
let billImageRemoved = false;    // user cleared an existing photo

function resetBillImage() {
  billImageFile = null; billImageExistingUrl = ''; billImageRemoved = false;
  const inp = document.getElementById('bf-image'); if (inp) inp.value = '';
  document.getElementById('bf-image-preview').style.display = 'none';
  document.getElementById('bf-image-thumb').removeAttribute('src');
}

function showBillImage(src) {
  document.getElementById('bf-image-thumb').src = src;
  document.getElementById('bf-image-preview').style.display = 'block';
}

function onBillImagePick(event) {
  const file = event.target.files[0];
  if (!file) return;
  setBillImageFile(file);
}

// Shared entry point for file input, drag-drop, and clipboard paste.
function setBillImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Please provide an image file', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { toast('Image too large (max 8 MB)', 'error'); return; }
  billImageFile = file; billImageRemoved = false;
  document.getElementById('bf-image').value = '';
  showBillImage(URL.createObjectURL(file));
}

function onBillImageDragOver(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--primary, #4f7cff)';
  event.currentTarget.style.background = 'var(--surface-hover, rgba(79,124,255,.06))';
}

function onBillImageDragLeave(event) {
  event.currentTarget.style.borderColor = 'var(--border)';
  event.currentTarget.style.background = '';
}

function onBillImageDrop(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--border)';
  event.currentTarget.style.background = '';
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) setBillImageFile(file);
}

// Paste a screenshot/image from the clipboard while the bill modal is open.
document.addEventListener('paste', (event) => {
  const modal = document.getElementById('modal-bill');
  if (!modal || !modal.classList.contains('open')) return;
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) { setBillImageFile(file); event.preventDefault(); }
      break;
    }
  }
});

function clearBillImage() {
  billImageFile = null; billImageRemoved = true;
  document.getElementById('bf-image').value = '';
  document.getElementById('bf-image-preview').style.display = 'none';
  document.getElementById('bf-image-thumb').removeAttribute('src');
}

// Uploads the picked file (if any) and returns the final image URL to store.
async function resolveBillImageUrl(entityId, month, year) {
  if (billImageFile) {
    const ext = (billImageFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `${entityId}/${year}-${String(month).padStart(2,'0')}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('bill-images').upload(path, billImageFile, { upsert: true, contentType: billImageFile.type });
    if (error) { toast('Image upload failed: ' + error.message, 'error'); throw error; }
    return sb.storage.from('bill-images').getPublicUrl(path).data.publicUrl;
  }
  if (billImageRemoved) return '';
  return billImageExistingUrl;
}

// Vacated entities are blocked from getting new readings until they're
// marked occupied again — this both warns and disables Save, and
// saveBill() re-checks the same thing server-side-of-the-click in case
// the modal's state gets out of sync.
function updateVacatedWarning() {
  const entityId = parseInt(document.getElementById('bf-entity').value);
  const ent = DB.entities.find(e=>e.id===entityId);
  const warning = document.getElementById('bf-vacated-warning');
  const saveBtn = document.getElementById('btn-save-bill');
  if (ent?.vacatedAt) {
    warning.textContent = `"${ent.name}" is marked vacated (since ${formatPaidDate(ent.vacatedAt)}) — mark it occupied again before adding a reading.`;
    warning.style.display = 'block';
    saveBtn.disabled = true;
  } else {
    warning.style.display = 'none';
    saveBtn.disabled = false;
  }
}

function openAddBill() {
  const currentRate = DB.settings.currentRate;
  document.getElementById('modal-bill-title').textContent = 'Add meter reading';
  document.getElementById('bill-edit-id').value = '';
  const sel = document.getElementById('bf-entity');
  sel.innerHTML = '<option value="">Select entity…</option>' + DB.entities.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  document.getElementById('bf-month').value = selectedMonth;
  document.getElementById('bf-year').value = selectedYear;
  document.getElementById('bf-prev').value = '';
  document.getElementById('bf-curr').value = '';
  document.getElementById('bf-rate').value = currentRate;
  document.getElementById('bill-preview').style.display = 'none';
  resetBillImage();
  updateVacatedWarning();
  openModal('modal-bill');
}

function openAddBillForEntity(entityId) {
  openAddBill();
  document.getElementById('bf-entity').value = entityId;
  onBillEntityChange();
}

function openEditBill(id) {
  const bill = DB.bills.find(b=>b.id===id);
  if (!bill) return;
  document.getElementById('modal-bill-title').textContent = 'Edit reading';
  document.getElementById('bill-edit-id').value = id;
  const sel = document.getElementById('bf-entity');
  sel.innerHTML = DB.entities.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  sel.value = bill.entityId;
  document.getElementById('bf-month').value = bill.month;
  document.getElementById('bf-year').value = bill.year;
  document.getElementById('bf-prev').value = bill.prevReading;
  document.getElementById('bf-curr').value = bill.currReading;
  document.getElementById('bf-rate').value = bill.rate;
  resetBillImage();
  if (bill.imageUrl) { billImageExistingUrl = bill.imageUrl; showBillImage(bill.imageUrl); }
  calcBillPreview();
  updateVacatedWarning();
  openModal('modal-bill');
}

function onBillEntityChange() {
  const entityId = parseInt(document.getElementById('bf-entity').value);
  const month = parseInt(document.getElementById('bf-month').value);
  const year = parseInt(document.getElementById('bf-year').value);
  updateVacatedWarning();
  if (!entityId) { document.getElementById('bf-prev').value=''; return; }

  const ent = DB.entities.find(e=>e.id===entityId);

  const bills = getEntityBills(entityId);
  const prevBill = [...bills].reverse().find(b => b.year < year || (b.year===year && b.month < month));
  document.getElementById('bf-prev').value = prevBill ? prevBill.currReading : 0;

  const rate = prevBill?.rate || DB.settings.currentRate;
  document.getElementById('bf-rate').value = rate;
  calcBillPreview();
}

function calcBillPreview() {
  const entityId = parseInt(document.getElementById('bf-entity').value);
  const curr = num(document.getElementById('bf-curr').value);
  const prev = num(document.getElementById('bf-prev').value);
  const rate = num(document.getElementById('bf-rate').value);
  const month = parseInt(document.getElementById('bf-month').value);
  const year = parseInt(document.getElementById('bf-year').value);
  const editId = document.getElementById('bill-edit-id').value;

  const preview = document.getElementById('bill-preview');
  if (!entityId || curr < prev) { preview.style.display='none'; return; }

  const ownUnits = round2(curr - prev);
  const ownCharge = round2(ownUnits * rate);

  // arrears = consecutive unpaid months before this period (excluding the one being edited)
  const existing = getEntityBills(entityId).filter(b => !(b.month===month && b.year===year) && b.id !== parseInt(editId||-1));
  let arrears = 0, arrearsMonths = [];
  for (let i = existing.length-1; i>=0; i--) {
    if (existing[i].year > year || (existing[i].year===year && existing[i].month > month)) continue; // only look backwards
    if (existing[i].paid) break;
    const u = Math.max(0, num(existing[i].currReading)-num(existing[i].prevReading));
    arrears = round2(arrears + u*num(existing[i].rate));
    arrearsMonths.unshift(MONTHS[existing[i].month-1]+' '+existing[i].year);
  }
  const totalDue = round2(ownCharge + arrears);

  preview.style.display = 'block';
  preview.innerHTML = `
    Units this month: <strong>${ownUnits}</strong> × Rs ${rate} = <strong>${rs(ownCharge)}</strong><br>
    ${arrears ? `Arrears (${arrearsMonths.join(', ')}): <strong>${rs(arrears)}</strong><br>` : ''}
    Total payable now: <strong style="color:var(--text);font-size:13px">${rs(totalDue)}</strong>
  `;
}

async function saveBill() {
  const entityId = parseInt(document.getElementById('bf-entity').value);
  const month = parseInt(document.getElementById('bf-month').value);
  const year = parseInt(document.getElementById('bf-year').value);
  const curr = num(document.getElementById('bf-curr').value);
  const prev = num(document.getElementById('bf-prev').value);
  const rate = num(document.getElementById('bf-rate').value);

  if (!entityId) { toast('Select an entity', 'error'); return; }
  const selectedEnt = DB.entities.find(e=>e.id===entityId);
  if (selectedEnt?.vacatedAt) { toast(`"${selectedEnt.name}" is marked vacated — mark it occupied again before adding a reading`, 'error'); return; }
  if (document.getElementById('bf-curr').value === '' || curr < prev) { toast('Current reading must be ≥ previous reading', 'error'); return; }
  if (!rate) { toast('Rate is required', 'error'); return; }
  if (isPeriodLocked(month, year)) { toast(`${MONTHS_FULL[month-1]} ${year} is locked — unlock it in Settings to make changes`, 'error'); return; }

  const editId = document.getElementById('bill-edit-id').value;

  setBtnLoading('btn-save-bill', true, 'Saving…');
  try {
    let imageUrl;
    try { imageUrl = await resolveBillImageUrl(entityId, month, year); }
    catch { return; }   // upload error already toasted

    const payload = { entity_id:entityId, month, year, prev_reading:prev, curr_reading:curr, units_used:round2(curr-prev), rate, bill_image_url:imageUrl };

    const entName = DB.entities.find(e=>e.id===entityId)?.name || `Entity #${entityId}`;
    if (editId) {
      const { error } = await sb.from('bills').update(payload).eq('id', parseInt(editId));
      if (error) { toast(error.code==='23505'?'A bill already exists for that entity/month':'Error: '+error.message, 'error'); return; }
      logAudit('bills', parseInt(editId), 'update', `Updated ${MONTHS_FULL[month-1]} ${year} reading for "${entName}"`);
      toast('Reading updated', 'success');
    } else {
      const { data, error } = await sb.from('bills').insert({ ...payload, paid:false }).select().single();
      if (error) { toast(error.code==='23505'?'A bill already exists for this month':'Error: '+error.message, 'error'); return; }
      logAudit('bills', data?.id, 'create', `Added ${MONTHS_FULL[month-1]} ${year} reading for "${entName}"`);
      toast('Reading added', 'success');
    }
    closeModal('modal-bill');
    await loadAll();
    initMonthSelector();
    rerenderCurrent();
  } finally {
    setBtnLoading('btn-save-bill', false);
  }
}


