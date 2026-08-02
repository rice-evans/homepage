# homepage

A personal homepage dashboard, organized behind a collapsible left sidebar, with:

- **Sidebar navigation** — icon + label nav for Home, Calendar, Notes, Study, Chat, and Roblox lookup. Click/drag the thin strip on the sidebar's right edge to collapse it to icons-only; the state is remembered per browser.
- **Home** — Quick Links (editable, drag-to-reorder tiles with auto-fetched favicons) and Reminders (optional due date/time, check off or delete, overdue items highlighted).
- **Calendar** — full-width month view. Click any day to add an event with a date range; multi-day events render as a continuous bar. Reminders with a due date and Study items with a date both show up here automatically as read-only entries (manage them from their own pages).
- **Notes** — add, edit, and delete freeform notes. Any note can be locked with a PIN: the PIN is hashed (SHA-256) before it's stored, never saved in plain text, and a locked note's body is hidden and can't be edited or deleted until the correct PIN is entered.
- **Study tracker** — a kanban board (Not Started / In Progress / Complete) for study items. Each item can carry a date, time, and duration; drag a card between columns to update its status. Items with a date appear on the Calendar automatically.
- **AI Chat** — a chat panel backed by [Groq](https://groq.com). The API key lives server-side only (see setup below); the browser never sees it.
- **Roblox account lookup** — enter a username, see everything publicly visible on that account. Uses only Roblox's public, unauthenticated APIs.
- **Editable name** — click your name in the greeting to rename it.
- Animated Grainient background and "liquid glass" cards.

## Data storage

Everything (links, reminders, calendar events, notes, study items, display name) lives in the browser's `localStorage` first, so the app always works instantly and offline. It's optionally also mirrored to an Upstash Redis store via `/api/data`, so the same dashboard shows up on every device instead of being stuck in one browser. If no store is attached, that sync step just fails silently (a 501) and the app behaves exactly like a localStorage-only app — nothing breaks.

Chat history and the sidebar's collapsed/expanded state are kept local to each browser only (not synced), so they don't bloat the shared state.

### Enabling cross-device save (optional)

1. In the Vercel dashboard, open this project → **Storage** tab → **Marketplace Database Providers** → **Upstash** → **Upstash for Redis**.
2. Create a database, then **Connect a Project** to this project. Use custom prefix `KV` so the injected variables are named `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the code also accepts the unprefixed `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` names as a fallback, in case Vercel's naming changes again).
3. Redeploy (or it'll pick it up on the next deploy automatically). `/api/data` will start working, and the dashboard will sync across any browser/device you open it from — check by visiting `/api/data` directly; `{"error":"..."}` means it's not connected yet, `null` or JSON data means it's live.

### Enabling AI Chat (Groq)

1. Get an API key from [console.groq.com](https://console.groq.com/keys).
2. In the Vercel dashboard, open this project → **Settings** → **Environment Variables**, and add `GROQ_API_KEY` with your key.
3. (Optional) Add `GROQ_MODEL` to override the default model. Defaults to `openai/gpt-oss-120b`. See [console.groq.com/docs/models](https://console.groq.com/docs/models) for the current lineup — Groq periodically deprecates/replaces models, so check there if chat starts erroring.
4. Redeploy. Until `GROQ_API_KEY` is set, the Chat page shows an inline message telling you it isn't configured yet — nothing else breaks.

## Stack

Static HTML/CSS/vanilla JS frontend, plus three serverless functions:
- `api/roblox.js` — proxies Roblox's API server-side to avoid browser CORS restrictions.
- `api/data.js` — reads/writes the synced dashboard state to Upstash Redis via its REST API (see above).
- `api/chat.js` — proxies chat completions to Groq server-side, so the API key never reaches the browser (see above).

## Local development

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

Then open the printed local URL. The Roblox lookup and AI Chat require `vercel dev` (or a real Vercel deployment) since they need the `/api` functions — opening `index.html` directly won't run them.

## Deploy

Import this repo into [Vercel](https://vercel.com/new). No environment variables or build step are required to get the site live — Vercel will detect `index.html` as the static site and the `api/*.js` files as serverless functions automatically. Cross-device save and AI Chat are both optional (see above).
