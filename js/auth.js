/* ═══════════════════════════════════════════════════════════
   LOGIN GATE  (simple table-based check, not Supabase Auth)

   verify_login() is a Postgres RPC (see migration/login-migration.sql)
   that compares a hashed password server-side and only ever returns
   true/false — the accounts table itself has no anon/authenticated
   RLS policies, so its contents (including password hashes) are never
   reachable from the browser.

   This gates the UI only. The app's data tables already use permissive
   anon policies (see the other migrations), so this is not a substitute
   for real access control — just a front door for casual/internal use.
═══════════════════════════════════════════════════════════ */

const AUTH_KEY = 'mkrose_auth_user';

function isLoggedIn() {
  try { return !!localStorage.getItem(AUTH_KEY); } catch (e) { return false; }
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  setTimeout(() => document.getElementById('login-username')?.focus(), 50);
}

// Shown between a successful login (or an already-remembered session on
// reload) and the app actually appearing, so the user never sees an
// empty dashboard flash before Supabase data has loaded.
function showLoadingScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// Called once init() has finished loading + rendering — the real "reveal".
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function loginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function attemptLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  loginError('');
  if (!username || !password) { loginError('Enter both username and password'); return; }
  if (!CONFIGURED) { loginError('Database not configured'); return; }

  setBtnLoading('login-btn', true, 'Signing in…');
  try {
    const { data, error } = await sb.rpc('verify_login', { p_username: username, p_password: password });
    if (error) { loginError('Login failed: ' + error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) { loginError('Invalid username or password'); return; }
    try { localStorage.setItem(AUTH_KEY, username); } catch (e) {}
    document.getElementById('login-password').value = '';
    showLoadingScreen();
    init();
  } finally {
    setBtnLoading('login-btn', false);
  }
}

function logout() {
  try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
  showLoginScreen();
}

