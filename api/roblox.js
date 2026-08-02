// Vercel serverless function: GET /api/roblox?username=someuser
// Proxies Roblox's public, unauthenticated APIs (no login/cookie required) and
// aggregates whatever is publicly visible on a user's profile: basic info,
// avatar, friend/follower counts, groups, badge count, and public experiences.
// Nothing here requires or uses Roblox credentials — it only surfaces data
// Roblox already exposes to anyone who visits the profile page.
//
// Two defensive additions on top of the original version:
//  - A browser-like User-Agent header on every outgoing request. Some of
//    Roblox's endpoints are fronted by bot protection that's more likely to
//    challenge/block requests with no User-Agent at all (which is what
//    Node's fetch sends by default) — this is the most common reason a
//    request like this works from a browser but not from a server.
//  - A per-request timeout (8s) via AbortController, so one slow upstream
//    call can't drag the whole function past Vercel's execution limit and
//    have the platform kill it with a non-JSON timeout page instead of us
//    returning a clean JSON error.
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

async function safeFetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { ...DEFAULT_HEADERS, ...(opts.headers || {}) },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  const username = (req.query.username || '').trim();
  if (!username) {
    res.status(400).json({ error: 'Missing "Username" Query Parameter.' });
    return;
  }

  try {
    const resolve = await safeFetchJson('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });

    const match = resolve && resolve.data && resolve.data[0];
    if (!match) {
      res.status(404).json({ error: `No Roblox Account Found For Username "${username}". (If This Keeps Happening For A Username You Know Exists, Roblox May Be Rate-Limiting This Server — Try Again In A Minute.)` });
      return;
    }
    const userId = match.id;

    const [
      userInfo,
      avatarThumb,
      avatarHeadshot,
      friendsCount,
      followersCount,
      followingCount,
      groups,
      badges,
      games,
      favoriteGames
    ] = await Promise.all([
      safeFetchJson(`https://users.roblox.com/v1/users/${userId}`),
      safeFetchJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
      safeFetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`),
      safeFetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      safeFetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      safeFetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      safeFetchJson(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
      safeFetchJson(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc`),
      safeFetchJson(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50`),
      // Favorites are only visible when the account's "favorites" privacy is
      // public — Roblox will 401/403 this otherwise, which safeFetchJson
      // just turns into null, and we show nothing rather than an error.
      safeFetchJson(`https://games.roblox.com/v2/users/${userId}/favorite/games?limit=50`)
    ]);

    res.status(200).json({
      userId,
      username: userInfo?.name || match.name,
      displayName: userInfo?.displayName || match.displayName,
      description: userInfo?.description || '',
      created: userInfo?.created || null,
      isBanned: !!userInfo?.isBanned,
      avatarImage: avatarThumb?.data?.[0]?.imageUrl || null,
      avatarHeadshot: avatarHeadshot?.data?.[0]?.imageUrl || null,
      friendsCount: friendsCount?.count ?? null,
      followersCount: followersCount?.count ?? null,
      followingCount: followingCount?.count ?? null,
      groups: (groups?.data || []).map(g => ({
        name: g.group?.name,
        id: g.group?.id,
        role: g.role?.name,
        memberCount: g.group?.memberCount
      })),
      badgeCount: badges?.data?.length ?? null,
      badges: (badges?.data || []).slice(0, 20).map(b => ({
        id: b.id,
        name: b.name,
        description: b.description
      })),
      games: (games?.data || []).map(g => ({
        name: g.name,
        placeId: g.rootPlaceId,
        playing: g.playing,
        visits: g.visits
      })),
      favoriteGames: (favoriteGames?.data || []).map(g => ({
        name: g.name,
        placeId: g.rootPlaceId ?? g.placeId,
        visits: g.visits
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed To Fetch Roblox Data.', detail: err.message });
  }
};
