// Shared confetti effects, no libraries. Two flavors:
//  - burst(x, y): a handful of pieces flying out from a point (used by
//    Reminders when you check something off).
//  - rain(): a fuller shower falling from the top of the screen (used by
//    Study when an item is marked Complete).
const Confetti = (() => {
  const COLORS = ['#7fa8ff', '#3ecf8e', '#ff5c5c', '#ffd166', '#f4a6ff', '#c792ea'];

  function burst(x, y) {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${x}px`;
      piece.style.top = `${y}px`;
      piece.style.background = COLORS[i % COLORS.length];

      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 30;
      const rot = `${Math.random() * 720 - 360}deg`;

      piece.style.setProperty('--dx', `${dx}px`);
      piece.style.setProperty('--dy', `${dy}px`);
      piece.style.setProperty('--rot', rot);

      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
      setTimeout(() => piece.remove(), 1200);
    }
  }

  function rain() {
    const count = 70;
    const vh = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-rain-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = COLORS[i % COLORS.length];
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;

      const rot = `${Math.random() * 720 - 360}deg`;
      piece.style.setProperty('--fall-distance', `${vh + 40}px`);
      piece.style.setProperty('--rot', rot);

      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
      setTimeout(() => piece.remove(), 3200);
    }
  }

  return { burst, rain };
})();
