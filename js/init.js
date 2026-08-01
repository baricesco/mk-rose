/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */

async function init() {
  updateThemeToggleIcon(getCurrentTheme());
  if (!CONFIGURED) {
    toast('Add your Supabase URL and anon key at the top of the script', 'error');
    showApp();
    initMonthSelector();
    renderRoute();
    return;
  }
  const ok = await loadAll();
  // If the user signed out while this fetch was in flight, don't let a
  // stale init() call reveal the app again over the login screen.
  if (!isLoggedIn()) return;
  // showApp() runs before the (synchronous) render calls, not after —
  // the browser doesn't paint mid-task, so this doesn't reintroduce an
  // empty-dashboard flash. It matters for Chart.js: creating charts
  // while their canvas is still display:none gives them a zero-size
  // container, so the resize-driven redraw once they become visible
  // replays their entrance animation live in front of the user (bars
  // growing, lines drawing left-to-right). Revealing the container
  // first means charts are sized correctly at creation time and only
  // animate once, before anything is painted.
  showApp();
  initMonthSelector();
  renderRoute();
  if (ok && !DB.entities.length) toast('Connected. Add your first entity to begin.', 'success');
}

initRouter();

if (isLoggedIn()) { showLoadingScreen(); init(); } else { showLoginScreen(); }

