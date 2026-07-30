// Roblox account lookup widget — calls /api/roblox which proxies Roblox's public APIs
const Roblox = (() => {
  function fmtDate(iso) {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fmtNum(n) {
    return typeof n === 'number' ? n.toLocaleString() : '—';
  }

  function render(data) {
    const el = document.getElementById('roblox-result');
    el.classList.add('visible');

    const groupsHtml = (data.groups || []).length
      ? `<div class="rbx-group-list">${data.groups.map(g => `
          <div class="rbx-group-row">
            <span class="rbx-group-name">${escapeHtml(g.name)}</span>
            <span class="rbx-group-role">${escapeHtml(g.role)}</span>
          </div>`).join('')}</div>`
      : '<p style="color:var(--text-dim);font-size:13px;">No Public Groups.</p>';

    const gamesHtml = (data.games || []).length
      ? `<div class="rbx-tags">${data.games.map(g => `<span class="rbx-tag">${escapeHtml(g.name)} (${fmtNum(g.visits)} visits)</span>`).join('')}</div>`
      : '<p style="color:var(--text-dim);font-size:13px;">No Public Experiences.</p>';

    const favoriteGamesHtml = (data.favoriteGames || []).length
      ? `<div class="rbx-tags">${data.favoriteGames.map(g => `<span class="rbx-tag">${escapeHtml(g.name)}</span>`).join('')}</div>`
      : '<p style="color:var(--text-dim);font-size:13px;">No Public Favourites (Or Favourites Are Private).</p>';

    el.innerHTML = `
      <div class="rbx-header">
        <img src="${data.avatarHeadshot || data.avatarImage || ''}" alt="avatar">
        <div>
          <div class="rbx-name">${escapeHtml(data.displayName || data.username)}${data.isBanned ? ' ⚠️ (Terminated)' : ''}</div>
          <div class="rbx-username">@${escapeHtml(data.username)} · ID ${data.userId}</div>
          <a href="https://www.roblox.com/users/${data.userId}/profile" target="_blank" rel="noopener noreferrer">View Profile On Roblox →</a>
        </div>
      </div>
      <div class="rbx-stats">
        <div class="rbx-stat"><div class="val">${fmtNum(data.friendsCount)}</div><div class="label">Friends</div></div>
        <div class="rbx-stat"><div class="val">${fmtNum(data.followersCount)}</div><div class="label">Followers</div></div>
        <div class="rbx-stat"><div class="val">${fmtNum(data.followingCount)}</div><div class="label">Following</div></div>
        <div class="rbx-stat"><div class="val">${fmtNum(data.badgeCount)}</div><div class="label">Badges</div></div>
      </div>
      <div class="rbx-section">
        <h4>Account Created</h4>
        <p>${fmtDate(data.created)}</p>
      </div>
      <div class="rbx-section">
        <h4>Bio</h4>
        <div class="rbx-desc">${escapeHtml(data.description) || '<span style="color:var(--text-dim)">No Bio Set.</span>'}</div>
      </div>
      <div class="rbx-section">
        <h4>Groups</h4>
        ${groupsHtml}
      </div>
      <div class="rbx-section">
        <h4>Public Experiences</h4>
        ${gamesHtml}
      </div>
      <div class="rbx-section">
        <h4>Favourited Experiences</h4>
        ${favoriteGamesHtml}
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    const form = document.getElementById('roblox-form');
    const status = document.getElementById('roblox-status');
    const result = document.getElementById('roblox-result');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('roblox-username').value.trim();
      if (!username) return;

      result.classList.remove('visible');
      result.innerHTML = '';
      status.textContent = 'Looking Up...';

      try {
        const res = await fetch(`/api/roblox?username=${encodeURIComponent(username)}`);
        const data = await res.json();

        if (!res.ok) {
          status.innerHTML = `<span class="rbx-error">${escapeHtml(data.error || 'Lookup Failed.')}</span>`;
          return;
        }

        status.textContent = '';
        render(data);
      } catch (err) {
        status.innerHTML = `<span class="rbx-error">Network Error — Is This Running On Vercel (Or "Vercel Dev")? The Lookup Needs The /api Function.</span>`;
      }
    });
  }

  return { init };
})();
