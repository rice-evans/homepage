// Vercel serverless function: /api/auth — backs the client-side password
// gate (js/gate.js). Deliberately its own small, isolated function so it
// can never affect the other /api routes: this project already had two
// rounds of the "proper" server-side Routing Middleware approach quietly
// break /api/roblox and /api/chat, so this trades some strength (the page
// shell is technically fetchable before login — see js/gate.js) for
// something that can't take the rest of the site down with it.
//
// GET  /api/auth  -> { enabled }            — is a gate even configured?
// POST /api/auth  { password } -> { enabled, ok }  — check a password
//
// The real password never ships to the browser; only this function ever
// reads SITE_PASSWORD.
module.exports = async function handler(req, res) {
  const password = process.env.SITE_PASSWORD;
  const enabled = !!password;

  if (req.method === 'GET') {
    res.status(200).json({ enabled });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!enabled) {
    res.status(200).json({ enabled: false, ok: true });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const submitted = typeof body?.password === 'string' ? body.password : '';
    res.status(200).json({ enabled: true, ok: submitted === password });
  } catch (err) {
    res.status(400).json({ enabled: true, ok: false, error: 'Malformed Request.' });
  }
};
