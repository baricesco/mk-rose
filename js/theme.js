/* ═══════════════════════════════════════════════════════════
   THEME (dark / light)
   The initial value is set synchronously by an inline <script> in
   <head> (before first paint) to avoid a flash of the wrong theme.
   This block just wires up the toggle button and keeps charts,
   which read colors as plain JS strings rather than CSS vars, in sync.
═══════════════════════════════════════════════════════════ */

function getCurrentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }

function updateThemeToggleIcon(theme) {
  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (!sun || !moon) return;
  // Icon shown = the mode a click switches TO.
  sun.style.display = theme === 'dark' ? '' : 'none';
  moon.style.display = theme === 'dark' ? 'none' : '';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggleIcon(theme);
  document.getElementById('pink-theme-toggle-btn')?.classList.toggle('active', theme === 'pink');
  // Chart.js bakes colors in at creation time, so re-render whichever
  // page currently has charts on screen to pick up the new palette.
  const _p = parseRoute().page;
  if (_p === 'dashboard') renderDashCharts();
  else if (_p === 'reports') renderReports();
}

function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', next); } catch (e) {}
  applyTheme(next);
}

function togglePinkTheme() {
  const next = getCurrentTheme() === 'pink' ? 'light' : 'pink';
  try { localStorage.setItem('theme', next); } catch (e) {}
  applyTheme(next);
}

// Chart.js reads colors as plain strings at chart-creation time, not CSS
// vars, so it needs its own theme-aware palette kept in step with the CSS.
function chartPalette() {
  const dark = getCurrentTheme() === 'dark';
  return {
    collected:   dark ? '#38BDF8' : '#0EA5E9',
    outstanding: dark ? '#F87171' : '#F09595',
    paid:        dark ? '#38BDF8' : '#0EA5E9',
    unpaid:      dark ? '#F87171' : '#E24B4A',
    flat:        dark ? '#38BDF8' : '#0EA5E9',
    shop:        dark ? '#A78BFA' : '#7C3AED',
    trendLine:   dark ? '#38BDF8' : '#0EA5E9',
    trendFill:   dark ? 'rgba(56,189,248,.16)' : 'rgba(14,165,233,.1)',
    payRateLine: dark ? '#60A5FA' : '#2563EB',
    payRateFill: dark ? 'rgba(96,165,250,.16)' : 'rgba(37,99,235,.1)',
    grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    tick: dark ? '#9298A5' : '#888',
  };
}

