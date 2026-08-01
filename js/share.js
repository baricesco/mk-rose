/* ═══════════════════════════════════════════════════════════
   SHARE PAGE  (read-only, tenant-facing view for one entity)

   Loaded standalone from share.html?e=<entityId> — always light
   theme, no login. Talks to Supabase directly with the same
   anon key as the main app (data.js / print.js are reused as-is
   for their helpers; only this entity's own rows are fetched).
═══════════════════════════════════════════════════════════ */

let sharePhotoItems = [];   // bills (for this entity) that have a photo, newest first
let shareLightboxIndex = -1;

function shareEntityIdFromUrl() {
  const id = parseInt(new URLSearchParams(location.search).get('e'), 10);
  return Number.isFinite(id) ? id : null;
}

// The meter/bill photo for a billing period is treated as taken on the
// last day of that month (there's no separate "photo taken" timestamp).
function shareLastDayDate(month, year) { return new Date(year, month, 0); }
function shareLastDayLabel(month, year) {
  return shareLastDayDate(month, year).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
}

async function loadShareData(entityId) {
  const [entRes, billsRes, setRes] = await Promise.all([
    sb.from('entities').select('*').eq('id', entityId).is('deleted_at', null).maybeSingle(),
    sb.from('bills').select('*').eq('entity_id', entityId).is('deleted_at', null),
    sb.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (entRes.error || billsRes.error || !entRes.data) return false;
  DB.entities = [mapEntity(entRes.data)];
  DB.bills = (billsRes.data || []).map(mapBill);
  DB.settings = setRes.data ? {
    buildingName: setRes.data.building_name || '',
    address:      setRes.data.address || '',
    contact:      setRes.data.contact || '',
    logoUrl:      setRes.data.logo_url || '',
    currentRate:  num(setRes.data.current_rate),
  } : { ...DEFAULT_SETTINGS };
  return true;
}

function renderShareError(msg) {
  document.getElementById('share-root').innerHTML = `
    <div class="empty-state" style="padding:60px 20px">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>${esc(msg)}</p>
    </div>`;
}

// Shown when the owner has flipped the "Link active" toggle off. The URL
// itself is untouched — it starts working again the moment they flip it
// back on, nothing to regenerate or re-share.
function renderShareInactive() {
  document.getElementById('share-root').innerHTML = `
    <div class="empty-state" style="padding:60px 20px">
      <svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
      <p>This share link has been turned off by the owner.</p>
      <small>Ask them to switch it back on if you need access again.</small>
    </div>`;
}

async function initSharePage() {
  const entityId = shareEntityIdFromUrl();
  if (!entityId) { renderShareError('No entity specified — this link is invalid.'); return; }
  if (!CONFIGURED) { renderShareError('Database not configured.'); return; }
  try {
    const ok = await loadShareData(entityId);
    if (!ok) { renderShareError('This entity could not be found — the link may be out of date.'); return; }
    if (!DB.entities[0].shareEnabled) { renderShareInactive(); return; }
    renderSharePage();
  } catch (e) {
    console.error(e);
    renderShareError('Something went wrong loading this page.');
  }
}

function renderSharePage() {
  const ent = DB.entities[0];
  document.title = `${ent.name} — Billing History`;

  const computed = computeBillAmounts(ent.id);
  const totalBilled    = computed.reduce((s,b)=>s+b.ownCharge,0);
  const totalCollected = computed.filter(b=>b.paid).reduce((s,b)=>s+b.ownCharge,0);
  const outstanding    = computed.filter(b=>!b.paid).reduce((s,b)=>s+b.ownCharge,0);

  const billRows = computed.slice().reverse().map(b => `
    <tr>
      <td><strong>${MONTHS_FULL[b.month-1]} ${b.year}</strong></td>
      <td class="tbl-num">${num(b.ownUnits).toFixed(2)}</td>
      <td class="tbl-num"><strong>${rs(b.ownCharge)}</strong></td>
      <td>
        <span class="badge ${b.paid?'badge-green':'badge-red'}">
          ${b.paid ? `<svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>Paid` : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Unpaid`}
        </span>
      </td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="downloadBillPdf(${ent.id},${b.month},${b.year})">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF
        </button>
      </td>
    </tr>
  `).join('');

  sharePhotoItems = computed.filter(b => b.imageUrl).slice().reverse();

  const photoTiles = sharePhotoItems.map((b, idx) => `
    <div class="photo-tile" onclick="openShareLightbox(${idx})">
      <img src="${esc(b.imageUrl)}" alt="${esc(ent.name)} meter — ${shareLastDayLabel(b.month,b.year)}" loading="lazy"/>
      <button class="photo-tile-dl" title="Download photo" aria-label="Download photo" onclick="event.stopPropagation();downloadSharePhoto(${idx},this)">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <div class="photo-tile-label">${shareLastDayLabel(b.month,b.year)}</div>
    </div>
  `).join('');

  document.getElementById('share-root').innerHTML = `
    <div class="detail-hdr">
      <div style="display:flex;align-items:center">
        <div class="detail-avatar eavatar ${ent.type}">${ent.id}</div>
        <div>
          <div class="detail-name">${esc(ent.name)}</div>
          <div class="detail-meta">
            ${ent.ownerName ? `<span><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(ent.ownerName)}</span>` : ''}
            <span><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Meter: ${esc(ent.meter||'—')}</span>
            <span><span class="badge badge-gray">${ent.type}</span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="stat-lbl">Total billed</div><div class="stat-val" style="font-size:18px">${rs(totalBilled)}</div><div class="stat-sub">${computed.length} months</div></div>
      <div class="stat-card"><div class="stat-lbl">Collected</div><div class="stat-val c-green" style="font-size:18px">${rs(totalCollected)}</div><div class="stat-sub">${computed.filter(b=>b.paid).length} paid</div></div>
      <div class="stat-card"><div class="stat-lbl">Outstanding</div><div class="stat-val c-red" style="font-size:18px">${rs(outstanding)}</div><div class="stat-sub">${computed.filter(b=>!b.paid).length} unpaid</div></div>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-hdr">
        <div>
          <div class="card-title">Billing history</div>
          <div class="card-sub">Every past reading and its status</div>
        </div>
        <button class="btn btn-primary btn-sm" id="share-dl-bills-btn" onclick="downloadAllShareBillsZip()" ${computed.length?'':'disabled'}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download all (ZIP)
        </button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Month</th><th class="tbl-num">Units Used</th><th class="tbl-num">Charge</th><th>Status</th><th>Download</th></tr></thead>
          <tbody>${billRows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">No bills yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div>
          <div class="card-title">Meter photos</div>
          <div class="card-sub">Dated to the last day of the billing month</div>
        </div>
        <button class="btn btn-primary btn-sm" id="share-dl-photos-btn" onclick="downloadAllSharePhotosZip()" ${sharePhotoItems.length?'':'disabled'}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download all (ZIP)
        </button>
      </div>
      <div class="card-body">
        <div class="photo-grid">${photoTiles || '<div class="empty-state" style="grid-column:1/-1;padding:24px"><p>No photos yet</p></div>'}</div>
      </div>
    </div>
  `;
}

/* ── single-photo download + lightbox ─────────────────────── */

function sharePhotoFilename(ent, bill) {
  const entName = sanitizeFilenamePart(ent.name) || 'Entity';
  const period = `${MONTHS_FULL[bill.month-1]}_${bill.year}`;
  const urlPath = (bill.imageUrl || '').split('?')[0];
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(urlPath);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  return `${entName}_${period}.${ext}`;
}

async function downloadSharePhoto(idx, btnEl) {
  const bill = sharePhotoItems[idx];
  if (!bill || !bill.imageUrl) return;
  if (btnEl) btnEl.disabled = true;
  try {
    const resp = await fetch(bill.imageUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('photo fetch failed (' + resp.status + ')');
    const blob = await resp.blob();
    triggerBlobDownload(blob, sharePhotoFilename(DB.entities[0], bill));
  } catch (e) {
    console.error(e);
    toast('Failed to download photo: ' + e.message, 'error');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

function renderShareLightboxContent() {
  const bill = sharePhotoItems[shareLightboxIndex];
  const ent = DB.entities[0];
  if (!bill) return;
  document.getElementById('lightbox-img').src = bill.imageUrl;
  document.getElementById('lightbox-title').textContent = ent.name + (ent.ownerName ? ' — ' + ent.ownerName : '');
  document.getElementById('lightbox-sub').textContent = `${MONTHS_FULL[bill.month-1]} ${bill.year} · ${shareLastDayLabel(bill.month,bill.year)} · ${bill.paid ? 'Paid' : 'Unpaid'}`;
}

function openShareLightbox(idx) {
  shareLightboxIndex = idx;
  renderShareLightboxContent();
  openModal('modal-lightbox');
}

function shareLightboxStep(delta) {
  if (!sharePhotoItems.length) return;
  shareLightboxIndex = (shareLightboxIndex + delta + sharePhotoItems.length) % sharePhotoItems.length;
  renderShareLightboxContent();
}

function downloadCurrentShareLightboxPhoto(btnEl) {
  downloadSharePhoto(shareLightboxIndex, btnEl);
}

document.addEventListener('keydown', (event) => {
  const modal = document.getElementById('modal-lightbox');
  if (!modal || !modal.classList.contains('open')) return;
  if (event.key === 'ArrowLeft') shareLightboxStep(-1);
  else if (event.key === 'ArrowRight') shareLightboxStep(1);
  else if (event.key === 'Escape') closeModal('modal-lightbox');
});

/* ── bulk ZIP downloads (bills as PDF, photos as-is) ───────── */

async function downloadAllShareBillsZip() {
  const ent = DB.entities[0];
  const computed = computeBillAmounts(ent.id);
  if (!computed.length) { toast('No bills to download', 'error'); return; }

  const btn = document.getElementById('share-dl-bills-btn');
  if (btn) btn.disabled = true;
  showPdfProgress(`Generating ${computed.length} bill${computed.length>1?'s':''}`);
  try {
    const zip = new JSZip();
    for (let i = 0; i < computed.length; i++) {
      const bill = computed[i];
      updatePdfProgress(`Preparing ${MONTHS_FULL[bill.month-1]} ${bill.year}…`, i, computed.length);
      const blob = await renderBillToPdfBlob(ent, bill, s => updatePdfProgress(s, i, computed.length));
      zip.file(`${sanitizeFilenamePart(ent.name)}_${MONTHS_FULL[bill.month-1]}_${bill.year}.pdf`, blob);
    }
    updatePdfProgress('Compressing ZIP…', computed.length, computed.length);
    const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
      updatePdfProgress(`Compressing ZIP… ${Math.round(meta.percent)}%`, computed.length, computed.length);
    });
    triggerBlobDownload(zipBlob, `Bills_${sanitizeFilenamePart(ent.name)}.zip`);
    toast(`${computed.length} bill${computed.length>1?'s':''} downloaded`, 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to generate ZIP: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    hidePdfProgress();
  }
}

async function downloadAllSharePhotosZip() {
  if (!sharePhotoItems.length) { toast('No photos to download', 'error'); return; }
  const ent = DB.entities[0];

  const btn = document.getElementById('share-dl-photos-btn');
  if (btn) btn.disabled = true;
  showPdfProgress(`Downloading ${sharePhotoItems.length} photo${sharePhotoItems.length>1?'s':''}`);
  try {
    const zip = new JSZip();
    const usedNames = new Map();
    for (let i = 0; i < sharePhotoItems.length; i++) {
      const bill = sharePhotoItems[i];
      updatePdfProgress(`Fetching ${MONTHS_FULL[bill.month-1]} ${bill.year}…`, i, sharePhotoItems.length);
      const resp = await fetch(bill.imageUrl, { cache: 'no-store' });
      if (!resp.ok) { console.warn('photo fetch failed', bill.imageUrl); continue; }
      const blob = await resp.blob();
      let name = sharePhotoFilename(ent, bill);
      const count = usedNames.get(name) || 0;
      usedNames.set(name, count + 1);
      if (count > 0) name = name.replace(/(\.[a-zA-Z0-9]+)$/, ` (${count})$1`);
      zip.file(name, blob);
    }
    updatePdfProgress('Compressing ZIP…', sharePhotoItems.length, sharePhotoItems.length);
    const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
      updatePdfProgress(`Compressing ZIP… ${Math.round(meta.percent)}%`, sharePhotoItems.length, sharePhotoItems.length);
    });
    triggerBlobDownload(zipBlob, `Photos_${sanitizeFilenamePart(ent.name)}.zip`);
    toast(`${sharePhotoItems.length} photo${sharePhotoItems.length>1?'s':''} downloaded`, 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to generate ZIP: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    hidePdfProgress();
  }
}

initSharePage();
