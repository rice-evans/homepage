# homepage

A personal homepage dashboard with:

- **Reminders** — add tasks with optional due date/time, check off or delete, overdue items highlighted.
- **Calendar** — month view, click any day to add/remove events.
- **Quick Links** — editable, drag-to-reorder link tiles with auto-fetched favicons.
- **Roblox account lookup** — enter a username, see everything publicly visible on that account: display name, bio, account creation date, avatar, friend/follower/following counts, groups, badge count, and public experiences. Only uses Roblox's public, unauthenticated APIs — the same data anyone can see by visiting the profile page.

All dashboard data (reminders, calendar events, links) is stored in the browser's `localStorage` — nothing is sent to a server except the Roblox lookup itself.

## Stack

Static HTML/CSS/vanilla JS frontend, plus one serverless function (`api/roblox.js`) that proxies Roblox's API server-side to avoid browser CORS restrictions.

## Local development

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

Then open the printed local URL. The Roblox lookup requires `vercel dev` (or a real Vercel deployment) since it needs the `/api` function — opening `index.html` directly won't run the lookup.

## Deploy

Import this repo into [Vercel](https://vercel.com/new). No environment variables or build step are required — Vercel will detect `index.html` as the static site and `api/roblox.js` as a serverless function automatically.
