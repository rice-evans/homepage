// Vercel Routing Middleware — gates every request behind a single password
// screen when SITE_PASSWORD is set as an environment variable. Runs before
// any static file or /api function is served, so it protects the whole app
// (not just a client-side overlay someone could bypass in devtools).
//
// If SITE_PASSWORD isn't set, this is a no-op (fails open) — same "optional,
// nothing breaks until configured" pattern as /api/data.js and /api/chat.js.
//
// This file must stay ES modules (import/export) per Vercel's Routing
// Middleware requirements for non-framework projects — hence the .mjs
// extension rather than .js, so it doesn't collide with the CommonJS
// (`module.exports`) style used by the plain serverless functions in api/.
import { next } from '@vercel/functions';

const COOKIE_NAME = 'homepage_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Same gradient the app itself shows as the CSS fallback before the animated
// WebGL background kicks in (see #grainient-bg in css/style.css), so the
// gate looks like part of the same site rather than a bolted-on login page.
function gatePage({ error } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Home</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #000000 0%, #3d4249 55%, #94a3b8 100%);
    color: #e7ebf0;
  }
  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 320px;
    padding: 0 20px;
  }
  input {
    width: 100%;
    height: 46px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #e7ebf0;
    border-radius: 10px;
    padding: 0 14px;
    font-size: 16px;
    text-align: center;
    backdrop-filter: blur(12px);
  }
  input::placeholder { color: #aab2c0; }
  input:focus { outline: none; border-color: #7fa8ff; }
  p.error { color: #ff5c5c; font-size: 13px; margin: 0; min-height: 16px; }
</style>
</head>
<body>
  <form method="POST" action="/">
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" required>
    <p class="error">${error ? 'Incorrect Password.' : ''}</p>
  </form>
</body>
</html>`;
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next();

  const expected = await sha256Hex(password);
  const cookieVal = getCookie(request, COOKIE_NAME);
  if (cookieVal === expected) return next();

  if (request.method === 'POST') {
    let submitted = '';
    try {
      const form = await request.formData();
      submitted = String(form.get('password') || '');
    } catch {
      // Malformed body — fall through and re-show the gate.
    }

    if (submitted === password) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/',
          'Set-Cookie': `${COOKIE_NAME}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`
        }
      });
    }
    return new Response(gatePage({ error: true }), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  return new Response(gatePage(), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}
