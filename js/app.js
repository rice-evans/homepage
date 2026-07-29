// App entry point
document.addEventListener('DOMContentLoaded', () => {
  const greeting = document.getElementById('greeting');
  const clock = document.getElementById('clock');

  function updateClock() {
    const now = new Date();
    const hour = now.getHours();
    const greetText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greeting.textContent = greetText;
    clock.textContent = now.toLocaleString([], {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  updateClock();
  setInterval(updateClock, 1000 * 30);

  Links.init();
  Reminders.init();
  Calendar.init();
  Roblox.init();
});
