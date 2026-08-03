// App entry point
document.addEventListener('DOMContentLoaded', async () => {
  const NAME_KEY = 'homepage_display_name';
  const prefix = document.getElementById('greeting-prefix');
  const nameEl = document.getElementById('display-name');
  const clock = document.getElementById('clock');

  function loadName() {
    return localStorage.getItem(NAME_KEY) || 'Friend';
  }

  function saveName(name) {
    localStorage.setItem(NAME_KEY, name);
    Sync.push();
  }

  function updateGreetingPrefix() {
    const hour = new Date().getHours();
    prefix.textContent = (hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening') + ',';
  }

  function updateClock() {
    updateGreetingPrefix();
    clock.textContent = new Date().toLocaleString([], {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function renderName() {
    nameEl.textContent = loadName();
  }

  function startEditName() {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-edit-input';
    input.value = loadName();
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      const val = input.value.trim() || 'Friend';
      saveName(val);
      input.replaceWith(nameEl);
      renderName();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); committed = true; input.replaceWith(nameEl); }
    });
  }

  nameEl.addEventListener('click', startEditName);
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); startEditName(); }
  });

  renderName();
  updateClock();
  setInterval(updateClock, 1000 * 30);

  // Belt-and-braces on top of the min/max="...-9999-12-31" attributes on
  // each date input: if a browser ever lets the year segment grow past 4
  // digits while typing, clear the (now invalid-looking) value rather than
  // letting a 5+ digit year linger.
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value && input.value.split('-')[0].length > 4) input.value = '';
    });
  });

  // Pull any previously synced state (Vercel KV) before the widgets render
  // from localStorage, so a second device sees the same dashboard.
  await Sync.pull();
  renderName();

  Links.init();
  Reminders.init();
  Study.init();
  Calendar.init();
  Notes.init();
  Chat.init();
  Roblox.init();
  Timetable.init();
  Weather.init();
  Settings.init();
  Sidebar.init();

  GlassSurface.applyToAll('.panel');
});
