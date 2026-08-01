/* ═══════════════════════════════════════════════════════════
   CUSTOM SELECT

   Mobile browsers (Android especially) render a native <select>'s open
   dropdown with their own OS chrome — no amount of CSS on the closed
   box fixes that, since the popup itself isn't stylable. This wraps
   every <select> with a styled trigger + a floating panel we build and
   skin ourselves, so the OPEN list looks the same everywhere.

   The real <select> stays in the DOM as the source of truth (just
   invisible/inert) — every existing onchange="", `.value` read/write,
   and dynamic option rebuild (`sel.innerHTML = '<option>...'`) used
   throughout the rest of the app keeps working completely untouched.
   This file doesn't require any changes anywhere else.
═══════════════════════════════════════════════════════════ */

let cselOpenPanel = null;
let cselOpenTrigger = null;

function cselClose() {
  if (!cselOpenPanel) return;
  cselOpenPanel.remove();
  cselOpenPanel = null;
  cselOpenTrigger = null;
}

function cselLabelFor(select) {
  const opt = select.options[select.selectedIndex];
  return opt ? opt.textContent : '';
}

function cselSyncTrigger(select, trigger) {
  trigger.textContent = cselLabelFor(select);
  trigger.classList.toggle('disabled', !!select.disabled);
}

function cselPositionPanel(panel, trigger) {
  const r = trigger.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  panel.style.minWidth = r.width + 'px';
  panel.style.left = r.left + 'px';
  panel.style.top = (r.bottom + 4) + 'px'; // sane default before measuring
  requestAnimationFrame(() => {
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    let left = r.left;
    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    panel.style.left = left + 'px';

    const spaceBelow = vh - r.bottom;
    if (spaceBelow < ph + 8 && r.top > ph + 8) panel.style.top = (r.top - ph - 4) + 'px';
    else panel.style.top = (r.bottom + 4) + 'px';
  });
}

function cselBuildPanel(select, trigger) {
  const panel = document.createElement('div');
  panel.className = 'csel-panel';
  [...select.options].forEach((opt, idx) => {
    const row = document.createElement('div');
    row.className = 'csel-option' + (idx === select.selectedIndex ? ' selected hl' : '');
    row.textContent = opt.textContent;
    if (opt.disabled) row.setAttribute('disabled', '');
    row.addEventListener('mouseenter', () => {
      panel.querySelectorAll('.csel-option.hl').forEach(o => o.classList.remove('hl'));
      row.classList.add('hl');
    });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opt.disabled) return;
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      cselClose();
      trigger.focus();
    });
    panel.appendChild(row);
  });
  document.body.appendChild(panel);
  panel.classList.add('open');
  cselPositionPanel(panel, trigger);
  panel.querySelector('.csel-option.selected')?.scrollIntoView({ block: 'nearest' });
  return panel;
}

function cselToggle(select, trigger) {
  if (cselOpenTrigger === trigger) { cselClose(); return; }
  cselClose();
  if (select.disabled) return;
  cselOpenPanel = cselBuildPanel(select, trigger);
  cselOpenTrigger = trigger;
}

function cselMoveHighlight(delta) {
  if (!cselOpenPanel) return;
  const opts = [...cselOpenPanel.querySelectorAll('.csel-option:not([disabled])')];
  if (!opts.length) return;
  const curIdx = opts.findIndex(o => o.classList.contains('hl'));
  const next = Math.max(0, Math.min(opts.length - 1, curIdx + delta));
  opts.forEach(o => o.classList.remove('hl'));
  opts[next].classList.add('hl');
  opts[next].scrollIntoView({ block: 'nearest' });
}

function cselEnhance(select) {
  if (select.dataset.cselEnhanced) return;
  select.dataset.cselEnhanced = '1';

  const wrap = document.createElement('div');
  wrap.className = 'csel';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const trigger = document.createElement('div');
  trigger.className = select.className + ' csel-trigger';
  trigger.tabIndex = 0;
  trigger.setAttribute('role', 'button');
  wrap.appendChild(trigger);

  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  cselSyncTrigger(select, trigger);

  trigger.addEventListener('click', () => cselToggle(select, trigger));
  trigger.addEventListener('keydown', (e) => {
    if (cselOpenTrigger === trigger) {
      if (e.key === 'Escape') { e.preventDefault(); cselClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cselMoveHighlight(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cselMoveHighlight(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cselOpenPanel.querySelector('.csel-option.hl')?.click(); }
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cselToggle(select, trigger);
    }
  });

  // Catches every dynamic `sel.innerHTML = '<option>...'` rebuild elsewhere
  // in the app (filters/month pickers repopulate exactly this way) so the
  // trigger label stays correct without touching those call sites.
  new MutationObserver(() => cselSyncTrigger(select, trigger)).observe(select, { childList: true, subtree: true });

  // Catches every direct `sel.value = x` assignment elsewhere in the app —
  // that's a plain IDL property set, not a DOM mutation, so the observer
  // above can't see it on its own.
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(select, 'value', {
    get() { return desc.get.call(select); },
    set(v) { desc.set.call(select, v); cselSyncTrigger(select, trigger); },
    configurable: true,
  });
}

function cselEnhanceAll(root = document) {
  root.querySelectorAll('select').forEach(cselEnhance);
}

document.addEventListener('click', (e) => {
  if (cselOpenPanel && !e.target.closest('.csel-panel') && !e.target.closest('.csel-trigger')) cselClose();
});
window.addEventListener('resize', cselClose);
window.addEventListener('scroll', (e) => {
  if (cselOpenPanel && !cselOpenPanel.contains(e.target)) cselClose();
}, true);

cselEnhanceAll();
