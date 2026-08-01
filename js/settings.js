/* ═══════════════════════════════════════════════════════════
   MONTH LOCK  (freeze a period — type LOCK/UNLOCK to confirm)
═══════════════════════════════════════════════════════════ */

function renderMonthLockList() {
  const list = document.getElementById('month-lock-list');
  if (!list) return;
  const periods = getPeriods().slice().reverse(); // newest first

  if (!periods.length) {
    list.innerHTML = '<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:12.5px">No billing periods yet.</div>';
    return;
  }

  list.innerHTML = periods.map(p => {
    const locked = isPeriodLocked(p.m, p.y);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:600;font-size:13px">${MONTHS_FULL[p.m-1]} ${p.y}</span>
          <span class="badge ${locked ? 'badge-red' : 'badge-green'}">${locked ? 'Locked' : 'Open'}</span>
        </div>
        ${locked
          ? `<button class="btn btn-ghost btn-sm" onclick="requestLockPeriod(${p.m}, ${p.y}, false)"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0"/></svg>Unlock</button>`
          : `<button class="btn btn-danger btn-sm" onclick="requestLockPeriod(${p.m}, ${p.y}, true)"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Lock</button>`}
      </div>
    `;
  }).join('');
}

let lockConfirmWord = 'lock';

function requestLockPeriod(month, year, lock) {
  lockConfirmWord = lock ? 'lock' : 'unlock';
  document.getElementById('confirm-lock-title').textContent = lock ? 'Lock period' : 'Unlock period';
  document.getElementById('confirm-lock-body').innerHTML = lock
    ? `Lock <strong>${MONTHS_FULL[month-1]} ${year}</strong>? No bill can be added, edited, deleted, restored or marked paid for this period until it's unlocked.`
    : `Unlock <strong>${MONTHS_FULL[month-1]} ${year}</strong>? Changes will be allowed again for this period.`;
  document.getElementById('confirm-lock-label').textContent = `Type ${lockConfirmWord.toUpperCase()} to confirm`;
  const input = document.getElementById('confirm-lock-input');
  input.value = '';
  input.placeholder = `Type ${lockConfirmWord.toUpperCase()} to confirm`;
  const btn = document.getElementById('confirm-lock-btn');
  btn.textContent = lock ? 'Lock' : 'Unlock';
  btn.disabled = true;
  btn.onclick = async () => {
    if (input.value.trim().toLowerCase() !== lockConfirmWord) return;
    setBtnLoading('confirm-lock-btn', true, lock ? 'Locking…' : 'Unlocking…');
    try {
      if (lock) {
        const { error } = await sb.from('locked_periods').upsert({ month, year });
        if (error) { toast('Error: '+error.message, 'error'); return; }
        logAudit('locked_periods', null, 'update', `Locked ${MONTHS_FULL[month-1]} ${year}`);
      } else {
        const { error } = await sb.from('locked_periods').delete().eq('month', month).eq('year', year);
        if (error) { toast('Error: '+error.message, 'error'); return; }
        logAudit('locked_periods', null, 'update', `Unlocked ${MONTHS_FULL[month-1]} ${year}`);
      }
      closeModal('modal-confirm-lock');
      await loadAll();
      renderMonthLockList();
      toast(lock ? 'Period locked' : 'Period unlocked', 'success');
    } finally {
      setBtnLoading('confirm-lock-btn', false);
    }
  };
  openModal('modal-confirm-lock');
  setTimeout(() => input.focus(), 50);
}

function onConfirmLockInput() {
  const val = document.getElementById('confirm-lock-input').value.trim().toLowerCase();
  document.getElementById('confirm-lock-btn').disabled = val !== lockConfirmWord;
}

