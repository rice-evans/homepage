// Weather — 7-day forecast via the api/weather.js proxy (Open-Meteo).
// Location is either the browser's geolocation or a manually searched city,
// persisted in localStorage so we don't ask again every visit. Clicking a
// day card expands a detail panel below the row.
const Weather = (() => {
  const LOCATION_KEY = 'homepage_weather_location';
  const CACHE_KEY = 'homepage_weather_cache';
  const CACHE_MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes

  let statusEl, daysEl, detailEl, searchForm, searchInput, searchResultsEl, changeLocationBtn;
  let currentData = null;
  let selectedDate = null;
  let loaded = false;

  const WMO = {
    0: { label: 'Clear Sky', icon: 'sun' },
    1: { label: 'Mainly Clear', icon: 'sun-cloud' },
    2: { label: 'Partly Cloudy', icon: 'sun-cloud' },
    3: { label: 'Overcast', icon: 'cloud' },
    45: { label: 'Fog', icon: 'fog' },
    48: { label: 'Depositing Rime Fog', icon: 'fog' },
    51: { label: 'Light Drizzle', icon: 'drizzle' },
    53: { label: 'Moderate Drizzle', icon: 'drizzle' },
    55: { label: 'Dense Drizzle', icon: 'drizzle' },
    56: { label: 'Light Freezing Drizzle', icon: 'drizzle' },
    57: { label: 'Dense Freezing Drizzle', icon: 'drizzle' },
    61: { label: 'Slight Rain', icon: 'rain' },
    63: { label: 'Moderate Rain', icon: 'rain' },
    65: { label: 'Heavy Rain', icon: 'rain' },
    66: { label: 'Light Freezing Rain', icon: 'rain' },
    67: { label: 'Heavy Freezing Rain', icon: 'rain' },
    71: { label: 'Slight Snow', icon: 'snow' },
    73: { label: 'Moderate Snow', icon: 'snow' },
    75: { label: 'Heavy Snow', icon: 'snow' },
    77: { label: 'Snow Grains', icon: 'snow' },
    80: { label: 'Slight Showers', icon: 'showers' },
    81: { label: 'Moderate Showers', icon: 'showers' },
    82: { label: 'Violent Showers', icon: 'showers' },
    85: { label: 'Slight Snow Showers', icon: 'snow' },
    86: { label: 'Heavy Snow Showers', icon: 'snow' },
    95: { label: 'Thunderstorm', icon: 'storm' },
    96: { label: 'Thunderstorm With Hail', icon: 'storm' },
    99: { label: 'Thunderstorm With Heavy Hail', icon: 'storm' }
  };

  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'sun-cloud': '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="3.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 3.5v1.5M9 12.5V14M3.5 9H5M13 9h1.5M5.1 5.1l1 1M11.9 5.1l-1 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 18.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 18.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 13.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 13.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 17.5h16M4 21h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 12.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 12.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 17v2.2M13 17v2.2M17 17v2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 12.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 12.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 16.5l-1.5 3M13 16.5l-1.5 3M17.5 16.5l-1.5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    showers: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 11.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 11.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 15.5l-1.5 3M12 15.5l-1.5 3M16.5 15.5l-1.5 3M9.7 19l-1 2.2M14.2 19l-1 2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 12.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 12.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 16.5v5M6.7 18l4.6 2M13.7 18l-4.6 2M15 16.5v5M12.7 18l4.6 2M19.7 18l-4.6 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 11.5h11a4 4 0 0 0 0-8 6 6 0 0 0-11.4-1.8A4.5 4.5 0 0 0 6.5 11.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 14.5l-3 4.5h3l-2 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function conditionFor(code) {
    return WMO[code] || { label: 'Unknown', icon: 'cloud' };
  }

  function iconHTML(code, size) {
    const cond = conditionFor(code);
    return `<span class="weather-icon" style="width:${size}px;height:${size}px">${ICONS[cond.icon]}</span>`;
  }

  function loadLocation() {
    try { return JSON.parse(localStorage.getItem(LOCATION_KEY)); } catch { return null; }
  }

  function saveLocation(loc) {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
  }

  function saveCache(loc, data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ loc, data, at: Date.now() }));
  }

  function setStatus(html) {
    statusEl.innerHTML = html;
  }

  function round(n) {
    return n === null || n === undefined ? '--' : Math.round(n);
  }

  function dayLabel(dateStr, index) {
    const d = new Date(dateStr + 'T00:00:00');
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short' });
  }

  function dateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase();
  }

  function renderDays() {
    daysEl.innerHTML = '';
    if (!currentData || !currentData.days) return;

    currentData.days.forEach((day, i) => {
      const cond = conditionFor(day.code);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'weather-day-card' + (day.date === selectedDate ? ' active' : '');
      card.innerHTML = `
        <div class="weather-day-label">${dayLabel(day.date, i)}</div>
        <div class="weather-day-date">${dateLabel(day.date)}</div>
        ${iconHTML(day.code, 34)}
        <div class="weather-day-cond">${cond.label}</div>
        <div class="weather-day-temps"><span class="weather-day-max">${round(day.tempMax)}°</span><span class="weather-day-min">${round(day.tempMin)}°</span></div>
      `;
      card.addEventListener('click', () => {
        selectedDate = (selectedDate === day.date) ? null : day.date;
        renderDays();
        renderDetail();
      });
      daysEl.appendChild(card);
    });
  }

  function renderDetail() {
    if (!selectedDate || !currentData) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      return;
    }
    const day = currentData.days.find(d => d.date === selectedDate);
    if (!day) { detailEl.hidden = true; return; }
    const cond = conditionFor(day.code);
    const units = currentData.units || {};

    const hourlyRows = (day.hourlyTemps || [])
      .filter((_, i) => i % 3 === 0)
      .map(h => {
        const t = new Date(h.time);
        const timeLabel = t.toLocaleTimeString([], { hour: 'numeric' });
        return `<div class="weather-hour"><span>${timeLabel}</span>${iconHTML(h.code, 20)}<span>${round(h.temp)}°</span><span class="weather-hour-precip">${round(h.precipChance)}%</span></div>`;
      }).join('');

    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="weather-detail-header">
        ${iconHTML(day.code, 44)}
        <div>
          <div class="weather-detail-title">${dateLabel(day.date)} — ${cond.label}</div>
          <div class="weather-detail-sub">High ${round(day.tempMax)}° / Low ${round(day.tempMin)}° · Feels Like ${round(day.feelsMax)}° / ${round(day.feelsMin)}°</div>
        </div>
      </div>
      <div class="weather-detail-stats">
        <div class="weather-stat"><span class="weather-stat-label">Precipitation</span><span class="weather-stat-value">${day.precipSum ?? '--'} ${units.precipitation || 'mm'}</span></div>
        <div class="weather-stat"><span class="weather-stat-label">Chance Of Rain</span><span class="weather-stat-value">${round(day.precipChance)}%</span></div>
        <div class="weather-stat"><span class="weather-stat-label">Wind</span><span class="weather-stat-value">${round(day.windMax)} ${units.wind || 'km/h'}</span></div>
        <div class="weather-stat"><span class="weather-stat-label">UV Index</span><span class="weather-stat-value">${day.uvMax ?? '--'}</span></div>
        <div class="weather-stat"><span class="weather-stat-label">Sunrise</span><span class="weather-stat-value">${day.sunrise ? new Date(day.sunrise).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--'}</span></div>
        <div class="weather-stat"><span class="weather-stat-label">Sunset</span><span class="weather-stat-value">${day.sunset ? new Date(day.sunset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--'}</span></div>
      </div>
      ${hourlyRows ? `<div class="weather-hourly">${hourlyRows}</div>` : ''}
    `;
  }

  async function fetchForecast(loc) {
    const cached = loadCache();
    if (cached && cached.loc && cached.loc.lat === loc.lat && cached.loc.lon === loc.lon && (Date.now() - cached.at) < CACHE_MAX_AGE_MS) {
      currentData = cached.data;
      return;
    }
    const url = `/api/weather?lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lon)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Forecast Request Failed.');
    const data = await resp.json();
    currentData = data;
    saveCache(loc, data);
  }

  async function loadForLocation(loc) {
    setStatus(`Loading Forecast For <strong>${loc.label}</strong>…`);
    daysEl.innerHTML = '';
    detailEl.hidden = true;
    changeLocationBtn.hidden = true;
    try {
      await fetchForecast(loc);
      setStatus(`Showing Forecast For <strong>${loc.label}</strong>`);
      changeLocationBtn.hidden = false;
      selectedDate = null;
      renderDays();
      renderDetail();
    } catch (err) {
      setStatus(`Could Not Load The Forecast For <strong>${loc.label}</strong>. Check Your Connection And Try Again.`);
      changeLocationBtn.hidden = false;
    }
  }

  function showSearch() {
    searchForm.hidden = false;
    searchResultsEl.innerHTML = '';
    searchInput.value = '';
    searchInput.focus();
  }

  function hideSearch() {
    searchForm.hidden = true;
    searchResultsEl.innerHTML = '';
  }

  async function runSearch(query) {
    searchResultsEl.innerHTML = '<p class="modal-note">Searching…</p>';
    try {
      const resp = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      const results = data.results || [];
      if (results.length === 0) {
        searchResultsEl.innerHTML = '<p class="modal-note">No Matching Places Found.</p>';
        return;
      }
      searchResultsEl.innerHTML = '';
      results.forEach(r => {
        const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'weather-search-result';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          const loc = { lat: r.lat, lon: r.lon, label: r.name };
          saveLocation(loc);
          hideSearch();
          loadForLocation(loc);
        });
        searchResultsEl.appendChild(btn);
      });
    } catch {
      searchResultsEl.innerHTML = '<p class="modal-note">Search Failed. Try Again.</p>';
    }
  }

  function tryGeolocation() {
    setStatus('Detecting Your Location…');
    if (!navigator.geolocation) {
      setStatus('Location Access Isn\'t Available In This Browser.');
      showSearch();
      changeLocationBtn.hidden = false;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your Location' };
        saveLocation(loc);
        loadForLocation(loc);
      },
      () => {
        setStatus('Location Access Was Denied — Search For A City Instead.');
        showSearch();
        changeLocationBtn.hidden = false;
      },
      { timeout: 8000 }
    );
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const saved = loadLocation();
    if (saved && saved.lat !== undefined && saved.lon !== undefined) {
      loadForLocation(saved);
    } else {
      tryGeolocation();
    }
  }

  function bind() {
    statusEl = document.getElementById('weather-status');
    daysEl = document.getElementById('weather-days');
    detailEl = document.getElementById('weather-detail');
    searchForm = document.getElementById('weather-search-form');
    searchInput = document.getElementById('weather-search-input');
    searchResultsEl = document.getElementById('weather-search-results');
    changeLocationBtn = document.getElementById('weather-change-location-btn');

    changeLocationBtn.addEventListener('click', () => {
      if (searchForm.hidden) showSearch(); else hideSearch();
    });

    searchForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) runSearch(q);
    });
  }

  function init() {
    bind();
  }

  return { init, ensureLoaded };
})();
