// Vercel serverless function: GET /api/roblox?username=someuser
// Proxies Roblox's public, unauthenticated APIs (no login/cookie required) and
// aggregates whatever is publicly visible on a user's profile: basic info,
// avatar, friend/follower counts, groups, badge count, and public experiences.
// Nothing here requires or uses Roblox credentials — it only surfaces data
// Roblox already exposes to anyone who visits the profile page.

async function safeFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const username = (req.query.username || '').trim();
  if (!username) {
    res.status(400).json({ error: 'Missing "username" query parameter.' });
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
      res.status(404).json({ error: `No Roblox account found for username "${username}".` });
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
    res.status(500).json({ error: 'Failed to fetch Roblox data.', detail: err.message });
  }
};
