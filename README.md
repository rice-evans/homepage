# homepage

A personal homepage dashboard with:

- **Reminders** — add tasks with an optional due date/time, check off or delete, overdue items highlighted. Reminders with a due date also show up on the Calendar automatically (as a read-only entry — manage them from Reminders).
- **Calendar** — full-width month view. Click any day to add an event with a date range; multi-day events render as a continuous bar spanning the days they cover, with overlapping events stacking into separate rows.
- **Quick Links** — editable, drag-to-reorder link tiles with auto-fetched favicons.
- **Roblox account lookup** — enter a username, see everything publicly visible on that account: display name, bio, account creation date, avatar, friend/follower/following counts, groups (two-column, with role), badge count, public experiences, and favourited experiences (when that's public on the account). Only uses Roblox's public, unauthenticated APIs — the same data anyone can see by visiting the profile page.
- **Editable name** — click your name in the greeting to rename it.
- Animated Grainient background and "liquid glass" cards.

## Data storage

Everything lives in the browser's `localStorage` first, so the app always works instantly and offline. It's optionally also mirrored to an Upstash Redis store via `/api/data`, so the same dashboard shows up on every device instead of being stuck in one browser. If no store is attached, that sync step just fails silently (a 501) and the app behaves exactly like a localStorage-only app — nothing breaks.

### Enabling cross-device save (optional)

1. In the Vercel dashboard, open this project → **Storage** tab → **Marketplace Database Providers** → **Upstash** → **Upstash for Redis**.
2. Create a database, then **Connect a Project** to this project. Use custom prefix `KV` so the injected variables are named `KV_REST_API_URL` / `KV_REST_API_TOKEN` (the code also accepts the unprefixed `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` names as a fallback, in case Vercel's naming changes again).
3. Redeploy (or it'll pick it up on the next deploy automatically). `/api/data` will start working, and the dashboard will sync across any browser/device you open it from — check by visiting `/api/data` directly; `{"error":"..."}` means it's not connected yet, `null` or JSON data means it's live.

## Stack

Static HTML/CSS/vanilla JS frontend, plus two serverless functions:
- `api/roblox.js` — proxies Roblox's API server-side to avoid browser CORS restrictions.
- `api/data.js` — reads/writes the synced dashboard state to Upstash Redis via its REST API (see above).

## Local development

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

Then open the printed local URL. The Roblox lookup requires `vercel dev` (or a real Vercel deployment) since it needs the `/api` functions — opening `index.html` directly won't run it.

## Deploy

Import this repo into [Vercel](https://vercel.com/new). No environment variables or build step are required to get the site live — Vercel will detect `index.html` as the static site and the `api/*.js` files as serverless functions automatically. Cross-device save is optional (see above).
