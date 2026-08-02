// Settings — currently just the animated background colors, editable live
// from a small modal opened via the gear button at the bottom of the
// sidebar. Colors are kept in localStorage only (a display preference tied
// to this browser, same treatment as the sidebar's collapsed state), not
// mirrored through Sync.
const Settings = (() => {
  const STORAGE_KEY = 'homepage_theme';
  const DEFAULTS = { color1: '#000000', color2: '#3d4249', color3: '#94a3b8' };
  let grainientHandle = null;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULTS, ...(data || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(theme) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }

  // Rebuilds the Grainient WebGL background with new colors (and updates the
  // plain-CSS fallback that shows before WebGL kicks in / when it's
  // unavailable), so color changes apply live as the user drags the pickers.
  function applyBackground(theme) {
    const bg = document.getElementById('grainient-bg');
    bg.style.background = `linear-gradient(135deg, ${theme.color1} 0%, ${theme.color2} 55%, ${theme.color3} 100%)`;
    if (grainientHandle && grainientHandle.destroy) grainientHandle.destroy();
    grainientHandle = Grainient.init(bg, {
      color1: theme.color1,
      color2: theme.color2,
      color3: theme.color3
    });
  }

  function fillInputs(theme) {
    document.getElementById('settings-color1').value = theme.color1;
    document.getElementById('settings-color2').value = theme.color2;
    document.getElementById('settings-color3').value = theme.color3;
  }

  function openModal() {
    fillInputs(load());
    document.getElementById('settings-modal').hidden = false;
  }

  function closeModal() {
    document.getElementById('settings-modal').hidden = true;
  }

  function onColorInput() {
    const theme = {
      color1: document.getElementById('settings-color1').value,
      color2: document.getElementById('settings-color2').value,
      color3: document.getElementById('settings-color3').value
    };
    save(theme);
    applyBackground(theme);
  }

  function init() {
    applyBackground(load());

    document.getElementById('open-settings-btn').addEventListener('click', openModal);
    document.getElementById('settings-close').addEventListener('click', closeModal);
    ['settings-color1', 'settings-color2', 'settings-color3'].forEach(id => {
      document.getElementById(id).addEventListener('input', onColorInput);
    });
    document.getElementById('settings-reset').addEventListener('click', () => {
      save(DEFAULTS);
      fillInputs(DEFAULTS);
      applyBackground(DEFAULTS);
    });
  }

  return { init };
})();
