// Settings — animated background colors, or a static uploaded image, both
// editable live from a small modal opened via the gear button at the
// bottom of the sidebar. Kept in localStorage only (a display preference
// tied to this browser, same treatment as the sidebar's collapsed state),
// not mirrored through Sync — an image data URL is too large for that.
const Settings = (() => {
  const STORAGE_KEY = 'homepage_theme';
  const DEFAULTS = { color1: '#000000', color2: '#3d4249', color3: '#94a3b8', bgImage: null };
  const MAX_DIMENSION = 1920;
  const JPEG_QUALITY = 0.82;
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

  // Rebuilds the background: either the Grainient WebGL gradient (with the
  // plain-CSS gradient as a fallback that shows before WebGL kicks in), or
  // a static uploaded image that fully covers it. Only one is ever active
  // at a time, so an uploaded image always tears down the WebGL instance.
  function applyBackground(theme) {
    const bg = document.getElementById('grainient-bg');

    if (theme.bgImage) {
      if (grainientHandle && grainientHandle.destroy) grainientHandle.destroy();
      grainientHandle = null;
      bg.style.background = `center / cover no-repeat url("${theme.bgImage}")`;
      return;
    }

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
    updateImagePreview(theme);
  }

  function updateImagePreview(theme) {
    const preview = document.getElementById('settings-bg-image-preview');
    const removeBtn = document.getElementById('settings-bg-image-remove');
    if (theme.bgImage) {
      preview.style.backgroundImage = `url("${theme.bgImage}")`;
      preview.hidden = false;
      removeBtn.hidden = false;
    } else {
      preview.style.backgroundImage = '';
      preview.hidden = true;
      removeBtn.hidden = true;
    }
  }

  function openModal() {
    fillInputs(load());
    document.getElementById('settings-modal').hidden = false;
  }

  function closeModal() {
    document.getElementById('settings-modal').hidden = true;
  }

  function onColorInput() {
    const theme = load();
    theme.color1 = document.getElementById('settings-color1').value;
    theme.color2 = document.getElementById('settings-color2').value;
    theme.color3 = document.getElementById('settings-color3').value;
    save(theme);
    applyBackground(theme);
  }

  // Resizes the chosen image down to MAX_DIMENSION on its longest side and
  // re-encodes as JPEG so a large photo doesn't blow past localStorage's
  // ~5-10MB quota. Returns a data URL.
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could Not Read That File.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That File Doesn\'t Look Like A Valid Image.'));
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const scale = MAX_DIMENSION / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onImageChosen(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      const theme = load();
      theme.bgImage = dataUrl;
      save(theme);
      applyBackground(theme);
      updateImagePreview(theme);
    } catch (err) {
      alert(err.message || 'Something Went Wrong Uploading That Image.');
    } finally {
      e.target.value = '';
    }
  }

  function removeImage() {
    const theme = load();
    theme.bgImage = null;
    save(theme);
    applyBackground(theme);
    updateImagePreview(theme);
  }

  function init() {
    applyBackground(load());

    document.getElementById('open-settings-btn').addEventListener('click', openModal);
    document.getElementById('settings-close').addEventListener('click', closeModal);
    ['settings-color1', 'settings-color2', 'settings-color3'].forEach(id => {
      document.getElementById(id).addEventListener('input', onColorInput);
    });
    document.getElementById('settings-reset').addEventListener('click', () => {
      save({ ...DEFAULTS });
      fillInputs(DEFAULTS);
      applyBackground(DEFAULTS);
    });

    const imageInput = document.getElementById('settings-bg-image-input');
    document.getElementById('settings-bg-image-btn').addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', onImageChosen);
    document.getElementById('settings-bg-image-remove').addEventListener('click', removeImage);
  }

  return { init };
})();
