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
//
// The request body can also include a `context` array of { question,
// answer } pairs (managed from the gear icon in the chat panel) — these get
// folded into the system prompt so the assistant has that background
// information available when replying.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const SYSTEM_PROMPT = 'You Are A Helpful, Concise Assistant Embedded In A Personal Homepage Dashboard. Keep Answers Brief Unless Asked For Detail.';
const MAX_HISTORY = 20;
const MAX_CONTEXT_ITEMS = 30;

// Groq's requests-per-day usage, read straight off the response headers (see
// https://console.groq.com/docs/rate-limits) — present on every response,
// success or failure, so the frontend can render a "daily usage" bar.
function extractUsage(headers) {
  const limit = headers.get('x-ratelimit-limit-requests');
  const remaining = headers.get('x-ratelimit-remaining-requests');
  const reset = headers.get('x-ratelimit-reset-requests');
  if (limit === null || remaining === null) return null;
  return {
    limitRequests: Number(limit),
    remainingRequests: Number(remaining),
    resetRequests: reset || null
  };
}

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
    const incomingContext = Array.isArray(body?.context) ? body.context : [];

    const messages = incoming
      .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));

    if (messages.length === 0) {
      res.status(400).json({ error: 'No Valid Messages Provided.' });
      return;
    }

    const contextPairs = incomingContext
      .filter(c => c && typeof c.question === 'string' && typeof c.answer === 'string')
      .slice(0, MAX_CONTEXT_ITEMS)
      .map(c => `Q: ${c.question.slice(0, 500)}\nA: ${c.answer.slice(0, 1500)}`);

    const systemPrompt = contextPairs.length
      ? `${SYSTEM_PROMPT}\n\nBackground information you can use when relevant:\n${contextPairs.join('\n\n')}`
      : SYSTEM_PROMPT;

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const usage = extractUsage(groqRes.headers);

    // Groq normally returns JSON even on errors, but if something upstream
    // (a proxy, a 5xx from an edge node, etc.) returns plain text/HTML
    // instead, don't let that throw and produce an opaque 500 — read it as
    // text and surface it so the real problem is visible in the UI.
    const rawText = await groqRes.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      // not JSON — data stays null, handled below
    }

    if (!groqRes.ok) {
      const message = data?.error?.message
        || (rawText ? rawText.slice(0, 300) : null)
        || `Groq Returned HTTP ${groqRes.status} With No Details.`;
      res.status(groqRes.status).json({ error: message, usage });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content || '';
    res.status(200).json({ reply, usage });
  } catch (err) {
    res.status(500).json({ error: 'Chat Request Failed.', detail: err.message });
  }
};
