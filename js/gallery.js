/* ═══════════════════════════════════════════════════════════
   PHOTO GALLERY  (all meter/bill photos — view, single + bulk download)
═══════════════════════════════════════════════════════════ */

let galleryItems = [];       // every (entity, period) with a reading, in the current filter
let galleryPhotoItems = [];  // subset of the above that actually has a photo — what the lightbox steps through
let lightboxIndex = -1;
let galleryHasRun = false;   // becomes true once "Run" has been clicked for the current filters

function photoFilename(item) {
  const entName = sanitizeFilenamePart(item.ent.name) || 'Entity';
  const ownerName = sanitizeFilenamePart(item.ent.ownerName) || 'Unknown owner';
  const period = `${MONTHS_FULL[item.month-1]}_${item.year}`;
  const urlPath = (item.bill.imageUrl || '').split('?')[0];
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(urlPath);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  return `${entName}_${ownerName}_${period}.${ext}`;
}

// Filters (search/entity/month) never trigger the query themselves — changing
// them just invalidates the last run so stale results can't be downloaded.
function galleryFiltersChanged() {
  galleryHasRun = false;
  renderGalleryPage();
}

// Populates the filter dropdowns only — cheap, local, no photo fetching.
// The actual DB query + photo grid (which fetches every photo shown) only
// happens when the user clicks "Run", via runGalleryQuery() below.
function renderGalleryPage() {
  const entSel = document.getElementById('gal-entity');
  if (entSel) {
    const cur = entSel.value;
    entSel.innerHTML = '<option value="">All entities</option>' +
      DB.entities.map(e => `<option value="${e.id}"${cur===String(e.id)?' selected':''}>${esc(e.name)}</option>`).join('');
  }
  const monthSel = document.getElementById('gal-month');
  if (monthSel) {
    const cur = monthSel.value;
    const periods = getPeriods().slice().reverse();
    monthSel.innerHTML = '<option value="">All months</option>' +
      periods.map(p => `<option value="${p.m}-${p.y}"${cur===p.m+'-'+p.y?' selected':''}>${MONTHS_FULL[p.m-1]} ${p.y}</option>`).join('');
  }

  if (!galleryHasRun) {
    galleryItems = [];
    galleryPhotoItems = [];
    const dlBtn = document.getElementById('gal-download-all-btn');
    if (dlBtn) dlBtn.disabled = true;
    const grid = document.getElementById('gallery-grid');
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg><p>Set your filters and click "Run" to load photos</p></div>`;
  }
}

function runGalleryQuery() {
  galleryHasRun = true;

  const entSel = document.getElementById('gal-entity');
  const monthSel = document.getElementById('gal-month');
  const entF = entSel?.value || '';
  const monthF = monthSel?.value || '';
  const search = document.getElementById('gal-search')?.value.trim().toLowerCase() || '';

  let entities = DB.entities;
  if (entF) entities = entities.filter(e => String(e.id) === entF);
  if (search) entities = entities.filter(e => [e.name, e.ownerName].some(v => String(v||'').toLowerCase().includes(search)));
  let periods;
  if (monthF) { const [m,y] = monthF.split('-').map(Number); periods = [{ m, y }]; }
  else periods = getPeriods();

  // Only entity/period combos with an actual reading are shown — if there's
  // no bill at all that's not a "missing photo" case, just nothing to show.
  galleryItems = [];
  entities.forEach(ent => {
    periods.forEach(p => {
      const bill = getBillForMonth(ent.id, p.m, p.y);
      if (!bill) return;
      galleryItems.push({ ent, month: p.m, year: p.y, bill, hasPhoto: !!bill.imageUrl });
    });
  });
  galleryItems.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  galleryPhotoItems = galleryItems.filter(i => i.hasPhoto);

  const grid = document.getElementById('gallery-grid');
  const dlBtn = document.getElementById('gal-download-all-btn');
  if (dlBtn) dlBtn.disabled = !galleryPhotoItems.length;

  if (!galleryItems.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg><p>No readings match this filter</p></div>`;
    return;
  }

  grid.innerHTML = galleryItems.map(item => {
    const period = MONTHS[item.month-1] + ' ' + item.year;
    if (!item.hasPhoto) {
      return `
        <div class="photo-tile photo-tile-missing">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
          <small>${esc(item.ent.name)}<br>${period} — no photo</small>
          <button class="btn btn-ghost btn-xs" onclick="openEditBill(${item.bill.id})">Add photo</button>
        </div>
      `;
    }
    const photoIdx = galleryPhotoItems.indexOf(item);
    return `
      <div class="photo-tile" onclick="openLightbox(${photoIdx})">
        <img src="${esc(item.bill.imageUrl)}" alt="${esc(item.ent.name)} — ${period}" loading="lazy"/>
        <button class="photo-tile-dl" title="Download photo" aria-label="Download photo" onclick="event.stopPropagation();downloadSinglePhoto(${photoIdx},this)">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <div class="photo-tile-label">${esc(item.ent.name)}<br>${period}</div>
      </div>
    `;
  }).join('');
}

