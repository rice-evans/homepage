// AI Chat widget — talks to /api/chat, which proxies Groq server-side (see
// api/chat.js) so the API key never touches the browser. History is kept in
// localStorage only (not mirrored via Sync) so it doesn't bloat the shared
// cross-device state; it's a local scratchpad, not dashboard data.
const Chat = (() => {
  const STORAGE_KEY = 'homepage_chat_history';
  const MAX_STORED = 40;
  let sending = false;
  let notConfigured = false;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(messages) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  }

  function setStatus(text, isError) {
    const el = document.getElementById('chat-status');
    if (!text) { el.hidden = true; return; }
    el.textContent = text;
    el.classList.toggle('error', !!isError);
    el.hidden = false;
  }

  function renderMessages(messages, pendingText) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    messages.forEach(m => {
      const bubble = document.createElement('div');
      bubble.className = `chat-msg ${m.role}`;
      bubble.textContent = m.content;
      container.appendChild(bubble);
    });
    if (pendingText) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-msg assistant pending';
      bubble.textContent = pendingText;
      container.appendChild(bubble);
    }
    container.scrollTop = container.scrollHeight;
  }

  function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }

  async function sendMessage(text) {
    if (sending || notConfigured) return;
    sending = true;
    document.getElementById('chat-send-btn').disabled = true;

    const messages = load();
    messages.push({ role: 'user', content: text });
    save(messages);
    renderMessages(messages, 'Thinking…');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 501) {
        notConfigured = true;
        setStatus('AI Chat Isn’t Set Up Yet — Add A GROQ_API_KEY Environment Variable In Vercel To Enable It.', true);
        messages.pop();
        save(messages);
        renderMessages(messages);
        return;
      }

      if (!res.ok) {
        setStatus(data.error || 'Something Went Wrong Talking To Groq.', true);
        renderMessages(messages);
        return;
      }

      setStatus('');
      messages.push({ role: 'assistant', content: data.reply || '(Empty Response)' });
      save(messages);
      renderMessages(messages);
    } catch {
      setStatus('Network Error — Could Not Reach The Server.', true);
      renderMessages(messages);
    } finally {
      sending = false;
      document.getElementById('chat-send-btn').disabled = false;
    }
  }

  function init() {
    const messages = load();
    renderMessages(messages);

    const input = document.getElementById('chat-input');
    input.addEventListener('input', () => autoGrow(input));

    document.getElementById('chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      autoGrow(input);
      sendMessage(text);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-form').requestSubmit();
      }
    });

    document.getElementById('chat-clear-btn').addEventListener('click', () => {
      save([]);
      setStatus('');
      renderMessages([]);
    });

    // Probe configuration once up front so the input doesn't sit there
    // silently failing if GROQ_API_KEY hasn't been added yet.
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [] }) })
      .then(res => {
        if (res.status === 501) {
          notConfigured = true;
          setStatus('AI Chat Isn’t Set Up Yet — Add A GROQ_API_KEY Environment Variable In Vercel To Enable It.', true);
        }
      })
      .catch(() => {});
  }

  return { init };
})();
