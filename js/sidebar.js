// Sidebar navigation + collapse. Views are swapped by toggling `.active` on
// the matching #view-<name> section (data-view attribute), driven by
// location.hash so pages are bookmarkable/back-button friendly. The sidebar
// itself is a fixed-width flex column; clicking the thin strip on its right
// edge (`.sidebar-resize-handle`) toggles a collapsed (icons-only) state,
// remembered in localStorage.
const Sidebar = (() => {
  const COLLAPSE_KEY = 'homepage_sidebar_collapsed';
  const VIEWS = ['home', 'calendar', 'notes', 'study', 'chat', 'roblox'];
  const DEFAULT_VIEW = 'home';

  function currentView() {
    const hash = (location.hash || '').replace('#', '');
    return VIEWS.includes(hash) ? hash : DEFAULT_VIEW;
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach(section => {
      section.classList.toggle('active', section.dataset.view === name);
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    // Some views (Calendar month grid, Study board) only need to lay
    // themselves out once they're actually visible.
    if (name === 'calendar' && typeof Calendar !== 'undefined' && Calendar.refresh) Calendar.refresh();
    if (name === 'study' && typeof Study !== 'undefined' && Study.refresh) Study.refresh();
  }

  function navigate(name) {
    if (location.hash === `#${name}`) {
      showView(name);
    } else {
      location.hash = name;
    }
  }

  function initCollapse() {
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('sidebar-toggle');
    if (localStorage.getItem(COLLAPSE_KEY) === '1') sidebar.classList.add('collapsed');

    handle.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    });
  }

  function init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    window.addEventListener('hashchange', () => showView(currentView()));
    initCollapse();
    showView(currentView());
  }

  return { init };
})();
