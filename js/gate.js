// Client-side password gate. This is deliberately NOT server-side (no
// Vercel Routing Middleware) — that approach broke /api/roblox and
// /api/chat entirely, twice, because getting the middleware file's module
// format right alongside the plain CommonJS /api functions kept going
// wrong. This trades some strength for reliability: the HTML/CSS/JS shell
// is technically fetchable by a determined visitor (view-source, or
// disabling JS) before entering the password, but the dashboard itself —
// and everything in it — stays hidden behind the overlay until the right
// password is entered, checked against SITE_PASSWORD via the small,
// isolated api/auth.js function.
//
// If SITE_PASSWORD isn't set at all, /api/auth reports `enabled: false`
// and the gate just never locks — same opt-in pattern as the rest of the
// app's optional integrations.
const Gate = (() => {
  const AUTH_KEY = 'homepage_authed';
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  function isLocallyAuthed() {
    try {
      const data = JSON.parse(localStorage.getItem(AUTH_KEY));
      return !!data && data.ok === true && (Date.now() - data.ts) < MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  function markAuthed() {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ ok: true, ts: Date.now() }));
  }

  function clearAuthed() {
    localStorage.removeItem(AUTH_KEY);
  }

  function lock() {
    document.documentElement.classList.add('gate-locked');
  }

  function unlock() {
    document.documentElement.classList.remove('gate-locked');
  }

  function showError(text) {
    const el = document.getElementById('gate-error');
    el.textContent = text;
    el.hidden = !text;
  }

  function logout() {
    clearAuthed();
    showError('');
    lock();
    const input = document.getElementById('gate-password');
    input.value = '';
    input.focus();
  }

  function init() {
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-password');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      showError('');
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: input.value })
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          markAuthed();
          unlock();
          input.value = '';
        } else {
          showError('Incorrect Password.');
          input.value = '';
          input.focus();
        }
      } catch {
        showError('Network Error — Could Not Reach The Server.');
      }
    });

    document.getElementById('gate-logout-btn').addEventListener('click', logout);

    // Confirm against the server: is a gate even configured, and — if this
    // browser already looks authed locally — is that still valid (e.g. in
    // case SITE_PASSWORD was removed since it last logged in)? The
    // inline script in <head> already unlocked optimistically to avoid a
    // flash for returning, already-authed visitors; this is the real check.
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (!data.enabled) { unlock(); return; }
        if (isLocallyAuthed()) unlock();
        else { lock(); input.focus(); }
      })
      .catch(() => {
        // Can't reach /api/auth — fail open rather than lock someone out
        // of their own dashboard over a network blip. Static hosting with
        // no gate configured already behaves exactly like this.
        unlock();
      });
  }

  return { init, logout };
})();

document.addEventListener('DOMContentLoaded', () => Gate.init());
