/* ═══════════════════════════════════════════════════════════
   MARK PAID
═══════════════════════════════════════════════════════════ */

function confirmMarkPaid(entityId, month, year) {
  if (isPeriodLocked(month, year)) { toast(`${MONTHS_FULL[month-1]} ${year} is locked — unlock it in Settings to make changes`, 'error'); return; }
  const ent = DB.entities.find(e=>e.id===entityId);
  const info = getChainInfo(entityId, month, year);
  const allMonths = [...info.months.map(m=>MONTHS_FULL[m.month-1]+' '+m.year), MONTHS_FULL[month-1]+' '+year];

  let bodyHtml = `<div>Mark <strong>${esc(ent?.name)}</strong> paid for <strong>${MONTHS_FULL[month-1]} ${year}</strong>.</div>`;
  if (info.months.length) {
    bodyHtml += `<br><div style="background:var(--amber-bg);border-radius:var(--radius);padding:10px 12px;margin-top:8px;font-size:12px;color:var(--amber)"><strong>This also clears arrears:</strong> ${info.months.map(m=>MONTHS_FULL[m.month-1]+' '+m.year).join(', ')} — unpaid months are paid together.</div>`;
  }
  bodyHtml += `<br><div style="font-size:12px;color:var(--text2)">Total: <strong style="color:var(--text)">${rs(info.totalDue)}</strong></div>`;

  document.getElementById('confirm-pay-body').innerHTML = bodyHtml;
  document.getElementById('pay-mode').value = 'cash';
  document.getElementById('pay-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('pay-remarks').value = '';
  const input = document.getElementById('confirm-pay-input');
  input.value = '';
  document.getElementById('confirm-pay-btn').disabled = true;
  document.getElementById('confirm-pay-btn').onclick = async () => {
    if (input.value.trim().toLowerCase() !== 'paid') return;
    const payment = {
      mode: document.getElementById('pay-mode').value,
      paidAt: document.getElementById('pay-date').value,
      remarks: document.getElementById('pay-remarks').value.trim(),
    };
    setBtnLoading('confirm-pay-btn', true, 'Marking…');
    try {
      const ok = await markPaidUpTo(entityId, month, year, payment);
      if (!ok) return;   // error already toasted by markPaidUpTo
      logAudit('bills', entityId, 'update', `Marked "${ent?.name}" paid for ${allMonths.join(', ')} via ${paymentModeLabel(payment.mode)}${payment.remarks ? ' — '+payment.remarks : ''}`);
      closeModal('modal-confirm-pay');
      await loadAll();
      rerenderCurrent();
      toast(`${allMonths.join(', ')} marked paid`, 'success');
    } finally {
      setBtnLoading('confirm-pay-btn', false);
    }
  };
  openModal('modal-confirm-pay');
  setTimeout(() => input.focus(), 50);
}

function onConfirmPayInput() {
  const val = document.getElementById('confirm-pay-input').value.trim().toLowerCase();
  document.getElementById('confirm-pay-btn').disabled = val !== 'paid';
}

