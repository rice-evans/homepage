// Sidebar navigation + collapse. Views are swapped by toggling `.active` on
// the matching #view-<name> section (data-view attribute), driven by
// location.hash so pages are bookmarkable/back-button friendly. The sidebar
// itself is a fixed-width flex column; clicking the thin strip on its right
// edge (`.sidebar-resize-handle`) toggles a collapsed (icons-only) state,
// remembered in localStorage.
const Sidebar = (() => {
  const COLLAPSE_KEY = 'homepage_sidebar_collapsed';
  const VIEWS = ['home', 'notes', 'study', 'roblox'];
  const DEFAULT_VIEW = 'home';

  function currentView() {
    const hash = (location.hash || '').replace('#', '');
    return VIEWS.includes(hash) ? hash : DEFAULT_VIEW;
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach(section => {
      section.classList.toggle('active', section.dataset.view === name);
    });
    document.querySelectorAll('#sidebar-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    // Some views (Calendar month grid on Home, Study board) only need to
    // lay themselves out once they're actually visible.
    if (name === 'home' && typeof Calendar !== 'undefined' && Calendar.refresh) Calendar.refresh();
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
    const stored = localStorage.getItem(COLLAPSE_KEY);

    // On a phone-sized screen, default to collapsed (icons-only) so the
    // sidebar doesn't dominate the viewport — but only the first time, i.e.
    // only when the user hasn't explicitly chosen a state yet.
    const shouldCollapse = stored === null ? window.matchMedia('(max-width: 640px)').matches : stored === '1';
    sidebar.classList.toggle('collapsed', shouldCollapse);

    handle.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    });
  }

  function init() {
    // Scoped to the <nav> itself — the Settings button at the bottom of the
    // sidebar reuses the .nav-item look but isn't a page/view, so it's
    // handled entirely by js/settings.js instead.
    document.querySelectorAll('#sidebar-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    window.addEventListener('hashchange', () => showView(currentView()));
    initCollapse();
    showView(currentView());
  }

  return { init };
})();
