// Notes widget — add/edit notes, plus an optional PIN lock per note. The PIN
// is never stored in plain text: it's hashed with SHA-256 (via SubtleCrypto)
// and only the hash is kept in localStorage. This is enough to stop a
// casual glance/accidental click, not real security — anyone with devtools
// access to localStorage could brute-force a short PIN offline. Locked
// notes hide their body and can't be edited until unlocked (entering the
// correct PIN clears the lock).
//
// Deleting a note is a soft delete: it moves into a collapsible "Deleted"
// section (lock state preserved) instead of disappearing, and can be
// restored or removed for good from there.
const Notes = (() => {
  const STORAGE_KEY = 'homepage_notes';

  const ICON_LOCK = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="9" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const ICON_UNLOCK = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="9" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 9V6.5a3 3 0 0 1 5.7-1.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M6 6l.6 9.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L14 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_RESTORE = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10a6 6 0 1 1 1.8 4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 6v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let editingId = null;   // note-modal
  let pinContext = null;  // { mode: 'lock' | 'unlock', id }

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

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // ---------- note add/edit modal ----------

  function openNoteModal(item) {
    editingId = item ? item.id : null;
    document.getElementById('note-modal-title').textContent = item ? 'Edit Note' : 'Add Note';
    document.getElementById('note-title').value = item ? item.title : '';
    document.getElementById('note-body').value = item ? item.body : '';
    document.getElementById('note-delete').hidden = !item;
    document.getElementById('note-modal').hidden = false;
    document.getElementById('note-title').focus();
  }

  function closeNoteModal() {
    document.getElementById('note-modal').hidden = true;
    editingId = null;
  }

  // ---------- PIN modal (shared for lock / unlock) ----------

  function openPinModal(mode, id) {
    pinContext = { mode, id };
    const title = document.getElementById('pin-modal-title');
    const desc = document.getElementById('pin-modal-desc');
    const label2 = document.getElementById('pin-label-2');
    const input1 = document.getElementById('pin-input-1');
    const input2 = document.getElementById('pin-input-2');
    const error = document.getElementById('pin-error');
    const submit = document.getElementById('pin-submit');

    input1.value = '';
    input2.value = '';
    error.hidden = true;

    if (mode === 'lock') {
      title.textContent = 'Lock Note';
      desc.textContent = 'Set A PIN (4+ Characters) To Lock This Note.';
      label2.hidden = false;
      submit.textContent = 'Lock';
    } else {
      title.textContent = 'Unlock Note';
      desc.textContent = 'Enter The PIN To Unlock This Note.';
      label2.hidden = true;
      submit.textContent = 'Unlock';
    }

    document.getElementById('pin-modal').hidden = false;
    input1.focus();
  }

  function closePinModal() {
    document.getElementById('pin-modal').hidden = true;
    pinContext = null;
  }

  async function submitPin() {
    if (!pinContext) return;
    const error = document.getElementById('pin-error');
    const pin1 = document.getElementById('pin-input-1').value;
    const pin2 = document.getElementById('pin-input-2').value;

    if (pin1.length < 4) {
      error.textContent = 'PIN Must Be At Least 4 Characters.';
      error.hidden = false;
      return;
    }

    const items = load();
    const item = items.find(x => x.id === pinContext.id);
    if (!item) { closePinModal(); return; }

    if (pinContext.mode === 'lock') {
      if (pin1 !== pin2) {
        error.textContent = 'PINs Do Not Match.';
        error.hidden = false;
        return;
      }
      item.pinHash = await sha256Hex(pin1);
      item.locked = true;
      save(items);
      closePinModal();
      render();
      return;
    }

    // unlock
    const hash = await sha256Hex(pin1);
    if (hash !== item.pinHash) {
      error.textContent = 'Incorrect PIN.';
      error.hidden = false;
      return;
    }
    item.locked = false;
    item.pinHash = null;
    save(items);
    closePinModal();
    render();
    // Jump straight into editing — unlocking is almost always so the note
    // can be read or changed. (Not offered from the Deleted section.)
    if (!item.deleted) openNoteModal(item);
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
  }

  function restore(id) {
    const items = load();
    const item = items.find(x => x.id === id);
    if (!item) return;
    item.deleted = false;
    item.deletedAt = null;
    save(items);
    render();
  }

  function destroyForever(id) {
    if (!confirm('Permanently delete this note? This cannot be undone.')) return;
    save(load().filter(x => x.id !== id));
    render();
  }

  // ---------- rendering ----------

  function buildCard(item) {
    const card = document.createElement('div');
    card.className = 'note-card' + (item.locked ? ' locked' : '');

    const head = document.createElement('div');
    head.className = 'note-card-head';

    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = item.title || (item.locked ? 'Locked Note' : 'Untitled');
    head.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'note-card-actions';

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'icon-btn';
    lockBtn.innerHTML = item.locked ? ICON_LOCK : ICON_UNLOCK;
    lockBtn.title = item.locked ? 'Unlock Note' : 'Lock Note';
    lockBtn.addEventListener('click', e => {
      e.stopPropagation();
      openPinModal(item.locked ? 'unlock' : 'lock', item.id);
    });
    actions.appendChild(lockBtn);

    // Soft-delete is non-destructive, so it's available even on locked
    // notes — the lock is preserved once it lands in the Deleted section.
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn note-delete-btn';
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      softDelete(item.id);
    });
    actions.appendChild(delBtn);

    head.appendChild(actions);
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'note-card-body';
    if (item.locked) {
      const lockIcon = document.createElement('span');
      lockIcon.className = 'note-locked-icon';
      lockIcon.innerHTML = ICON_LOCK;
      body.appendChild(lockIcon);
      body.appendChild(document.createTextNode('Locked — Click To Unlock'));
    } else {
      body.textContent = item.body || '';
    }
    card.appendChild(body);

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    meta.textContent = `Updated ${formatDate(item.updatedAt || item.createdAt)}`;
    card.appendChild(meta);

    card.addEventListener('click', () => {
      if (item.locked) {
        openPinModal('unlock', item.id);
      } else {
        openNoteModal(item);
      }
    });

    return card;
  }

  function buildDeletedCard(item) {
    const card = document.createElement('div');
    card.className = 'note-card note-card-deleted' + (item.locked ? ' locked' : '');

    const head = document.createElement('div');
    head.className = 'note-card-head';

    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = item.locked ? 'Locked Note' : (item.title || 'Untitled');
    head.appendChild(title);

    if (item.locked) {
      const lockIcon = document.createElement('span');
      lockIcon.className = 'note-card-actions';
      lockIcon.innerHTML = ICON_LOCK;
      head.appendChild(lockIcon);
    }
    card.appendChild(head);

    if (!item.locked) {
      const body = document.createElement('div');
      body.className = 'note-card-body';
      body.textContent = item.body || '';
      card.appendChild(body);
    }

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    meta.textContent = `Deleted ${formatDate(item.deletedAt || item.updatedAt)}`;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'note-card-actions note-card-actions-row';

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
    const active = all.filter(n => !n.deleted).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const deleted = all.filter(n => n.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

    const grid = document.getElementById('notes-grid');
    grid.innerHTML = '';
    active.forEach(item => grid.appendChild(buildCard(item)));

    const deletedSection = document.getElementById('notes-deleted-section');
    const deletedGrid = document.getElementById('notes-deleted-grid');
    document.getElementById('notes-deleted-count').textContent = deleted.length;
    deletedSection.hidden = deleted.length === 0;
    deletedGrid.innerHTML = '';
    deleted.forEach(item => deletedGrid.appendChild(buildDeletedCard(item)));
  }

  function init() {
    document.getElementById('add-note-btn').addEventListener('click', () => openNoteModal(null));
    document.getElementById('note-cancel').addEventListener('click', closeNoteModal);

    document.getElementById('note-form').addEventListener('submit', e => {
      e.preventDefault();
      const title = document.getElementById('note-title').value.trim();
      const body = document.getElementById('note-body').value.trim();
      if (!body) return;

      const items = load();
      if (editingId) {
        const target = items.find(x => x.id === editingId);
        if (target) { target.title = title; target.body = body; target.updatedAt = Date.now(); }
      } else {
        items.push({
          id: crypto.randomUUID(),
          title,
          body,
          locked: false,
          pinHash: null,
          deleted: false,
          deletedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      save(items);
      closeNoteModal();
      render();
    });

    document.getElementById('note-delete').addEventListener('click', () => {
      if (!editingId) return;
      softDelete(editingId);
      closeNoteModal();
    });

    document.getElementById('pin-cancel').addEventListener('click', closePinModal);
    document.getElementById('pin-form').addEventListener('submit', e => {
      e.preventDefault();
      submitPin();
    });

    render();
  }

  return { init };
})();
