// Reminders widget — stored in localStorage
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

  function render() {
    const list = document.getElementById('reminder-list');
    const items = load().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });

    list.innerHTML = '';
    const now = new Date();

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'reminder-item';
      if (item.done) li.classList.add('done');
      if (!item.done && item.due && new Date(item.due) < now) li.classList.add('overdue');

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
        due.textContent = new Date(item.due).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
      const dueInput = document.getElementById('reminder-due');
      const items = load();
      items.push({
        id: crypto.randomUUID(),
        text: textInput.value.trim(),
        due: dueInput.value || null,
        done: false
      });
      save(items);
      textInput.value = '';
      dueInput.value = '';
      render();
    });
    render();
  }

  return { init };
})();
