/* ═══════════════════════════════════════════════════════════
   ⚙️  SUPABASE CONFIG  — paste your project values here
   (Project Settings → API → Project URL + anon/public key)
═══════════════════════════════════════════════════════════ */
const SUPABASE_URL      = 'https://hfbtufdkbrozrknndrtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2UHSLhfxhm71zblSE2Kpzg_ezIiOr_i';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CONFIGURED = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

/* ═══════════════════════════════════════════════════════════
   CONSTANTS + IN-MEMORY MIRROR OF THE DATABASE
   (Supabase is the source of truth; we hydrate this on load
    and after every mutation, then render synchronously.)
═══════════════════════════════════════════════════════════ */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DEFAULT_SETTINGS = { buildingName:'', address:'', contact:'', logoUrl:'', currentRate:0 };

// Records one line in the audit log. Fire-and-forget: a logging failure
// must never block or roll back the actual data change it's describing.
async function logAudit(tableName, recordId, action, summary) {
  try {
    await sb.from('audit_log').insert({ table_name: tableName, record_id: recordId, action, summary });
  } catch (e) { console.warn('audit log failed', e); }
}

let DB = { entities: [], bills: [], rates: [], lockedPeriods: [], settings: { ...DEFAULT_SETTINGS } };

const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const round2 = v => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const rs  = v => 'Rs ' + num(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Disables a button and swaps its label while an async save is in flight,
// so a slow connection can't be double-clicked into a duplicate row.
function setBtnLoading(id, loading, loadingText) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (loading) {
    if (btn.dataset.origText === undefined) btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = loadingText;
  } else {
    btn.disabled = false;
    if (btn.dataset.origText !== undefined) { btn.innerHTML = btn.dataset.origText; delete btn.dataset.origText; }
  }
}

