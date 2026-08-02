# homepage

A personal homepage dashboard, organized behind a collapsible left sidebar, with:

- **Sidebar navigation** — icon + label nav for Dashboard, Calendar, Notes, Study, and Roblox lookup. Click the thin strip on the sidebar's right edge to collapse it to icons-only; the state is remembered per browser (and defaults to collapsed the first time it's opened on a phone-sized screen).
- **Settings** — gear button at the bottom of the sidebar opens a small panel to recolor the animated background live, with a one-click reset.
- **Logout** — next to Settings; clears the password-gate session (see below) and returns to the login screen. Turns red on hover.
- **Home** — Quick Links (editable, drag-to-reorder tiles with auto-fetched favicons) and Reminders (optional due date/time, check off or delete, overdue items highlighted, confetti burst on completion).
- **Calendar** — full-width month view. Click any day to add an event with a date range; multi-day events render as a continuous bar. Reminders with a due date and Study items with a date both show up here automatically as read-only entries (manage them from their own pages).
- **Notes** — add, edit, and soft-delete freeform notes. Any note can be locked with a PIN (SHA-256 hashed, never stored in plain text) — a locked note's body is hidden and can't be edited until the correct PIN is entered. Deleting a note moves it into a collapsible **Deleted** section at the bottom (lock state preserved) instead of destroying it — restore it or delete it for good from there.
- **Study tracker** — a kanban board (Not Started / In Progress / Complete) for study items. Each item can carry a date, time, and duration; drag a card between columns to update its status. Marking an item Complete (by drag or via the modal) rains confetti. Deleting an item moves it into a collapsible **Deleted** section the same way Notes does — restore puts it back in its original column, or delete it for good. Items with a date appear on the Calendar automatically.
- **AI Chat** — a small floating chat button (bottom-right) available on every page, backed by [Groq](https://groq.com). The gear icon inside the chat panel lets you add Question/Answer "context" pairs the assistant should know about — these are sent along with every message. The API key lives server-side only (see setup below); the browser never sees it.
- **Roblox account lookup** — enter a username, see everything publicly visible on that account. Uses only Roblox's public, unauthenticated APIs.
- **Editable name** — click your name in the greeting to rename it.
- **Password gate (optional)** — if `SITE_PASSWORD` is set, every request to the site is gated behind a single password screen (see setup + troubleshooting below) before anything else loads.
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

### Enabling the password gate (optional)

1. In the Vercel dashboard, open this project → **Settings** → **Environment Variables**, and add `SITE_PASSWORD` with whatever password you want. Make sure it's added for the **Production** environment (and Preview/Development too, if you want it gated there as well).
2. **Redeploy** — environment variable changes only take effect on the next deployment, they don't apply retroactively to a deployment that's already running.
3. Every request — the page itself, its scripts, and the `/api/*` endpoints — now gets redirected to a single password screen (`middleware.js`, using [Vercel Routing Middleware](https://vercel.com/docs/routing-middleware)) until the right password is entered once; a session cookie (valid 30 days) remembers you after that. The sidebar's **Log Out** button clears that cookie.
4. Leave `SITE_PASSWORD` unset and the gate simply doesn't run — same opt-in pattern as the other integrations.

**If the password screen isn't showing up after setting `SITE_PASSWORD`:**
- Confirm you redeployed *after* adding the variable — check the deployment's **Source** files (or the **Functions** tab) in the Vercel dashboard and look for `middleware.js` listed as Routing Middleware. If it's not there, the deploy predates the file being added — redeploy again.
- Double-check the variable is named exactly `SITE_PASSWORD` and is enabled for the environment you're actually visiting (Production vs. Preview).
- Hard-refresh / try an incognito window — if you'd visited before the gate was enabled, an old cached page could still be showing.
- Check **Vercel Dashboard → your project → Logs** for errors from the middleware while you reload the page.

Note on the security model: this is a single shared password for a personal site, not a full auth system — good enough to keep casual visitors and search engines out, not intended to protect genuinely sensitive data.

## Stack

Static HTML/CSS/vanilla JS frontend, plus:
- `middleware.js` — optional password gate (and `/logout`), runs on every request (see above). Uses ES modules, which is why `package.json` has `"type": "module"`.
- `api/roblox.cjs` — proxies Roblox's API server-side to avoid browser CORS restrictions.
- `api/data.cjs` — reads/writes the synced dashboard state to Upstash Redis via its REST API (see above).
- `api/chat.cjs` — proxies chat completions (plus any Q&A context) to Groq server-side, so the API key never reaches the browser (see above).

The `api/*` functions use the `.cjs` extension (rather than `.js`) so they keep loading as CommonJS (`module.exports`) even though `middleware.js` needs the project set to `"type": "module"` for its `import` syntax.

## Local development

```bash
npm install
npm install -g vercel   # if you don't have it
vercel dev
```

Then open the printed local URL. The Roblox lookup and AI Chat require `vercel dev` (or a real Vercel deployment) since they need the `/api` functions — opening `index.html` directly won't run them. To test the password gate locally, add `SITE_PASSWORD` to a `.env` file (or run `vercel env pull` after setting it in the dashboard).

## Deploy

Import this repo into [Vercel](https://vercel.com/new). No build step is required — Vercel detects `index.html` as the static site, `api/*.cjs` as serverless functions, and `middleware.js` as Routing Middleware automatically. Cross-device save, AI Chat, and the password gate are all optional (see above).
