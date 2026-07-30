// Calendar widget — month view with multi-day event bars.
// Events stored in localStorage as an array: [{ id, text, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }]
const Calendar = (() => {
  const STORAGE_KEY = 'homepage_calendar_events';
  let viewDate = new Date();
  let selectedKey = null;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    Sync.push();
  }

  // Real calendar events plus reminders that have a due date (shown
  // read-only — they're managed from the Reminders widget).
  function allEvents() {
    const reminderEvents = (typeof Reminders !== 'undefined' && Reminders.loadAsCalendarEvents)
      ? Reminders.loadAsCalendarEvents()
      : [];
    return load().concat(reminderEvents);
  }

  function keyFor(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function todayKey() {
    return keyFor(new Date());
  }

  // Build a full grid of weeks (each 7 real dates, including padding days
  // from adjacent months) for the currently viewed month.
  function buildWeeks(year, month) {
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, key: keyFor(d), inMonth: d.getMonth() === month });
    }
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  function eventsOverlappingDay(events, key) {
    return events.filter(ev => ev.start <= key && ev.end >= key);
  }

  // Greedy lane assignment so overlapping bars stack instead of collide.
  function assignLanes(segments) {
    segments.sort((a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart));
    const laneEnds = []; // last occupied column per lane
    segments.forEach(seg => {
      let lane = laneEnds.findIndex(end => end < seg.colStart);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(seg.colEnd);
      } else {
        laneEnds[lane] = seg.colEnd;
      }
      seg.lane = lane;
    });
    return laneEnds.length;
  }

  function renderGrid() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('cal-month-label');
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    label.textContent = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

    grid.innerHTML = '';

    const dow = document.createElement('div');
    dow.className = 'cal-dow-row';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      dow.appendChild(el);
    });
    grid.appendChild(dow);

    const weeks = buildWeeks(year, month);
    const events = allEvents();
    const today = todayKey();

    weeks.forEach(week => {
      const weekEl = document.createElement('div');
      weekEl.className = 'cal-week';

      const dayNums = document.createElement('div');
      dayNums.className = 'cal-week-daynums';
      week.forEach(cell => {
        const el = document.createElement('div');
        el.className = 'cal-daynum';
        if (!cell.inMonth) el.classList.add('out-of-month');
        if (cell.key === today) el.classList.add('today');
        el.textContent = cell.date.getDate();
        el.addEventListener('click', () => openDay(cell.key));
        dayNums.appendChild(el);
      });
      weekEl.appendChild(dayNums);

      // Build bar segments for events touching this week.
      const weekStart = week[0].key;
      const weekEnd = week[6].key;
      const segments = [];
      events.forEach(ev => {
        if (ev.end < weekStart || ev.start > weekEnd) return;
        const segStartKey = ev.start > weekStart ? ev.start : weekStart;
        const segEndKey = ev.end < weekEnd ? ev.end : weekEnd;
        const colStart = week.findIndex(c => c.key === segStartKey);
        const colEnd = week.findIndex(c => c.key === segEndKey);
        segments.push({
          event: ev,
          colStart,
          colEnd,
          contLeft: ev.start < segStartKey,
          contRight: ev.end > segEndKey
        });
      });
      const laneCount = assignLanes(segments);

      const barsEl = document.createElement('div');
      barsEl.className = 'cal-week-bars';
      if (laneCount > 0) {
        barsEl.style.gridTemplateRows = `repeat(${laneCount}, 20px)`;
        segments.forEach(seg => {
          const bar = document.createElement('div');
          bar.className = 'cal-bar';
          if (seg.contLeft) bar.classList.add('cont-left');
          if (seg.contRight) bar.classList.add('cont-right');
          if (seg.event.readOnly) bar.classList.add('cal-bar-reminder');
          if (seg.event.done) bar.classList.add('cal-bar-done');
          bar.style.gridColumn = `${seg.colStart + 1} / ${seg.colEnd + 2}`;
          bar.style.gridRow = `${seg.lane + 1}`;
          bar.textContent = seg.event.text;
          bar.title = seg.event.text;
          bar.addEventListener('click', e => {
            e.stopPropagation();
            openDay(seg.event.start);
          });
          barsEl.appendChild(bar);
        });
      }
      weekEl.appendChild(barsEl);

      grid.appendChild(weekEl);
    });
  }

  function openDay(key) {
    selectedKey = key;
    const panel = document.getElementById('calendar-day-panel');
    const title = document.getElementById('calendar-day-title');
    panel.hidden = false;
    title.textContent = new Date(key + 'T00:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('calendar-event-start').value = key;
    document.getElementById('calendar-event-end').value = key;
    renderEvents();
  }

  function renderEvents() {
    const list = document.getElementById('calendar-event-list');
    list.innerHTML = '';
    if (!selectedKey) return;
    const events = allEvents();
    const dayEvents = eventsOverlappingDay(events, selectedKey);

    if (dayEvents.length === 0) {
      const li = document.createElement('li');
      li.style.color = 'var(--text-dim)';
      li.style.fontSize = '13px';
      li.textContent = 'No Events.';
      list.appendChild(li);
      return;
    }

    dayEvents.forEach(ev => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = ev.start === ev.end
        ? ev.text
        : `${ev.text} (${formatShort(ev.start)} – ${formatShort(ev.end)})`;
      li.appendChild(span);

      if (ev.readOnly) {
        const tag = document.createElement('span');
        tag.textContent = 'Reminder';
        tag.style.fontSize = '11px';
        tag.style.color = 'var(--text-dim)';
        li.appendChild(tag);
      } else {
        const del = document.createElement('button');
        del.textContent = '✕';
        del.addEventListener('click', () => {
          save(load().filter(x => x.id !== ev.id));
          renderEvents();
          renderGrid();
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    });
  }

  function formatShort(key) {
    return new Date(key + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
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
      const textInput = document.getElementById('calendar-event-text');
      const startInput = document.getElementById('calendar-event-start');
      const endInput = document.getElementById('calendar-event-end');
      const text = textInput.value.trim();
      if (!text || !startInput.value) return;

      let start = startInput.value;
      let end = endInput.value || startInput.value;
      if (end < start) [start, end] = [end, start];

      const events = load();
      events.push({ id: crypto.randomUUID(), text, start, end });
      save(events);

      textInput.value = '';
      textInput.focus();
      renderEvents();
      renderGrid();
    });

    renderGrid();
  }

  return { init, refresh: renderGrid };
})();
