// Vercel serverless function: POST /api/chat — proxies chat completions to
// Groq (https://groq.com) so the API key never reaches the browser.
//
// Requires a GROQ_API_KEY environment variable on the Vercel project
// (Project Settings -> Environment Variables). Optionally set GROQ_MODEL to
// override the model (defaults to openai/gpt-oss-120b — Groq's current
// recommended general-purpose production model as of August 2026; see
// https://console.groq.com/docs/models for the latest lineup).
//
// Until GROQ_API_KEY is set, this returns 501 and the frontend shows an
// inline "not configured" message instead of erroring out.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const SYSTEM_PROMPT = 'You Are A Helpful, Concise Assistant Embedded In A Personal Homepage Dashboard. Keep Answers Brief Unless Asked For Detail.';
const MAX_HISTORY = 20;

module.exports = async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: 'GROQ_API_KEY Is Not Configured On This Project Yet.' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const incoming = Array.isArray(body?.messages) ? body.messages : [];

    const messages = incoming
      .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));

    if (messages.length === 0) {
      res.status(400).json({ error: 'No Valid Messages Provided.' });
      return;
    }

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      res.status(groqRes.status).json({ error: data?.error?.message || 'Groq Request Failed.' });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content || '';
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Chat Request Failed.', detail: err.message });
  }
};
