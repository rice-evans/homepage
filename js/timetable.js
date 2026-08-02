// Timetable — a single chronological list of every dated item across the
// app: Reminders (due date), Calendar events (start date), and Study items
// (date), soonest at the top. Read-only aggregate view; clicking a row
// jumps to the page that actually manages that item. Deleted (soft-deleted)
// Notes/Study items never appear here since they've been trashed.
const Timetable = (() => {
  const ICONS = {
    reminder: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.5v4l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    event: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 8.5h14" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 3v3M13.5 3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    study: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 5.2C8.6 4 6.6 3.5 4.5 3.7v10.6c2.1-.2 4.1.3 5.5 1.5 1.4-1.2 3.4-1.7 5.5-1.5V3.7C13.4 3.5 11.4 4 10 5.2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  };
  const KIND_LABEL = { reminder: 'Reminder', event: 'Event', study: 'Study' };

  function loadJSON(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function collect() {
    const items = [];

    loadJSON('homepage_reminders').forEach(r => {
      if (!r.due) return;
      const hasTime = r.due.length > 10;
      items.push({
        kind: 'reminder',
        id: r.id,
        title: r.text,
        sortAt: hasTime ? r.due : `${r.due}T00:00:00`,
        dateKey: r.due.slice(0, 10),
        hasTime,
        timeValue: hasTime ? r.due.slice(11, 16) : null,
        done: !!r.done,
        gotoHash: 'home'
      });
    });

    loadJSON('homepage_calendar_events').forEach(e => {
      if (!e.start) return;
      items.push({
        kind: 'event',
        id: e.id,
        title: e.text,
        sortAt: `${e.start}T00:00:00`,
        dateKey: e.start,
        endKey: e.end,
        hasTime: false,
        timeValue: null,
        done: false,
        gotoHash: 'home'
      });
    });

    loadJSON('homepage_study').forEach(s => {
      if (!s.date || s.deleted) return;
      items.push({
        kind: 'study',
        id: s.id,
        title: s.title,
        sortAt: s.time ? `${s.date}T${s.time}:00` : `${s.date}T00:00:00`,
        dateKey: s.date,
        hasTime: !!s.time,
        timeValue: s.time || null,
        done: s.status === 'complete',
        statusLabel: { 'not-started': 'Not Started', 'in-progress': 'In Progress', 'complete': 'Complete' }[s.status],
        gotoHash: 'study'
      });
    });

    return items.sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  }

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatGroupHeader(dateKey) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateKey + 'T00:00:00');
    const diffDays = Math.round((d - today) / 86400000);

    const full = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (diffDays === 0) return `Today — ${full}`;
    if (diffDays === 1) return `Tomorrow — ${full}`;
    if (diffDays === -1) return `Yesterday — ${full}`;
    return full;
  }

  function buildRow(item) {
    const row = document.createElement('div');
    row.className = 'timetable-row' + (item.done ? ' done' : '');

    const icon = document.createElement('span');
    icon.className = `timetable-icon timetable-icon-${item.kind}`;
    icon.innerHTML = ICONS[item.kind];
    row.appendChild(icon);

    const main = document.createElement('div');
    main.className = 'timetable-main';

    const title = document.createElement('div');
    title.className = 'timetable-title';
    title.textContent = item.title;
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'timetable-meta';
    let metaText = KIND_LABEL[item.kind];
    if (item.kind === 'event' && item.endKey && item.endKey !== item.dateKey) {
      metaText += ` — Through ${new Date(item.endKey + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    if (item.statusLabel) metaText += ` — ${item.statusLabel}`;
    meta.textContent = metaText;
    main.appendChild(meta);

    row.appendChild(main);

    const time = document.createElement('div');
    time.className = 'timetable-time';
    time.textContent = item.hasTime ? formatTime(item.timeValue) : 'All Day';
    row.appendChild(time);

    row.addEventListener('click', () => { location.hash = item.gotoHash; });
    return row;
  }

  function render() {
    const container = document.getElementById('timetable-list');
    container.innerHTML = '';
    const items = collect();

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'modal-note';
      empty.style.textAlign = 'center';
      empty.textContent = 'Nothing With A Date Yet — Add A Reminder, Calendar Event, Or Study Item.';
      container.appendChild(empty);
      return;
    }

    let lastDateKey = null;
    items.forEach(item => {
      if (item.dateKey !== lastDateKey) {
        lastDateKey = item.dateKey;
        const header = document.createElement('div');
        header.className = 'timetable-group-header';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (item.dateKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`) {
          header.classList.add('is-today');
        }
        header.textContent = formatGroupHeader(item.dateKey);
        container.appendChild(header);
      }
      container.appendChild(buildRow(item));
    });
  }

  return { init: render, refresh: render };
})();
