// Optional cross-device sync. localStorage is always the source of truth for
// instant reads/writes; this just mirrors it to /api/data (backed by Vercel
// KV) when that's configured, so the same dashboard shows up on any device.
// If /api/data isn't set up (no KV attached to the Vercel project), every
// call here just fails silently and the app behaves exactly as it did with
// localStorage alone — nothing breaks.
const Sync = (() => {
  const KEYS = ['homepage_links', 'homepage_reminders', 'homepage_calendar_events', 'homepage_display_name', 'homepage_notes', 'homepage_study'];
  let pushTimer = null;
  let available = true;

  function collect() {
    const state = {};
    KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) {
        try { state[k] = JSON.parse(v); } catch { /* skip malformed */ }
      }
    });
    return state;
  }

  function apply(state) {
    if (!state || typeof state !== 'object') return;
    Object.keys(state).forEach(k => {
      if (KEYS.includes(k)) localStorage.setItem(k, JSON.stringify(state[k]));
    });
  }

  async function pull() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) { available = res.status !== 404 && res.status !== 501; return false; }
      const data = await res.json();
      if (data) apply(data);
      return true;
    } catch {
      available = false;
      return false;
    }
  }

  function pushNow() {
    if (!available) return;
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect())
    }).catch(() => {});
  }

  function push() {
    if (!available) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 600);
  }

  return { pull, push };
})();
