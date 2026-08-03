// GET/POST /api/data — reads/writes the whole dashboard state (links,
// reminders, calendar events, display name) as one JSON blob in an Upstash
// Redis store, so it's the same on every device instead of trapped in one
// browser.
//
// Requires an Upstash database attached to the Vercel project (Storage tab
// -> Marketplace Database Providers -> Upstash -> Connect to Project — NOT
// the plain "Redis" tile, which uses a different, non-REST connection).
// That injects either KV_REST_API_URL/KV_REST_API_TOKEN or
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN depending on how the
// integration names things — this checks both so either works. Until one is
// connected, this returns 501 and the frontend just falls back to
// localStorage only, exactly like before.
const STORE_KEY = 'homepage:state';

function kvCreds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

// Upstash's REST API accepts commands as a JSON array posted to the store's
// base URL — e.g. ["GET", "key"] or ["SET", "key", "value"].
// See https://upstash.com/docs/redis/features/restapi
async function kvCommand(command) {
  const creds = kvCreds();
  const res = await fetch(creds.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  return res.json();
}

module.exports = async function handler(req, res) {
  if (!kvCreds()) {
    res.status(501).json({ error: 'No Upstash Store Connected To This Project Yet.' });
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

    res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    res.status(500).json({ error: 'KV Request Failed.', detail: err.message });
  }
};
