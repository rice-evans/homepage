// Study tracker — kanban board (Not Started / In Progress / Complete) with
// optional date, time and duration per item. Cards can be dragged between
// columns to change status, or edited via the modal. Items with a date also
// show up on the Calendar (see loadAsCalendarEvents, consumed by
// js/calendar.js) as a read-only entry — manage them from here.
//
// Deleting an item is a soft delete: it moves into a collapsible "Deleted"
// section (its status/column is untouched) instead of disappearing, and can
// be restored back to that same column or removed for good from there.
const Study = (() => {
  const STORAGE_KEY = 'homepage_study';
  const STATUSES = ['not-started', 'in-progress', 'complete'];

  const ICON_RESTORE = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10a6 6 0 1 1 1.8 4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 6v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let editingId = null;
  let dragSrcId = null;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    Sync.push();
  }

  function refreshCalendar() {
    if (typeof Calendar !== 'undefined' && Calendar.refresh) Calendar.refresh();
  }

  function formatDate(key) {
    return new Date(key + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatDuration(mins) {
    const n = Number(mins);
    if (!n) return '';
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  // Exposed for the Calendar widget. Deleted items don't show on the
  // Calendar until restored.
  function loadAsCalendarEvents() {
    return load()
      .filter(s => s.date && !s.deleted)
      .map(s => ({
        id: `study-${s.id}`,
        text: `📚 ${s.title}`,
        start: s.date,
        end: s.date,
        readOnly: true,
        done: s.status === 'complete',
        kind: 'study'
      }));
  }

  // ---------- modal ----------

  function openModal(item) {
    editingId = item ? item.id : null;
    document.getElementById('study-modal-title').textContent = item ? 'Edit Study Item' : 'Add Study Item';
    document.getElementById('study-title').value = item ? item.title : '';
    document.getElementById('study-status').value = item ? item.status : 'not-started';
    document.getElementById('study-date').value = item && item.date ? item.date : '';
    document.getElementById('study-time').value = item && item.time ? item.time : '';
    document.getElementById('study-duration').value = item && item.duration ? item.duration : '';
    document.getElementById('study-notes').value = item ? (item.notes || '') : '';
    document.getElementById('study-delete').hidden = !item;
    document.getElementById('study-modal').hidden = false;
    document.getElementById('study-title').focus();
  }

  function closeModal() {
    document.getElementById('study-modal').hidden = true;
    editingId = null;
  }

  // ---------- soft delete ----------

  function softDelete(id) {
    const items = load();
    const item = items.find(x => x.id === id);
    if (!item) return;
    item.deleted = true;
    item.deletedAt = Date.now();
    save(items);
    render();
    refreshCalendar();
  }

  function restore(id) {
    const items = load();
    const item = items.find(x => x.id === id);
    if (!item) return;
    item.deleted = false;
    item.deletedAt = null;
    save(items);
    render();
    refreshCalendar();
  }

  function destroyForever(id) {
    if (!confirm('Permanently delete this study item? This cannot be undone.')) return;
    save(load().filter(x => x.id !== id));
    render();
  }

  // ---------- drag & drop between columns ----------

  function attachDrag(card, item) {
    card.draggable = true;
    card.addEventListener('dragstart', () => {
      dragSrcId = item.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }

  function attachDropTarget(listEl, status) {
    listEl.addEventListener('dragover', e => {
      e.preventDefault();
      listEl.classList.add('drag-over');
    });
    listEl.addEventListener('dragleave', () => listEl.classList.remove('drag-over'));
    listEl.addEventListener('drop', e => {
      e.preventDefault();
      listEl.classList.remove('drag-over');
      if (!dragSrcId) return;
      const items = load();
      const target = items.find(x => x.id === dragSrcId);
      if (target && target.status !== status) {
        const justCompleted = status === 'complete' && target.status !== 'complete';
        target.status = status;
        target.updatedAt = Date.now();
        save(items);
        render();
        refreshCalendar();
        if (justCompleted) Confetti.rain();
      }
      dragSrcId = null;
    });
  }

  // ---------- rendering ----------

  function buildCard(item) {
    const card = document.createElement('div');
    card.className = `study-card status-${item.status}`;

    const title = document.createElement('div');
    title.className = 'study-card-title';
    title.textContent = item.title;
    card.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'study-card-badges';
    if (item.date) {
      const b = document.createElement('span');
      b.className = 'study-badge';
      b.textContent = item.time ? `${formatDate(item.date)}, ${formatTime(item.time)}` : formatDate(item.date);
      badges.appendChild(b);
    }
    if (item.duration) {
      const b = document.createElement('span');
      b.className = 'study-badge';
      b.textContent = formatDuration(item.duration);
      badges.appendChild(b);
    }
    card.appendChild(badges);

    card.addEventListener('click', () => openModal(item));
    attachDrag(card, item);
    return card;
  }

  function buildDeletedCard(item) {
    const card = document.createElement('div');
    card.className = 'study-card study-card-deleted';

    const title = document.createElement('div');
    title.className = 'study-card-title';
    title.textContent = item.title;
    card.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'study-card-badges';
    const statusBadge = document.createElement('span');
    statusBadge.className = 'study-badge';
    statusBadge.textContent = { 'not-started': 'Not Started', 'in-progress': 'In Progress', 'complete': 'Complete' }[item.status] || item.status;
    badges.appendChild(statusBadge);
    if (item.date) {
      const b = document.createElement('span');
      b.className = 'study-badge';
      b.textContent = formatDate(item.date);
      badges.appendChild(b);
    }
    card.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'study-card-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'icon-btn';
    restoreBtn.innerHTML = ICON_RESTORE;
    restoreBtn.title = 'Restore';
    restoreBtn.addEventListener('click', () => restore(item.id));
    actions.appendChild(restoreBtn);

    const foreverBtn = document.createElement('button');
    foreverBtn.type = 'button';
    foreverBtn.className = 'btn btn-danger btn-small';
    foreverBtn.textContent = 'Delete Forever';
    foreverBtn.addEventListener('click', () => destroyForever(item.id));
    actions.appendChild(foreverBtn);

    card.appendChild(actions);
    return card;
  }

  function render() {
    const all = load();

    STATUSES.forEach(status => {
      const list = document.getElementById(`study-list-${status}`);
      const count = document.getElementById(`study-count-${status}`);
      list.innerHTML = '';
      const inStatus = all
        .filter(i => i.status === status && !i.deleted)
        .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || ''));
      inStatus.forEach(item => list.appendChild(buildCard(item)));
      count.textContent = inStatus.length;
    });

    const deleted = all.filter(i => i.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    const deletedSection = document.getElementById('study-deleted-section');
    const deletedList = document.getElementById('study-deleted-list');
    document.getElementById('study-deleted-count').textContent = deleted.length;
    deletedSection.hidden = deleted.length === 0;
    deletedList.innerHTML = '';
    deleted.forEach(item => deletedList.appendChild(buildDeletedCard(item)));
  }

  function init() {
    STATUSES.forEach(status => {
      attachDropTarget(document.getElementById(`study-list-${status}`), status);
    });

    document.getElementById('add-study-btn').addEventListener('click', () => openModal(null));
    document.getElementById('study-cancel').addEventListener('click', closeModal);

    document.getElementById('study-form').addEventListener('submit', e => {
      e.preventDefault();
      const title = document.getElementById('study-title').value.trim();
      if (!title) return;
      const status = document.getElementById('study-status').value;
      const date = document.getElementById('study-date').value || null;
      const time = document.getElementById('study-time').value || null;
      const duration = document.getElementById('study-duration').value
        ? Number(document.getElementById('study-duration').value)
        : null;
      const notes = document.getElementById('study-notes').value.trim();

      const items = load();
      let justCompleted = false;
      if (editingId) {
        const target = items.find(x => x.id === editingId);
        if (target) {
          justCompleted = status === 'complete' && target.status !== 'complete';
          Object.assign(target, { title, status, date, time, duration, notes, updatedAt: Date.now() });
        }
      } else {
        justCompleted = status === 'complete';
        items.push({
          id: crypto.randomUUID(),
          title, status, date, time, duration, notes,
          deleted: false,
          deletedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      save(items);
      closeModal();
      render();
      refreshCalendar();
      if (justCompleted) Confetti.rain();
    });

    document.getElementById('study-delete').addEventListener('click', () => {
      if (!editingId) return;
      softDelete(editingId);
      closeModal();
    });

    render();
  }

  return { init, refresh: render, loadAsCalendarEvents };
})();
