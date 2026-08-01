/* ═══════════════════════════════════════════════════════════
   PRINTABLE BILL  (replaces the old Excel/CSV export)
═══════════════════════════════════════════════════════════ */

function printBill(entityId, month, year) {
  const ent = DB.entities.find(e=>e.id===entityId);
  if (!ent) return;
  const computed = computeBillAmounts(entityId);
  if (!computed.length) { toast('No bills to print for this entity', 'error'); return; }

  const bill = (month && year)
    ? computed.find(b=>b.month===month && b.year===year)
    : computed[computed.length-1];   // latest bill
  if (!bill) { toast('Bill not found', 'error'); return; }

  const s = DB.settings;
  const period = MONTHS_FULL[bill.month-1] + ' ' + bill.year;
  const billNo = `${ent.id}-${bill.year}${String(bill.month).padStart(2,'0')}`;
  const today = new Date().toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' });
  const elec = bill.ownUnits * bill.rate;

  const arrearsRows = bill.arrearsMonths.map(m =>
    `<tr><td>Arrears — ${MONTHS_FULL[m.month-1]} ${m.year}</td><td class="r">${rs(m.charge)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Bill ${billNo} — ${esc(ent.name)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;color:#1a1917;background:#f3f3f0;padding:24px;font-size:13px}
    .sheet{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e0ded9;border-radius:10px;padding:32px 36px}
    .mk-heading{text-align:center;font-size:26px;font-weight:800;letter-spacing:.08em;color:#0369A1;margin-bottom:18px;text-transform:uppercase}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0EA5E9;padding-bottom:18px;margin-bottom:20px}
    .bld-name{font-size:22px;font-weight:700}
    .bld-meta{font-size:12px;color:#666;margin-top:4px;line-height:1.6}
    .title{font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0EA5E9;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px}
    .box{border:1px solid #e8e6e1;border-radius:8px;padding:14px 16px}
    .box h4{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px}
    .kv{display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0}
    .kv span:first-child{color:#666}
    .kv span:last-child{font-weight:600;text-align:right}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}
    th,td{text-align:left;padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5}
    th{background:#f6f5f2;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#888}
    td.r,th.r{text-align:right}
    .total{display:flex;justify-content:space-between;align-items:center;background:#E0F2FE;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin-top:14px}
    .total .lbl{font-size:13px;font-weight:600;color:#0369A1}
    .total .amt{font-size:26px;font-weight:800;color:#0369A1}
    .status{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700}
    .paid{background:#E0F2FE;color:#0369A1}
    .unpaid{background:#FDECEA;color:#991F2A}
    .foot{margin-top:26px;font-size:11px;color:#999;text-align:center;border-top:1px solid #eceae5;padding-top:14px;line-height:1.7}
    .actions{max-width:760px;margin:18px auto 0;text-align:center}
    .actions button{font:inherit;cursor:pointer;border:none;border-radius:8px;padding:10px 22px;font-weight:600;font-size:13px}
    .pbtn{background:#0EA5E9;color:#fff;margin-right:8px}
    .cbtn{background:#e8e6e1;color:#333}
    @media print{ body{background:#fff;padding:0} .sheet{border:none;border-radius:0;max-width:none} .actions{display:none} }
  </style></head><body>
    <div class="sheet">
      <div class="mk-heading">MK Rose</div>

      <div class="top">
        <div>
          <div class="bld-name">${esc(s.buildingName || 'Electricity Bill')}</div>
          <div class="bld-meta">${esc(s.address||'')}${s.contact?'<br>'+esc(s.contact):''}</div>
        </div>
      </div>

      <div class="title">Electricity Bill — ${esc(period)}</div>

      <div class="grid">
        <div class="box">
          <h4>Bill To</h4>
          <div class="kv"><span>Name of Tenant</span><span>${esc(ent.ownerName||'—')}</span></div>
          <div class="kv"><span>${ent.type==='shop'?'Shop:':'Flat:'}</span><span>${esc(ent.name)}</span></div>
          <div class="kv"><span>Meter No.</span><span>${esc(ent.meter||'—')}</span></div>
          ${ent.ownerPhone?`<div class="kv"><span>Phone</span><span>${esc(ent.ownerPhone)}</span></div>`:''}
        </div>
        <div class="box">
          <h4>Bill Details</h4>
          <div class="kv"><span>Bill No.</span><span>${billNo}</span></div>
          <div class="kv"><span>Billing month</span><span>${esc(period)}</span></div>
          <div class="kv"><span>Issue date</span><span>${today}</span></div>
          <div class="kv"><span>Status</span><span><span class="status ${bill.paid?'paid':'unpaid'}">${bill.paid?'PAID':'UNPAID'}</span></span></div>
          ${bill.paid && bill.paymentMode ? `<div class="kv"><span>Paid via</span><span>${esc(paymentModeLabel(bill.paymentMode))}${bill.paidAt?' on '+formatPaidDate(bill.paidAt):''}</span></div>` : ''}
          ${bill.paid && bill.paymentRemarks ? `<div class="kv"><span>Remarks</span><span>${esc(bill.paymentRemarks)}</span></div>` : ''}
        </div>
      </div>

      <table>
        <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
        <tbody>
          <tr><td>Previous reading</td><td class="r">${num(bill.prevReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
          <tr><td>Current reading</td><td class="r">${num(bill.currReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
          <tr><td>Units consumed</td><td class="r">${bill.ownUnits} units</td></tr>
          <tr><td>Electricity (${bill.ownUnits} × Rs ${bill.rate})</td><td class="r">${rs(elec)}</td></tr>
          <tr><td><strong>This month's charge</strong></td><td class="r"><strong>${rs(bill.ownCharge)}</strong></td></tr>
          ${arrearsRows}
        </tbody>
      </table>

      <div class="total">
        <div class="lbl">${bill.paid ? 'Amount paid' : 'Total payable'}</div>
        <div class="amt">${rs(bill.totalDue)}</div>
      </div>

      <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
        ${bill.imageUrl ? `<div style="flex:1;min-width:0">
          <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Meter / Bill Photo</h4>
          <img src="${esc(bill.imageUrl)}" alt="meter photo" style="max-width:100%;max-height:324px;border:1px solid #e8e6e1;border-radius:8px"/>
        </div>` : '<div></div>'}
        <div style="width:200px;flex-shrink:0;text-align:right;font-size:11px;line-height:1.5">
          <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Pay via</h4>
          <div style="margin-bottom:9px">
            <div style="font-weight:700;color:#0369A1;font-size:12px">Easypaisa</div>
            <div style="font-family:monospace;font-weight:700">0339-2547266</div>
            <div style="color:#666">ABDUL WALI</div>
          </div>
          <div style="margin-bottom:9px">
            <div style="font-weight:700;color:#0369A1;font-size:12px">JazzCash</div>
            <div style="font-family:monospace;font-weight:700">0339-2547266</div>
            <div style="color:#666">ABDUL WALI</div>
          </div>
          <div>
            <div style="font-weight:700;color:#0369A1;font-size:12px">Askari Bank</div>
            <div style="color:#666">ABDUL WALI</div>
            <div style="font-family:monospace">A/C 00263230029025</div>
            <div style="font-family:monospace;font-size:9.5px;word-break:break-all">IBAN PK87ASCM0000263230029025</div>
          </div>
        </div>
      </div>

      <div class="foot">
        ${s.contact?`For queries: ${esc(s.contact)}<br>`:''}
        ${bill.arrearsMonths.length?'Total payable includes unpaid arrears from previous month(s).':'Please pay before the due date to avoid arrears.'}
      </div>
    </div>
    <div class="actions">
      <button class="pbtn" onclick="window.print()">Print / Save PDF</button>
      <button class="cbtn" onclick="window.close()">Close</button>
    </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Please allow pop-ups to print the bill', 'error'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ═══════════════════════════════════════════════════════════
   BILL PRINT PAGE  (real PDF export — single + bulk ZIP)

   PDFs are rasterized from the same bill layout used by printBill(),
   rendered off-screen and captured with html2canvas → jsPDF. Meter/bill
   photos live in Supabase Storage, so each bill with a photo requires a
   real network fetch before it can be rasterized — the progress modal
   tracks that fetch + render per bill rather than faking a timer.
═══════════════════════════════════════════════════════════ */

function renderBillPrintPage() {
  const sel = document.getElementById('bp-month');
  if (sel) {
    const cur = sel.value;
    const periods = getPeriods().slice().reverse();
    sel.innerHTML = periods.map(p => `<option value="${p.m}-${p.y}"${cur===p.m+'-'+p.y?' selected':''}>${MONTHS_FULL[p.m-1]} ${p.y}</option>`).join('');
    if (!sel.value && periods.length) sel.value = periods[0].m + '-' + periods[0].y;
  }

  const [m, y] = (sel?.value || '').split('-').map(Number);
  const tbody = document.getElementById('bp-tbl-body');
  if (!tbody) return;

  const rows = [];
  DB.entities.forEach(ent => {
    const b = getBillForMonth(ent.id, m, y);
    if (b) rows.push({ ent, bill: b });
  });

  const btn = document.getElementById('bp-download-all-btn');
  if (btn) btn.disabled = !rows.length;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">No bills for this period</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(({ ent, bill }) => `
    <tr class="row-clickable" onclick="openEntityDetail(${ent.id})">
      <td><div style="font-weight:600">${esc(ent.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(ent.meter||'—')}</div></td>
      <td>${ent.ownerName ? esc(ent.ownerName) : '<span style="color:var(--text3)">—</span>'}</td>
      <td><span class="badge badge-gray">${ent.type}</span></td>
      <td class="tbl-num"><strong>${rs(bill.totalDue)}</strong></td>
      <td><span class="badge ${bill.paid?'badge-green':'badge-red'}">${bill.paid?'Paid':'Unpaid'}</span></td>
      <td>${bill.imageUrl ? '<span class="badge badge-blue">Photo</span>' : '<span style="color:var(--text3)">—</span>'}</td>
      <td>
        <button class="btn btn-primary btn-xs" onclick="event.stopPropagation();downloadBillPdf(${ent.id},${bill.month},${bill.year})">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF
        </button>
      </td>
    </tr>
  `).join('');
}

// Filenames must never contain path separators or reserved characters.
function sanitizeFilenamePart(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

function billPdfFilename(ent) {
  const entName = sanitizeFilenamePart(ent.name) || 'Entity';
  const ownerName = sanitizeFilenamePart(ent.ownerName) || 'Unknown owner';
  return `${entName}_${ownerName}.pdf`;
}

// Downloads a remote image and returns it as a data: URL — done up front
// so html2canvas never has to touch a cross-origin <img> (which would
// taint the canvas) and so the PDF stays fully self-contained.
async function fetchImageAsDataUrl(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('photo fetch failed (' + resp.status + ')');
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('photo read failed'));
    reader.readAsDataURL(blob);
  });
}

// Builds the off-screen bill sheet used for rasterization. Mirrors the
// markup in printBill() so the PDF and the printable browser view match.
async function buildBillSheetEl(ent, bill, onStatus) {
  const s = DB.settings;
  const period = MONTHS_FULL[bill.month-1] + ' ' + bill.year;
  const billNo = `${ent.id}-${bill.year}${String(bill.month).padStart(2,'0')}`;
  const today = new Date().toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' });
  const elec = bill.ownUnits * bill.rate;
  const arrearsRows = bill.arrearsMonths.map(mo =>
    `<tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5">Arrears — ${MONTHS_FULL[mo.month-1]} ${mo.year}</td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right">${rs(mo.charge)}</td></tr>`).join('');

  let photoTag = '<div></div>';
  if (bill.imageUrl) {
    onStatus?.(`Fetching meter photo for ${ent.name}…`);
    try {
      const dataUrl = await fetchImageAsDataUrl(bill.imageUrl);
      photoTag = `<div style="flex:1;min-width:0">
        <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Meter / Bill Photo</h4>
        <img src="${dataUrl}" style="max-width:100%;max-height:400px;border:1px solid #e8e6e1;border-radius:8px;display:block"/>
      </div>`;
    } catch (e) {
      console.warn('bill image fetch failed', e);
      toast(`Could not load photo for ${ent.name} — continuing without it`, 'error');
    }
  }
  const payTag = `<div style="width:200px;flex-shrink:0;text-align:right;font-size:11px;line-height:1.5">
    <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Pay via</h4>
    <div style="margin-bottom:9px">
      <div style="font-weight:700;color:#0369A1;font-size:12px">Easypaisa</div>
      <div style="font-family:monospace;font-weight:700">0339-2547266</div>
      <div style="color:#666">ABDUL WALI</div>
    </div>
    <div style="margin-bottom:9px">
      <div style="font-weight:700;color:#0369A1;font-size:12px">JazzCash</div>
      <div style="font-family:monospace;font-weight:700">0339-2547266</div>
      <div style="color:#666">ABDUL WALI</div>
    </div>
    <div>
      <div style="font-weight:700;color:#0369A1;font-size:12px">Askari Bank</div>
      <div style="color:#666">ABDUL WALI</div>
      <div style="font-family:monospace">A/C 00263230029025</div>
      <div style="font-family:monospace;font-size:9.5px;word-break:break-all">IBAN PK87ASCM0000263230029025</div>
    </div>
  </div>`;
  const imgTag = `<div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px">${photoTag}${payTag}</div>`;

  const kv = (lbl, val) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0"><span style="color:#666">${lbl}</span><span style="font-weight:600;text-align:right">${val}</span></div>`;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:760px;font-family:Arial,Helvetica,sans-serif;color:#1a1917;background:#fff';
  wrap.innerHTML = `
    <div style="padding:32px 36px">
      <div style="text-align:center;font-size:26px;font-weight:800;letter-spacing:.08em;color:#0369A1;margin-bottom:18px;text-transform:uppercase">MK Rose</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0EA5E9;padding-bottom:18px;margin-bottom:20px">
        <div>
          <div style="font-size:22px;font-weight:700">${esc(s.buildingName || 'Electricity Bill')}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;line-height:1.6">${esc(s.address||'')}${s.contact?'<br>'+esc(s.contact):''}</div>
        </div>
      </div>
      <div style="font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0EA5E9;margin-bottom:16px">Electricity Bill — ${esc(period)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px">
        <div style="border:1px solid #e8e6e1;border-radius:8px;padding:14px 16px">
          <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Bill To</h4>
          ${kv('Name of Tenant', esc(ent.ownerName||'—'))}
          ${kv(ent.type==='shop'?'Shop:':'Flat:', esc(ent.name))}
          ${kv('Meter No.', esc(ent.meter||'—'))}
          ${ent.ownerPhone ? kv('Phone', esc(ent.ownerPhone)) : ''}
        </div>
        <div style="border:1px solid #e8e6e1;border-radius:8px;padding:14px 16px">
          <h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px">Bill Details</h4>
          ${kv('Bill No.', billNo)}
          ${kv('Billing month', esc(period))}
          ${kv('Issue date', today)}
          ${kv('Status', `<span style="display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;${bill.paid?'background:#E0F2FE;color:#0369A1':'background:#FDECEA;color:#991F2A'}">${bill.paid?'PAID':'UNPAID'}</span>`)}
          ${bill.paid && bill.paymentMode ? kv('Paid via', esc(paymentModeLabel(bill.paymentMode)) + (bill.paidAt ? ' on '+formatPaidDate(bill.paidAt) : '')) : ''}
          ${bill.paid && bill.paymentRemarks ? kv('Remarks', esc(bill.paymentRemarks)) : ''}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
        <thead><tr>
          <th style="text-align:left;padding:9px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;background:#f6f5f2;border-bottom:1px solid #eceae5">Description</th>
          <th style="text-align:right;padding:9px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;background:#f6f5f2;border-bottom:1px solid #eceae5">Amount</th>
        </tr></thead>
        <tbody>
          <tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5">Previous reading</td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right">${num(bill.prevReading).toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>
          <tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5">Current reading</td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right">${num(bill.currReading).toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>
          <tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5">Units consumed</td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right">${bill.ownUnits} units</td></tr>
          <tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5">Electricity (${bill.ownUnits} × Rs ${bill.rate})</td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right">${rs(elec)}</td></tr>
          <tr><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5"><strong>This month's charge</strong></td><td style="padding:9px 12px;font-size:12.5px;border-bottom:1px solid #eceae5;text-align:right"><strong>${rs(bill.ownCharge)}</strong></td></tr>
          ${arrearsRows}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;background:#E0F2FE;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin-top:14px">
        <div style="font-size:13px;font-weight:600;color:#0369A1">${bill.paid ? 'Amount paid' : 'Total payable'}</div>
        <div style="font-size:26px;font-weight:800;color:#0369A1">${rs(bill.totalDue)}</div>
      </div>
      ${imgTag}
      <div style="margin-top:26px;font-size:11px;color:#999;text-align:center;border-top:1px solid #eceae5;padding-top:14px;line-height:1.7">
        ${s.contact?`For queries: ${esc(s.contact)}<br>`:''}
        ${bill.arrearsMonths.length?'Total payable includes unpaid arrears from previous month(s).':'Please pay before the due date to avoid arrears.'}
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const img = wrap.querySelector('img');
  if (img && !img.complete) await new Promise(res => { img.onload = res; img.onerror = res; });

  return wrap;
}

// Rasterizes one bill sheet into a single-page A4 PDF blob. Always exactly
// one page: if the sheet (e.g. bill + a tall meter photo) would run taller
// than the page, it's scaled down and centered to fit rather than spilling
// onto a second page.
async function renderBillToPdfBlob(ent, bill, onStatus) {
  const el = await buildBillSheetEl(ent, bill, onStatus);
  try {
    onStatus?.(`Rendering PDF for ${ent.name}…`);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    let imgW = maxW;
    let imgH = canvas.height * (imgW / canvas.width);
    if (imgH > maxH) {
      imgH = maxH;
      imgW = canvas.width * (imgH / canvas.height);
    }
    const x = margin + (maxW - imgW) / 2;
    const y = margin;

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, imgW, imgH);
    return pdf.output('blob');
  } finally {
    el.remove();
  }
}

function showPdfProgress(title) {
  document.getElementById('pdf-progress-title').textContent = title;
  document.getElementById('pdf-progress-status').textContent = 'Preparing…';
  document.getElementById('pdf-progress-bar').style.width = '0%';
  document.getElementById('pdf-progress-count').textContent = '';
  openModal('modal-pdf-progress');
}
function updatePdfProgress(status, done, total) {
  document.getElementById('pdf-progress-status').textContent = status;
  document.getElementById('pdf-progress-bar').style.width = (total ? Math.round(done/total*100) : 0) + '%';
  document.getElementById('pdf-progress-count').textContent = total ? `${done} / ${total}` : '';
}
function hidePdfProgress() { closeModal('modal-pdf-progress'); }

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadBillPdf(entityId, month, year) {
  const ent = DB.entities.find(e => e.id === entityId);
  if (!ent) return;
  const bill = getBillForMonth(entityId, month, year);
  if (!bill) { toast('Bill not found', 'error'); return; }

  showPdfProgress(`Generating bill — ${ent.name}`);
  updatePdfProgress('Preparing…', 0, 1);
  try {
    const blob = await renderBillToPdfBlob(ent, bill, s => updatePdfProgress(s, 0, 1));
    updatePdfProgress('Done', 1, 1);
    triggerBlobDownload(blob, billPdfFilename(ent));
    toast('Bill PDF downloaded', 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to generate PDF: ' + e.message, 'error');
  } finally {
    hidePdfProgress();
  }
}

async function downloadAllBillsZip() {
  const sel = document.getElementById('bp-month');
  const [m, y] = (sel?.value || '').split('-').map(Number);
  if (!m || !y) { toast('Select a month first', 'error'); return; }

  const rows = [];
  DB.entities.forEach(ent => {
    const b = getBillForMonth(ent.id, m, y);
    if (b) rows.push({ ent, bill: b });
  });
  if (!rows.length) { toast('No bills to export for this period', 'error'); return; }

  const btn = document.getElementById('bp-download-all-btn');
  if (btn) btn.disabled = true;
  showPdfProgress(`Generating ${rows.length} bill${rows.length>1?'s':''} — ${MONTHS_FULL[m-1]} ${y}`);
  try {
    const zip = new JSZip();
    const usedNames = new Map();
    for (let i = 0; i < rows.length; i++) {
      const { ent, bill } = rows[i];
      updatePdfProgress(`Preparing ${ent.name}…`, i, rows.length);
      const blob = await renderBillToPdfBlob(ent, bill, s => updatePdfProgress(s, i, rows.length));
      let name = billPdfFilename(ent);
      const count = usedNames.get(name) || 0;
      usedNames.set(name, count + 1);
      if (count > 0) name = name.replace(/\.pdf$/, ` (${count}).pdf`);
      zip.file(name, blob);
    }
    updatePdfProgress('Compressing ZIP…', rows.length, rows.length);
    const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
      updatePdfProgress(`Compressing ZIP… ${Math.round(meta.percent)}%`, rows.length, rows.length);
    });
    triggerBlobDownload(zipBlob, `Bills_${MONTHS_FULL[m-1]}_${y}.zip`);
    toast(`${rows.length} bill${rows.length>1?'s':''} downloaded`, 'success');
  } catch (e) {
    console.error(e);
    toast('Failed to generate ZIP: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    hidePdfProgress();
  }
}