function renderLightboxContent() {
  const item = galleryPhotoItems[lightboxIndex];
  if (!item) return;
  document.getElementById('lightbox-img').src = item.bill.imageUrl;
  document.getElementById('lightbox-title').textContent = item.ent.name + (item.ent.ownerName ? ' — ' + item.ent.ownerName : '');
  document.getElementById('lightbox-sub').textContent = `${MONTHS_FULL[item.month-1]} ${item.year} · ${item.bill.paid ? 'Paid' : 'Unpaid'}`;
}

function openLightbox(idx) {
  lightboxIndex = idx;
  renderLightboxContent();
  openModal('modal-lightbox');
}

function lightboxStep(delta) {
  if (!galleryPhotoItems.length) return;
  lightboxIndex = (lightboxIndex + delta + galleryPhotoItems.length) % galleryPhotoItems.length;
  renderLightboxContent();
}

// Step through the gallery with arrow keys, close with Escape — only while
// the lightbox is actually open (mirrors the bill-image paste listener's
// "only act if the relevant modal is open" pattern).
document.addEventListener('keydown', (event) => {
  const modal = document.getElementById('modal-lightbox');
  if (!modal || !modal.classList.contains('open')) return;
  if (event.key === 'ArrowLeft') lightboxStep(-1);
  else if (event.key === 'ArrowRight') lightboxStep(1);
  else if (event.key === 'Escape') closeModal('modal-lightbox');
});

async function downloadSinglePhoto(idx, btnEl) {
  const item = galleryPhotoItems[idx];
  if (!item || !item.bill.imageUrl) return;
  if (btnEl) btnEl.disabled = true;
  try {
    const resp = await fetch(item.bill.imageUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('photo fetch failed (' + resp.status + ')');
    const blob = await resp.blob();
    triggerBlobDownload(blob, photoFilename(item));
  } catch (e) {
    console.error(e);
    toast('Failed to download photo: ' + e.message, 'error');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

function downloadCurrentLightboxPhoto(btnEl) {
  downloadSinglePhoto(lightboxIndex, btnEl);
}

function galleryZipName(monthF, entF) {
  const entName = entF ? sanitizeFilenamePart(DB.entities.find(e => String(e.id) === entF)?.name) : '';
  let monthName = '';
  if (monthF) { const [m, y] = monthF.split('-').map(Number); monthName = `${MONTHS_FULL[m-1]}_${y}`; }
  if (entName && monthName) return `Photos_${entName}_${monthName}.zip`;
  if (entName) return `Photos_${entName}.zip`;
  if (monthName) return `Photos_${monthName}.zip`;
  return `Photos_All.zip`;
}

// Bulk ZIP always reflects whatever's currently filtered/visible ("download
// what you see") — including an entity filter, not just the month selector.
async function downloadGalleryZip() {
  if (!galleryPhotoItems.length) { toast('No photos to download for this filter', 'error'); return; }

  const entF = document.getElementById('gal-entity')?.value || '';
  const monthF = document.getElementById('gal-month')?.value || '';

  const btn = document.getElementById('gal-download-all-btn');
  if (btn) btn.disabled = true;
  showPdfProgress(`Downloading ${galleryPhotoItems.length} photo${galleryPhotoItems.length>1?'s':''}`);
  try {
    const zip = new JSZip();
    const usedNames = new Map();
    for (let i = 0; i < galleryPhotoItems.length; i++) {
      const item = galleryPhotoItems[i];
      updatePdfProgress(`Fetching photo for ${item.ent.name}…`, i, galleryPhotoItems.length);
      const resp = await fetch(item.bill.imageUrl, { cache: 'no-store' });
      if (!resp.ok) { console.warn('photo fetch failed', item.bill.imageUrl); continue; }
      const blob = await resp.blob();
      let name = photoFilename(item);
      const count = usedNames.get(name) || 0;
      usedNames.set(name, count + 1);
      if (count > 0) name = name.replace(/(\.[a-zA-Z0-9]+)$/, ` (${count})$1`);
      zip.file(name, blob);
    }
    updatePdfProgress('Compressing ZIP…', galleryPhotoItems.length, galleryPhotoItems.length);
    const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
      updatePdfProgress(`Compressing ZIP… ${Math.round(meta.percent)}%`, galleryPhotoItems.length, galleryPhotoItems.length);
    });
    triggerBlobDownload(zipBlob, galleryZipName(monthF, entF));
    toast(`${galleryPhotoItems.length} photo${galleryPhotoItems.length>1?'s':''} downloaded`, 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to generate ZIP: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    hidePdfProgress();
  }
}

