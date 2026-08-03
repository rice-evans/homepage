// Weather — thin proxy over Open-Meteo (free, no API key). Two modes,
// selected by query string:
//   ?lat=..&lon=..            -> 7-day forecast + current conditions
//   ?q=<city name>            -> geocoding search (list of matching places)
// Proxying server-side keeps all "what shape does Open-Meteo return" logic
// in one place, and sidesteps any client CORS/User-Agent friction.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 8000;

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchJSON(url) {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal, headers: { 'User-Agent': 'homepage-dashboard/1.0' } });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    cancel();
  }
}

function pick(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return fallback;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { lat, lon, q } = req.query || {};

  try {
    if (q) {
      const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
      const { ok, status, json } = await fetchJSON(url);
      if (!ok || !json) {
        res.status(502).json({ error: 'Geocoding Lookup Failed.', upstreamStatus: status });
        return;
      }
      const results = (json.results || []).map(r => ({
        name: r.name,
        admin1: r.admin1 || '',
        country: r.country || '',
        lat: r.latitude,
        lon: r.longitude
      }));
      res.status(200).json({ results });
      return;
    }

    if (lat === undefined || lon === undefined) {
      res.status(400).json({ error: 'Provide Either "q" (City Search) Or "lat" & "lon".' });
      return;
    }

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      forecast_days: '7',
      timezone: 'auto'
    });
    const url = `${FORECAST_URL}?${params.toString()}`;
    const { ok, status, json } = await fetchJSON(url);
    if (!ok || !json) {
      res.status(502).json({ error: 'Forecast Lookup Failed.', upstreamStatus: status });
      return;
    }

    const daily = json.daily || {};
    const dailyUnits = json.daily_units || {};
    const hourly = json.hourly || {};
    const current = json.current || json.current_weather || {};

    const dates = pick(daily, ['time'], []);
    const days = dates.map((date, i) => ({
      date,
      code: pick(daily, ['weather_code', 'weathercode'], [])[i],
      tempMax: pick(daily, ['temperature_2m_max'], [])[i],
      tempMin: pick(daily, ['temperature_2m_min'], [])[i],
      feelsMax: pick(daily, ['apparent_temperature_max'], [])[i],
      feelsMin: pick(daily, ['apparent_temperature_min'], [])[i],
      precipSum: pick(daily, ['precipitation_sum'], [])[i],
      precipChance: pick(daily, ['precipitation_probability_max'], [])[i],
      windMax: pick(daily, ['wind_speed_10m_max'], [])[i],
      sunrise: pick(daily, ['sunrise'], [])[i],
      sunset: pick(daily, ['sunset'], [])[i],
      uvMax: pick(daily, ['uv_index_max'], [])[i],
      hourlyTemps: (hourly.time || [])
        .map((t, hi) => ({ time: t, temp: (hourly.temperature_2m || [])[hi], precipChance: (hourly.precipitation_probability || [])[hi], code: (hourly.weather_code || [])[hi] }))
        .filter(h => h.time && h.time.slice(0, 10) === date)
    }));

    res.status(200).json({
      timezone: json.timezone || 'auto',
      units: {
        temperature: pick(dailyUnits, ['temperature_2m_max'], '°C'),
        wind: pick(dailyUnits, ['wind_speed_10m_max'], 'km/h'),
        precipitation: pick(dailyUnits, ['precipitation_sum'], 'mm')
      },
      current: {
        temp: pick(current, ['temperature_2m', 'temperature'], null),
        feelsLike: pick(current, ['apparent_temperature'], null),
        humidity: pick(current, ['relative_humidity_2m'], null),
        code: pick(current, ['weather_code', 'weathercode'], null),
        windSpeed: pick(current, ['wind_speed_10m', 'windspeed'], null),
        isDay: pick(current, ['is_day'], 1)
      },
      days
    });
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    res.status(timedOut ? 504 : 500).json({ error: timedOut ? 'Weather Lookup Timed Out.' : 'Unexpected Weather Error.' });
  }
};
