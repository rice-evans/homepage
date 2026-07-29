// GET/POST /api/data — reads/writes the whole dashboard state (links,
// reminders, calendar events, display name) as one JSON blob in Vercel KV,
// so it's the same on every device instead of trapped in one browser.
//
// Requires a KV store attached to the Vercel project (Storage tab -> Create
// Database -> KV -> Connect to Project). That injects KV_REST_API_URL and
// KV_REST_API_TOKEN automatically — no other setup needed. Until that's
// done, this returns 501 and the frontend just falls back to localStorage
// only, exactly like before.
const STORE_KEY = 'homepage:state';

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Upstash's REST API (which powers Vercel KV) accepts commands as a JSON
// array posted to the store's base URL — e.g. ["GET", "key"] or
// ["SET", "key", "value"]. See https://upstash.com/docs/redis/features/restapi
async function kvCommand(command) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  return res.json();
}

module.exports = async function handler(req, res) {
  if (!kvConfigured()) {
    res.status(501).json({ error: 'No Vercel KV store connected to this project yet.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await kvCommand(['GET', STORE_KEY]);
      const value = result && result.result ? JSON.parse(result.result) : null;
      res.status(200).json(value);
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      await kvCommand(['SET', STORE_KEY, JSON.stringify(body)]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'KV request failed.', detail: err.message });
  }
};
