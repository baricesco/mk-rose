/* ═══════════════════════════════════════════════════════════
   PWA WIRING  (service worker + install prompt + offline notice)

   Only index.html loads this. share.html is deliberately left as a
   plain page — a tenant opening their link should get the live view
   with no worker, no install prompt and nothing cached on their phone.
═══════════════════════════════════════════════════════════ */

let deferredInstallPrompt = null;
let swReloading = false;

/* ── the address-bar / status-bar colour follows the theme ── */
function syncThemeColorMeta() {
  const meta = document.getElementById('meta-theme-color');
  if (!meta) return;
  // Matches --bg for the active theme (css/style.css tokens).
  meta.setAttribute('content', getCurrentTheme() === 'dark' ? '#16171B' : '#F7F6F3');
}

/* ── install ──────────────────────────────────────────────── */
// Chrome fires this instead of showing its own prompt; stashing it lets
// the app offer a proper in-UI "Install" button and drop it again once
// the app is installed or the offer is declined.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = '';
});

async function installApp() {
  if (!deferredInstallPrompt) return;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
  prompt.prompt();
  try { await prompt.userChoice; } catch (e) {}
}

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
  toast('MK ROSE installed', 'success');
});

/* ── offline / online ─────────────────────────────────────── */
// Without this, losing connection just surfaces a raw "Database error"
// from loadAll() with no hint that the network is the cause.
window.addEventListener('offline', () => {
  toast('You are offline — saved pages and photos still work, new data will not load', '');
});
window.addEventListener('online', () => {
  toast('Back online', 'success');
  if (typeof refresh === 'function' && isLoggedIn()) refresh();
});

/* ── service worker ───────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  // Registered after load so the worker's precache fetches never compete
  // with the app's own first paint and initial Supabase query.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          // A controller already exists = this is an update, not the very
          // first install (where there is nothing to announce).
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            swReloading = true;
            incoming.postMessage('SKIP_WAITING');
            toast('Update installed — reload to use the new version', 'success');
          }
        });
      });
    }).catch(e => console.warn('service worker registration failed', e));
  });

  // Only reload for an update we actually announced; the first-ever
  // activation also fires this and must not bounce the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!swReloading) return;
    swReloading = false;
  });
}

syncThemeColorMeta();
