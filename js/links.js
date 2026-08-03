// Quick Links widget — editable tiles stored in localStorage
const Links = (() => {
  const STORAGE_KEY = 'homepage_links';
  const DEFAULTS = [
    { id: crypto.randomUUID(), label: 'Gmail', url: 'https://mail.google.com' },
    { id: crypto.randomUUID(), label: 'Roblox', url: 'https://www.roblox.com' },
    { id: crypto.randomUUID(), label: 'YouTube', url: 'https://www.youtube.com' }
  ];

  let editingId = null;
  let dragSrcId = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return DEFAULTS;
      return JSON.parse(raw) || [];
    } catch {
      return DEFAULTS;
    }
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    Sync.push();
  }

  function faviconFor(url) {
    try {
      const host = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch {
      return '';
    }
  }

  function render() {
    const grid = document.getElementById('links-grid');
    grid.innerHTML = '';
    const items = load();

    items.forEach(item => {
      const tile = document.createElement('a');
      tile.href = item.url;
      tile.target = '_blank';
      tile.rel = 'noopener noreferrer';
      tile.className = 'link-tile';
      tile.draggable = true;
      tile.dataset.id = item.id;

      const img = document.createElement('img');
      img.src = faviconFor(item.url);
      img.alt = '';

      const span = document.createElement('span');
      span.textContent = item.label;

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        openModal(item);
      });

      tile.appendChild(img);
      tile.appendChild(span);
      tile.appendChild(editBtn);

      tile.addEventListener('dragstart', () => {
        dragSrcId = item.id;
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
      tile.addEventListener('dragover', e => e.preventDefault());
      tile.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrcId || dragSrcId === item.id) return;
        const all = load();
        const srcIdx = all.findIndex(x => x.id === dragSrcId);
        const dstIdx = all.findIndex(x => x.id === item.id);
        const [moved] = all.splice(srcIdx, 1);
        all.splice(dstIdx, 0, moved);
        save(all);
        render();
      });

      grid.appendChild(tile);
    });
  }

  function openModal(item) {
    editingId = item ? item.id : null;
    document.getElementById('link-modal-title').textContent = item ? 'Edit Link' : 'Add Link';
    document.getElementById('link-label').value = item ? item.label : '';
    document.getElementById('link-url').value = item ? item.url : '';
    document.getElementById('link-delete').hidden = !item;
    document.getElementById('link-modal').hidden = false;
  }

  function closeModal() {
    document.getElementById('link-modal').hidden = true;
    editingId = null;
  }

  function init() {
    document.getElementById('add-link-btn').addEventListener('click', () => openModal(null));
    document.getElementById('link-cancel').addEventListener('click', closeModal);

    document.getElementById('link-form').addEventListener('submit', e => {
      e.preventDefault();
      const label = document.getElementById('link-label').value.trim();
      let url = document.getElementById('link-url').value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

      const items = load();
      if (editingId) {
        const target = items.find(x => x.id === editingId);
        if (target) { target.label = label; target.url = url; }
      } else {
        items.push({ id: crypto.randomUUID(), label, url });
      }
      save(items);
      closeModal();
      render();
    });

    document.getElementById('link-delete').addEventListener('click', () => {
      if (!editingId) return;
      save(load().filter(x => x.id !== editingId));
      closeModal();
      render();
    });

    render();
  }

  return { init };
})();
