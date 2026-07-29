// Reminders widget — stored in localStorage.
// `due` is either null, a plain 'YYYY-MM-DD' date, or a full 'YYYY-MM-DDTHH:MM'
// datetime — time is always optional.
const Reminders = (() => {
  const STORAGE_KEY = 'homepage_reminders';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

  function render() {
    const list = document.getElementById('reminder-list');
    const items = load().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return dueToDate(a.due) - dueToDate(b.due);
    });

    list.innerHTML = '';
    const now = new Date();

    items.forEach(item => {
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
        if (target) target.done = checkbox.checked;
        save(all);
        render();
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
      });
      li.appendChild(del);

      list.appendChild(li);
    });
  }

  function init() {
    const form = document.getElementById('reminder-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const textInput = document.getElementById('reminder-text');
      const dateInput = document.getElementById('reminder-due-date');
      const timeInput = document.getElementById('reminder-due-time');

      let due = null;
      if (dateInput.value) {
        due = timeInput.value ? `${dateInput.value}T${timeInput.value}` : dateInput.value;
      }

      const items = load();
      items.push({
        id: crypto.randomUUID(),
        text: textInput.value.trim(),
        due,
        done: false
      });
      save(items);
      textInput.value = '';
      dateInput.value = '';
      timeInput.value = '';
      render();
    });
    render();
  }

  return { init };
})();
