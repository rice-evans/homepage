// Vanilla JS port of React Bits' <GlassSurface /> "liquid glass" effect.
// Applies an SVG-filter-driven backdrop distortion to an element (Chromium),
// falling back to a plain frosted blur on browsers that don't support SVG
// filters inside backdrop-filter (Safari, Firefox).
const GlassSurface = (() => {
  const svgNS = 'http://www.w3.org/2000/svg';
  let defsContainer = null;
  let idCounter = 0;

  function ensureDefs() {
    if (defsContainer) return defsContainer;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.overflow = 'hidden';
    svg.style.pointerEvents = 'none';
    document.body.appendChild(svg);
    defsContainer = document.createElementNS(svgNS, 'defs');
    svg.appendChild(defsContainer);
    return defsContainer;
  }

  function supportsSvgBackdropFilter() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const ua = navigator.userAgent;
    const isWebkit = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    if (isWebkit || isFirefox) return false;
    const div = document.createElement('div');
    div.style.backdropFilter = 'url(#glass-surface-support-test)';
    return div.style.backdropFilter !== '';
  }

  function buildDisplacementDataUri(width, height, { borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode }) {
    const redGradId = `rg-${idCounter}`;
    const blueGradId = `bg-${idCounter}`;
    const edgeSize = Math.min(width, height) * (borderWidth * 0.5);
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="black"></rect>
        <rect x="0" y="0" width="${width}" height="${height}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${width}" height="${height}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${width - edgeSize * 2}" height="${height - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function applyTo(el, opts = {}) {
    const {
      borderRadius = 16,
      borderWidth = 0.07,
      brightness = 35,
      opacity = 0.5,
      blur = 11,
      displace = 0.7,
      backgroundOpacity = 0.28,
      saturation = 1.5,
      distortionScale = -110,
      redOffset = 0,
      greenOffset = 6,
      blueOffset = 12,
      xChannel = 'R',
      yChannel = 'G',
      mixBlendMode = 'difference'
    } = opts;

    if (!supportsSvgBackdropFilter()) {
      el.classList.add('glass-surface-fallback');
      return;
    }

    const id = idCounter++;
    const filterId = `glass-filter-${id}`;
    const defs = ensureDefs();

    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');

    const feImage = document.createElementNS(svgNS, 'feImage');
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');
    feImage.setAttribute('width', '100%');
    feImage.setAttribute('height', '100%');
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('result', 'map');
    filter.appendChild(feImage);

    function addDisplace(resultName, colorName, matrix, offset) {
      const disp = document.createElementNS(svgNS, 'feDisplacementMap');
      disp.setAttribute('in', 'SourceGraphic');
      disp.setAttribute('in2', 'map');
      disp.setAttribute('result', `disp${resultName}`);
      disp.setAttribute('xChannelSelector', xChannel);
      disp.setAttribute('yChannelSelector', yChannel);
      disp.setAttribute('scale', String(distortionScale + offset));
      filter.appendChild(disp);

      const cm = document.createElementNS(svgNS, 'feColorMatrix');
      cm.setAttribute('in', `disp${resultName}`);
      cm.setAttribute('type', 'matrix');
      cm.setAttribute('values', matrix);
      cm.setAttribute('result', colorName);
      filter.appendChild(cm);
    }

    addDisplace('Red', 'red', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', redOffset);
    addDisplace('Green', 'green', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', greenOffset);
    addDisplace('Blue', 'blue', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', blueOffset);

    const blend1 = document.createElementNS(svgNS, 'feBlend');
    blend1.setAttribute('in', 'red');
    blend1.setAttribute('in2', 'green');
    blend1.setAttribute('mode', 'screen');
    blend1.setAttribute('result', 'rg');
    filter.appendChild(blend1);

    const blend2 = document.createElementNS(svgNS, 'feBlend');
    blend2.setAttribute('in', 'rg');
    blend2.setAttribute('in2', 'blue');
    blend2.setAttribute('mode', 'screen');
    blend2.setAttribute('result', 'output');
    filter.appendChild(blend2);

    const gaussian = document.createElementNS(svgNS, 'feGaussianBlur');
    gaussian.setAttribute('in', 'output');
    gaussian.setAttribute('stdDeviation', String(displace));
    filter.appendChild(gaussian);

    defs.appendChild(filter);

    el.classList.add('glass-surface-svg');
    el.style.setProperty('--glass-frost', String(backgroundOpacity));
    el.style.setProperty('--glass-saturation', String(saturation));
    el.style.setProperty('--glass-filter-url', `url(#${filterId})`);

    function update() {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      feImage.setAttribute('href', buildDisplacementDataUri(width, height, { borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode }));
    }
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
  }

  function applyToAll(selector, opts) {
    document.querySelectorAll(selector).forEach(el => applyTo(el, opts));
  }

  return { applyTo, applyToAll };
})();
