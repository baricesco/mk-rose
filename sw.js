/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER

   Makes the app installable and usable offline, WITHOUT ever letting
   stale billing data reach the screen. The rule that matters:

     • Supabase REST / RPC / auth / storage writes → never cached.
       Bills, payments, readings and the login check always go to the
       network. Offline, they simply fail, exactly as they do today.
     • Everything else (shell, styles, scripts, CDN libs, fonts, and
       the public meter photos) → cached, so the app opens instantly
       and past meter photos stay viewable with no connection.

   Bump VERSION on any change to the shell file list below; the old
   caches are dropped on activate.
═══════════════════════════════════════════════════════════ */

const VERSION = 'v3';
const SHELL_CACHE = 'mkrose-shell-' + VERSION;
const ASSET_CACHE = 'mkrose-assets-' + VERSION;
// Photos are immutable once uploaded and expensive to refetch, so their
// cache deliberately survives version bumps instead of being rebuilt.
const PHOTO_CACHE = 'mkrose-photos';
const PHOTO_LIMIT = 400;

const SHELL = [
  './',
  './index.html',
  './share.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './js/config.js',
  './js/auth.js',
  './js/data.js',
  './js/theme.js',
  './js/router.js',
  './js/monthSelector.js',
  './js/dashboard.js',
  './js/entities.js',
  './js/bills.js',
  './js/payments.js',
  './js/settings.js',
  './js/reports.js',
  './js/audit.js',
  './js/entityModal.js',
  './js/billModal.js',
  './js/markPaid.js',
  './js/print.js',
  './js/gallery.js',
  './js/ui.js',
  './js/customSelect.js',
  './js/share.js',
  './js/init.js',
  './js/pwa.js',
];

// Version-pinned third-party URLs — safe to cache forever.
const VENDOR = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

const CDN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

const isSupabase = url => url.hostname.endsWith('.supabase.co');
// The only Supabase path that may be cached: publicly-readable stored files
// (the meter/bill photos). Everything under /rest, /rpc, /auth — and signed
// or write paths under /storage — must always hit the network.
const isPublicPhoto = url => isSupabase(url) && url.pathname.startsWith('/storage/v1/object/public/');

/* ── install: precache the shell ──────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // Added one-by-one rather than addAll(): a single CDN hiccup would
    // otherwise reject the whole batch and leave the app uninstalled.
    await Promise.allSettled(SHELL.map(u => shell.add(new Request(u, { cache: 'reload' }))));
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled(VENDOR.map(u => assets.add(new Request(u, { mode: 'cors' }))));
  })());
});

/* ── activate: drop superseded caches, take over open tabs ── */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, PHOTO_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('mkrose-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ── strategies ───────────────────────────────────────────── */

// Documents: network first so a fresh deploy is picked up the moment
// you're online, with the precached copy as the offline fallback.
async function networkFirstDoc(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

// Same-origin CSS/JS: network first, cache only as the offline fallback —
// deliberately NOT stale-while-revalidate. index.html is network-first, so
// serving scripts from cache would pair a fresh page with the previous
// deploy's JS on the same load: the new markup is there but the functions
// its onclick attributes call are not, and the buttons silently do nothing.
// These filenames carry no content hash, so there is nothing to make the
// two agree except fetching both from the same place.
async function networkFirstAsset(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return (await cache.match(request)) || Response.error();
  }
}

// Version-pinned vendor URLs: never change, so the cache always wins.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

// Meter photos: uploaded once under a timestamped path and never rewritten,
// so cache-first is safe. Capped by insertion order so the cache can't grow
// without bound on a phone.
async function photoCacheFirst(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    if (keys.length > PHOTO_LIMIT) {
      await Promise.all(keys.slice(0, keys.length - PHOTO_LIMIT).map(k => cache.delete(k)));
    }
  }
  return res;
}

/* ── router ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;              // never intercept writes

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Live data, always: bills, payments, readings, login, storage uploads.
  if (isSupabase(url) && !isPublicPhoto(url)) return;

  if (isPublicPhoto(url)) { event.respondWith(photoCacheFirst(request)); return; }

  if (request.mode === 'navigate') { event.respondWith(networkFirstDoc(request)); return; }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstAsset(request, ASSET_CACHE));
    return;
  }

  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
