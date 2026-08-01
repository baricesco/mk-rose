/* ═══════════════════════════════════════════════════════════
   ROUTER  (hash-based — real per-page back/forward)

   Each page (and entity drill-down) gets its own URL hash, e.g.
   #/dashboard, #/entities, #/entities/42, #/bills. navigate() only
   ever changes location.hash; the 'hashchange' listener below is the
   single place that actually swaps the visible page and calls the
   right render function, so a nav-button click and a browser Back/
   Forward press go through the exact same code path.

   A separate, smaller mechanism rides on top of this for the exit
   confirmation: a dummy history entry sits directly under the very
   first route. Real in-app navigation always changes the hash, which
   'hashchange' already handles; backing further, past the first page,
   lands on that dummy entry instead — same hash, so 'hashchange'
   stays silent, but 'popstate' still fires, which is how we detect
   "the user is about to actually leave" and ask for confirmation.
═══════════════════════════════════════════════════════════ */

const PAGES = ['dashboard','entities','bills','billprint','gallery','reports','audit','settings'];

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, sub] = hash.split('/');
  return { page: PAGES.includes(page) ? page : 'dashboard', sub: sub || null };
}

function navigate(page, sub) {
  const hash = '#/' + page + (sub != null ? '/' + sub : '');
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

function renderRoute() {
  const { page, sub } = parseRoute();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add('active');

  if (page === 'dashboard') renderDashboard();
  else if (page === 'entities') { if (sub) showEntityDetail(Number(sub)); else showEntityList(); }
  else if (page === 'bills') renderBillsPage();
  else if (page === 'billprint') renderBillPrintPage();
  else if (page === 'gallery') renderGalleryPage();
  else if (page === 'reports') renderReports();
  else if (page === 'audit') { loadAudit(); loadTrash(); }
  else if (page === 'settings') renderMonthLockList();
}

// Re-renders whatever the current route says — used after saves/deletes
// instead of re-deriving the page from a separately-tracked flag.
function rerenderCurrent() { renderRoute(); }

function openEntityDetail(entityId) { navigate('entities', entityId); }

window.addEventListener('hashchange', renderRoute);

/* ── Exit confirmation (only once real history is exhausted) ────── */
let exitPromptAllowNextPop = false;
let lastRouterHash = location.hash;

function armExitGuard() {
  try { history.pushState({ mkroseExitGuard: true }, '', location.href); } catch (e) {}
}

function cancelExitPrompt() {
  closeModal('modal-confirm-exit');
  armExitGuard();
}

function confirmExitPrompt() {
  closeModal('modal-confirm-exit');
  exitPromptAllowNextPop = true;
  history.back();
}

window.addEventListener('popstate', () => {
  if (location.hash !== lastRouterHash) { lastRouterHash = location.hash; return; }
  if (exitPromptAllowNextPop) { exitPromptAllowNextPop = false; return; }
  openModal('modal-confirm-exit');
});

// Sets up the very first route + the exit-guard entry sitting under it.
// Does NOT render — init() decides when it's safe to render (after
// showApp(), so Chart.js never creates a chart in a zero-size container).
function initRouter() {
  if (!location.hash) history.replaceState(null, '', '#/dashboard');
  lastRouterHash = location.hash;
  armExitGuard();
}
