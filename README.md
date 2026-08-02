# homepage

A personal homepage dashboard, organized behind a collapsible left sidebar, with:

- **Sidebar navigation** — icon + label nav for Dashboard, Calendar, Notes, Study, and Roblox lookup. Click the thin strip on the sidebar's right edge to collapse it to icons-only; the state is remembered per browser (and defaults to collapsed the first time it's opened on a phone-sized screen).
- **Settings** — gear button at the bottom of the sidebar opens a small panel to recolor the animated background live, with a one-click reset.
- **Home** — Quick Links (editable, drag-to-reorder tiles with auto-fetched favicons) and Reminders (optional due date/time, check off or delete, overdue items highlighted, confetti burst on completion).
- **Calendar** — full-width month view. Click any day to add an event with a date range; multi-day events render as a continuous bar. Reminders with a due date and Study items with a date both show up here automatically as read-only entries (manage them from their own pages).
- **Notes** — add, edit, and soft-delete freeform notes. Any note can be locked with a PIN (SHA-256 hashed, never stored in plain text) — a locked note's body is hidden and can't be edited until the correct PIN is entered. Deleting a note moves it into a collapsible **Deleted** section at the bottom (lock state preserved) instead of destroying it — restore it or delete it for good from there.
- **Study tracker** — a kanban board (Not Started / In Progress / Complete) for study items. Each item can carry a date, time, and duration; drag a card between columns to update its status. Marking an item Complete (by drag or via the modal) rains confetti. Deleting an item moves it into a collapsible **Deleted** section the same way Notes does — restore puts it back in its original column, or delete it for good. Items with a date appear on the Calendar automatically.
- **AI Chat** — a small floating chat button (bottom-right) available on every page, backed by [Groq](https://groq.com). The info icon inside the chat panel lets you add Question/Answer "context" pairs the assistant should know about — these are sent along with every message. A thin bar along the bottom of the panel shows how much of Groq's daily request quota is used. The API key lives server-side only (see setup below); the browser never sees it.
- **Roblox account lookup** — enter a username, see everything publicly visible on that account. Uses only Roblox's public, unauthenticated APIs.
- **Editable name** — click your name in the greeting to rename it.
- Date fields show their placeholder in capitals and can't take a year longer than 4 digits. Animated Grainient background and "liquid glass" cards.

## Data storage

Everything that's genuinely "your data" (links, reminders, calendar events, notes, study items, display name) lives in the browser's `localStorage` first, so the app always works instantly and offline. It's optionally also mirrored to an Upstash Redis store via `/api/data`, so the same dashboard shows up on every device instead of being stuck in one browser. If no store is attached, that sync step just fails silently (a 501) and the app behaves exactly like a localStorage-only app — nothing breaks.

Chat history, chat context, the sidebar's collapsed state, and the background color theme are kept local to each browser only (not synced) — they're display/device preferences, not shared dashboard data.

### Enabling cross-device save (optional)

1. In the Vercel dashboard, open this project → **Storage** tab → **Marketplace Database Providers** → **Upstash** → **Upstash for Redis**.
2. Create a database, then **Connect a Project** to this project. Use custom prefix `KV` so the injected variables are named `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the code also accepts the unprefixed `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` names as a fallback, in case Vercel's naming changes again).
3. Redeploy (or it'll pick it up on the next deploy automatically). `/api/data` will start working, and the dashboard will sync across any browser/device you open it from — check by visiting `/api/data` directly; `{"error":"..."}` means it's not connected yet, `null` or JSON data means it's live.

### Enabling AI Chat (Groq)

1. Get an API key from [console.groq.com](https://console.groq.com/keys).
2. In the Vercel dashboard, open this project → **Settings** → **Environment Variables**, and add `GROQ_API_KEY` with your key.
3. (Optional) Add `GROQ_MODEL` to override the default model. Defaults to `openai/gpt-oss-120b`. Check [console.groq.com/docs/models](https://console.groq.com/docs/models) if chat starts erroring — Groq periodically retires older models (`llama-3.3-70b-versatile`, for example, is being retired 08/16/26).
4. Redeploy. Until `GROQ_API_KEY` is set, opening the chat button shows an inline message telling you it isn't configured yet — nothing else breaks.

If chat or the Roblox lookup show an error, the message includes the actual HTTP status/detail instead of a generic one — check that text first, then the **Vercel Dashboard → your project → Logs** for the full server-side error. If you ever see a raw "NOT_FOUND" page (not this app's own error text) for `/api/chat` or `/api/roblox`, that means Vercel isn't finding a deployed function for that route at all — check the deployment's **Functions** tab lists `data`, `roblox`, and `chat`, and that the latest commit actually deployed (Vercel dashboard → Deployments → confirm the top one matches your latest push and shows "Ready", not a failed build).

## Stack

Static HTML/CSS/vanilla JS frontend, plus three serverless functions:
- `api/roblox.js` — proxies Roblox's API server-side to avoid browser CORS restrictions. Sends a browser-like User-Agent and times out each upstream call at 8s so a slow/blocked Roblox endpoint can't take the whole request down with it.
- `api/data.js` — reads/writes the synced dashboard state to Upstash Redis via its REST API (see above).
- `api/chat.js` — proxies chat completions (plus any Q&A context) to Groq server-side, so the API key never reaches the browser (see above).

## Local development

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

Then open the printed local URL. The Roblox lookup and AI Chat require `vercel dev` (or a real Vercel deployment) since they need the `/api` functions — opening `index.html` directly won't run them.

## Deploy

Import this repo into [Vercel](https://vercel.com/new). No environment variables or build step are required to get the site live — Vercel will detect `index.html` as the static site and the `api/*.js` files as serverless functions automatically. Cross-device save and AI Chat are both optional (see above).

## A note on the password gate

An earlier version of this project added an optional password screen via Vercel Routing Middleware (`middleware.js`, gated behind a `SITE_PASSWORD` env var). It's been removed: getting that file's module format (`.mjs`/`.cjs`/`"type": "module"`) right alongside the plain `/api` functions took two attempts and ended up breaking `/api/roblox` and `/api/chat` entirely (both returned Vercel's platform `NOT_FOUND`, not an app error) rather than just gating the page. Given that trade-off, the safer choice was to pull it out and restore the plain, working `/api` setup. If you still want a password gate, it's worth doing as an isolated follow-up (and testing on a preview deployment before it touches production) rather than bundled in with everything else.
