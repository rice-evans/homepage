// Calendar widget — stored in localStorage as { 'YYYY-MM-DD': ['event text', ...] }
const Calendar = (() => {
  const STORAGE_KEY = 'homepage_calendar';
  let viewDate = new Date();
  let selectedKey = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function keyFor(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function renderGrid() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('cal-month-label');
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    label.textContent = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

    grid.innerHTML = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const events = load();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      grid.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (isCurrentMonth && d === today.getDate()) cell.classList.add('today');
      cell.textContent = d;

      const key = keyFor(year, month, d);
      if (events[key] && events[key].length) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => openDay(key, d));
      grid.appendChild(cell);
    }
  }

  function openDay(key, dayNum) {
    selectedKey = key;
    const panel = document.getElementById('calendar-day-panel');
    const title = document.getElementById('calendar-day-title');
    panel.hidden = false;
    title.textContent = new Date(key + 'T00:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    renderEvents();
  }

  function renderEvents() {
    const list = document.getElementById('calendar-event-list');
    list.innerHTML = '';
    if (!selectedKey) return;
    const events = load();
    (events[selectedKey] || []).forEach((text, idx) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = text;
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', () => {
        const all = load();
        all[selectedKey].splice(idx, 1);
        if (all[selectedKey].length === 0) delete all[selectedKey];
        save(all);
        renderEvents();
        renderGrid();
      });
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  function init() {
    document.getElementById('cal-prev').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      renderGrid();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      renderGrid();
    });
    document.getElementById('calendar-day-close').addEventListener('click', () => {
      document.getElementById('calendar-day-panel').hidden = true;
      selectedKey = null;
    });
    document.getElementById('calendar-event-form').addEventListener('submit', e => {
      e.preventDefault();
      if (!selectedKey) return;
      const input = document.getElementById('calendar-event-text');
      const text = input.value.trim();
      if (!text) return;
      const all = load();
      if (!all[selectedKey]) all[selectedKey] = [];
      all[selectedKey].push(text);
      save(all);
      input.value = '';
      renderEvents();
      renderGrid();
    });
    renderGrid();
  }

  return { init };
})();
