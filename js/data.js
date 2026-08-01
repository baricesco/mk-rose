/* ═══════════════════════════════════════════════════════════
   DATA LOADING
═══════════════════════════════════════════════════════════ */

async function loadAll() {
  if (!CONFIGURED) return false;
  const [ent, bil, rat, set, lck] = await Promise.all([
    sb.from('entities').select('*').is('deleted_at', null).order('id', { ascending: true }),
    sb.from('bills').select('*').is('deleted_at', null),
    sb.from('rates').select('*').is('deleted_at', null),
    sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('locked_periods').select('*'),
  ]);
  const err = ent.error || bil.error || rat.error || set.error || lck.error;
  if (err) { toast('Database error: ' + err.message, 'error'); console.error(err); return false; }

  DB.entities = (ent.data || []).map(mapEntity);
  DB.bills    = (bil.data || []).map(mapBill);
  DB.rates    = (rat.data || []).map(mapRate);
  DB.lockedPeriods = (lck.data || []).map(r => ({ month: r.month, year: r.year }));
  DB.settings = set.data ? {
    buildingName: set.data.building_name || '',
    address:      set.data.address || '',
    contact:      set.data.contact || '',
    logoUrl:      set.data.logo_url || '',
    currentRate:  num(set.data.current_rate),
  } : { ...DEFAULT_SETTINGS };
  return true;
}

function isPeriodLocked(month, year) {
  return DB.lockedPeriods.some(p => p.month === month && p.year === year);
}

// Reload from DB and re-render whatever page is showing.
async function refresh() {
  await loadAll();
  rerenderCurrent();
}
/* ═══════════════════════════════════════════════════════════
   BILLING LOGIC  (clean carry-forward model)

   • ownUnits   = curr − prev               (this month's consumption)
   • ownCharge  = ownUnits × rate            (this month's own charge)
   • arrears    = sum of ownCharge of the unbroken streak of UNPAID
                  months immediately before this one
   • totalDue   = ownCharge + arrears       (amount payable now)

   Carried amounts keep their ORIGINAL month's rate (no re-rating),
   so summing ownCharge across months never double-counts.
═══════════════════════════════════════════════════════════ */

function getEntityBills(entityId) {
  return DB.bills
    .filter(b => b.entityId === entityId)
    .sort((a,b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

function computeBillAmounts(entityId) {
  const bills = getEntityBills(entityId);
  const result = [];
  let arrears = 0;
  let arrearsMonths = [];

  for (const b of bills) {
    const ownUnits  = round2(Math.max(0, num(b.currReading) - num(b.prevReading)));
    const ownCharge = round2(ownUnits * num(b.rate));
    const totalDue  = round2(ownCharge + arrears);

    result.push({
      ...b,
      ownUnits,
      ownCharge,
      arrears,
      arrearsMonths: [...arrearsMonths],
      totalDue,
    });

    if (b.paid) { arrears = 0; arrearsMonths = []; }
    else { arrears = round2(arrears + ownCharge); arrearsMonths.push({ month:b.month, year:b.year, charge:ownCharge }); }
  }
  return result;
}

function getBillForMonth(entityId, month, year) {
  return computeBillAmounts(entityId).find(b => b.month === month && b.year === year) || null;
}

function getChainInfo(entityId, month, year) {
  const entry = computeBillAmounts(entityId).find(b => b.month === month && b.year === year);
  if (!entry) return { months: [], totalDue: 0 };
  return { months: entry.arrearsMonths, totalDue: entry.totalDue, thisCharge: entry.ownCharge };
}

// Paying month X pays X plus every consecutive unpaid month before it.
// payment = { mode, remarks, paidAt } — recorded on every bill in the chain
// since one payment settles all of them together.
async function markPaidUpTo(entityId, month, year, payment) {
  const bills = getEntityBills(entityId);
  const idx = bills.findIndex(b => b.month === month && b.year === year);
  if (idx < 0) return false;
  let start = idx;
  while (start > 0 && !bills[start-1].paid) start--;
  const ids = bills.slice(start, idx+1).map(b => b.id);
  const paidAt = payment?.paidAt ? new Date(payment.paidAt + 'T12:00:00').toISOString() : new Date().toISOString();
  const { error } = await sb.from('bills').update({
    paid: true,
    paid_at: paidAt,
    payment_mode: payment?.mode || null,
    payment_remarks: payment?.remarks || null,
  }).in('id', ids);
  if (error) { toast('Error: ' + error.message, 'error'); return false; }
  return true;
}

/* ═══════════════════════════════════════════════════════════
   PERIOD HELPERS  (everything derives from real data — no hardcoded months)
═══════════════════════════════════════════════════════════ */

// Sorted ascending list of distinct {m,y} present in bills (falls back to rates).
function getPeriods() {
  const set = new Set();
  DB.bills.forEach(b => set.add(b.month + '-' + b.year));
  DB.rates.forEach(r => set.add(r.month + '-' + r.year));
  const arr = [...set].map(k => { const [m,y] = k.split('-').map(Number); return { m, y }; });
  arr.sort((a,b) => a.y !== b.y ? a.y - b.y : a.m - b.m);
  return arr;
}

function getYears() {
  const ys = [...new Set([...DB.bills.map(b=>b.year), ...DB.rates.map(r=>r.year)])].sort((a,b)=>b-a);
  return ys.length ? ys : [new Date().getFullYear()];
}

/* ── row mappers: snake_case (db) ↔ camelCase (app) ────────── */
function mapEntity(r){ return { id:r.id, name:r.name, type:r.type, meter:r.meter||'', ownerName:r.owner_name||'', ownerPhone:r.owner_phone||'' }; }
function mapBill(r){ return { id:r.id, entityId:r.entity_id, month:r.month, year:r.year, prevReading:num(r.prev_reading), currReading:num(r.curr_reading), unitsUsed:num(r.units_used), rate:num(r.rate), paid:!!r.paid, imageUrl:r.bill_image_url||'', paidAt:r.paid_at||null, paymentMode:r.payment_mode||'', paymentRemarks:r.payment_remarks||'' }; }

const PAYMENT_MODE_LABELS = { cash:'Cash', askari:'Askari Bank', easypaisa:'Easypaisa', jazzcash:'JazzCash', other:'Other' };
function paymentModeLabel(mode) { return PAYMENT_MODE_LABELS[mode] || mode || ''; }
function formatPaidDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : ''; }
function mapRate(r){ return { id:r.id, month:r.month, year:r.year, rate:num(r.rate) }; }

