// Reminders widget — stored in localStorage.
// `due` is either null, a plain 'YYYY-MM-DD' date, or a full 'YYYY-MM-DDTHH:MM'
// datetime — time is always optional. Reminders with a due date also show up
// on the Calendar (see loadAsCalendarEvents, consumed by js/calendar.js).
// Completed reminders move below a divider and are auto-removed 5 days
// after completion.
const Reminders = (() => {
  const STORAGE_KEY = 'homepage_reminders';
  const COMPLETED_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;

  function load() {
    let items;
    try {
      items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      items = [];
    }

    // Self-healing purge: drop anything completed more than 5 days ago.
    const now = Date.now();
    const kept = items.filter(r => !(r.done && r.completedAt && (now - r.completedAt > COMPLETED_RETENTION_MS)));
    if (kept.length !== items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
      Sync.push();
    }
    return kept;
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    Sync.push();
  }

  function refreshCalendar() {
    if (typeof Calendar !== 'undefined' && Calendar.refresh) Calendar.refresh();
  }

  function dueToDate(due) {
    if (!due) return null;
    // Date-only values are treated as due by end-of-day.
    return due.length === 10 ? new Date(due + 'T23:59:59') : new Date(due);
  }

  function formatDue(due) {
    const hasTime = due.length > 10;
    const d = new Date(hasTime ? due : due + 'T00:00:00');
    return hasTime
      ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Exposed for the Calendar widget — reminders with a due date appear
  // there as read-only entries (deleting/completing them happens here).
  function loadAsCalendarEvents() {
    return load()
      .filter(r => r.due)
      .map(r => {
        const dateKey = r.due.slice(0, 10);
        return {
          id: `reminder-${r.id}`,
          text: `⏰ ${r.text}`,
          start: dateKey,
          end: dateKey,
          readOnly: true,
          done: !!r.done,
          kind: 'reminder'
        };
      });
  }

  // Small confetti burst, no libraries — a handful of colored pieces that
  // fly out from (x, y) and fade, then clean themselves up.
  function burstConfetti(x, y) {
    const colors = ['#7fa8ff', '#3ecf8e', '#ff5c5c', '#ffd166', '#f4a6ff'];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${x}px`;
      piece.style.top = `${y}px`;
      piece.style.background = colors[i % colors.length];

      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 30;
      const rot = `${Math.random() * 720 - 360}deg`;

      piece.style.setProperty('--dx', `${dx}px`);
      piece.style.setProperty('--dy', `${dy}px`);
      piece.style.setProperty('--rot', rot);

      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
      // Safety net in case animationend doesn't fire (e.g. reduced-motion).
      setTimeout(() => piece.remove(), 1200);
    }
  }

  function buildReminderItem(item, now) {
    const li = document.createElement('li');
    li.className = 'reminder-item';
    if (item.done) li.classList.add('done');
    if (!item.done && item.due && dueToDate(item.due) < now) li.classList.add('overdue');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!item.done;
    checkbox.addEventListener('change', () => {
      const all = load();
      const target = all.find(x => x.id === item.id);
      if (target) {
        target.done = checkbox.checked;
        target.completedAt = checkbox.checked ? Date.now() : null;
      }
      save(all);
      if (checkbox.checked) {
        const rect = checkbox.getBoundingClientRect();
        burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      render();
      refreshCalendar();
    });

    const text = document.createElement('span');
    text.className = 'reminder-text';
    text.textContent = item.text;

    li.appendChild(checkbox);
    li.appendChild(text);

    if (item.due) {
      const due = document.createElement('span');
      due.className = 'reminder-due';
      due.textContent = formatDue(item.due);
      li.appendChild(due);
    }

    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', () => {
      save(load().filter(x => x.id !== item.id));
      render();
      refreshCalendar();
    });
    li.appendChild(del);

    return li;
  }

  function render() {
    const container = document.getElementById('reminder-list');
    container.innerHTML = '';
    const now = new Date();
    const all = load();

    const active = all.filter(r => !r.done).sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return dueToDate(a.due) - dueToDate(b.due);
    });
    const completed = all.filter(r => r.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    const activeList = document.createElement('ul');
    activeList.className = 'reminder-sublist';
    active.forEach(item => activeList.appendChild(buildReminderItem(item, now)));
    container.appendChild(activeList);

    if (completed.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'reminder-divider';
      container.appendChild(divider);

      const completedList = document.createElement('ul');
      completedList.className = 'reminder-sublist';
      completed.forEach(item => completedList.appendChild(buildReminderItem(item, now)));
      container.appendChild(completedList);
    }
  }

  function init() {
    const form = document.getElementById('reminder-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const textInput = document.getElementById('reminder-text');
      const dateInput = document.getElementById('reminder-due-date');
      const timeInput = document.getElementById('reminder-due-time');
      if (!textInput.value.trim()) return;

      let due = null;
      if (dateInput.value) {
        due = timeInput.value ? `${dateInput.value}T${timeInput.value}` : dateInput.value;
      }

      const items = load();
      items.push({
        id: crypto.randomUUID(),
        text: textInput.value.trim(),
        due,
        done: false,
        completedAt: null
      });
      save(items);
      textInput.value = '';
      dateInput.value = '';
      timeInput.value = '';
      textInput.focus();
      render();
      refreshCalendar();
    });
    render();
  }

  return { init, loadAsCalendarEvents };
})();
