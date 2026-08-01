/* ═══════════════════════════════════════════════════════════
   ROUTER  (real per-page back/forward — URL never changes)

   The visible URL always stays exactly what it was on load (no hash,
   no path segments) — navigate() pushes a history entry whose STATE
   carries the route ({page, sub}), passing the unchanged URL to
   pushState. Back/Forward still walk a real per-page stack (Chrome's
   history API tracks state independently of the URL string), it just
   never shows up in the address bar.

   Since 'popstate' is the only signal here (there's no 'hashchange'
   equivalent when the URL never changes), it has to do double duty:
   tell a real "user went back/forward a page" apart from "user backed
   past the first page and is about to actually leave". We do that by
   comparing the popped state's route to the one currently on screen —
   different route = real navigation; identical route = they've hit
   the guard entry (see armExitGuard) and it's an exit attempt.
═══════════════════════════════════════════════════════════ */

const PAGES = ['dashboard','entities','bills','billprint','gallery','reports','audit','settings'];

const routeUrl = () => location.pathname + location.search;
const sameRoute = (a, b) => !!a && !!b && a.page === b.page && a.sub === b.sub;

let currentRouteState = null; // {page, sub} currently on screen

function parseRoute() {
  if (currentRouteState && PAGES.includes(currentRouteState.page)) return currentRouteState;
  return { page: 'dashboard', sub: null };
}

function navigate(page, sub) {
  const subStr = sub != null ? String(sub) : null;
  const next = { page, sub: subStr };
  if (sameRoute(currentRouteState, next)) { renderRoute(); return; }
  currentRouteState = next;
  history.pushState(next, '', routeUrl());
  renderRoute();
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

/* ── Exit confirmation (only once real history is exhausted) ────── */
let exitPromptAllowNextPop = false;

// Pushes a duplicate of whatever route is currently on screen, so a
// Back press lands on an entry indistinguishable from the one below —
// that's the signal (see 'popstate' below) that there's nothing real
// left to go back to.
function armExitGuard() {
  try { history.pushState(currentRouteState, '', routeUrl()); } catch (e) {}
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

window.addEventListener('popstate', (event) => {
  const state = (event.state && PAGES.includes(event.state.page)) ? event.state : { page: 'dashboard', sub: null };
  if (sameRoute(state, currentRouteState)) {
    if (exitPromptAllowNextPop) { exitPromptAllowNextPop = false; return; }
    openModal('modal-confirm-exit');
    return;
  }
  currentRouteState = state;
  renderRoute();
});

// Sets up the very first route + the exit-guard entry sitting under it.
// Does NOT render — init() decides when it's safe to render (after
// showApp(), so Chart.js never creates a chart in a zero-size container).
function initRouter() {
  currentRouteState = { page: 'dashboard', sub: null };
  history.replaceState(currentRouteState, '', routeUrl());
  armExitGuard();
}
