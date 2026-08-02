// AI Chat widget — a small floating button (bottom-right) that opens a chat
// popup, available from every page rather than being its own sidebar view.
// Talks to /api/chat, which proxies Groq server-side (see api/chat.cjs) so
// the API key never touches the browser. History is kept in localStorage
// only (not mirrored via Sync) so it doesn't bloat the shared cross-device
// state; it's a local scratchpad, not dashboard data.
//
// The gear icon in the panel header opens a "Chat Context" modal where you
// can add Question/Answer pairs — background info the AI should know about
// (e.g. "Q: What's my Roblox username? A: ..."). These are sent along with
// every request so the assistant can use them when replying.
const Chat = (() => {
  const STORAGE_KEY = 'homepage_chat_history';
  const CONTEXT_KEY = 'homepage_chat_context';
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

  function loadContext() {
    try {
      const data = JSON.parse(localStorage.getItem(CONTEXT_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveContext(items) {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(items));
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
        body: JSON.stringify({ messages, context: loadContext() })
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

  function openPanel() {
    document.getElementById('chat-panel').hidden = false;
    document.getElementById('chat-input').focus();
  }

  function closePanel() {
    document.getElementById('chat-panel').hidden = true;
  }

  // ---------- context (Q&A) modal ----------

  function renderContextList() {
    const list = document.getElementById('chat-context-list');
    list.innerHTML = '';
    const items = loadContext();
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'modal-note';
      empty.textContent = 'No Context Added Yet.';
      list.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'context-item';

      const inner = document.createElement('div');
      inner.className = 'context-item-row';

      const text = document.createElement('div');
      const q = document.createElement('div');
      q.className = 'context-item-q';
      q.textContent = item.question;
      const a = document.createElement('div');
      a.className = 'context-item-a';
      a.textContent = item.answer;
      text.appendChild(q);
      text.appendChild(a);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn';
      del.title = 'Remove';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        saveContext(loadContext().filter(x => x.id !== item.id));
        renderContextList();
      });

      inner.appendChild(text);
      inner.appendChild(del);
      row.appendChild(inner);
      list.appendChild(row);
    });
  }

  function openContextModal() {
    renderContextList();
    document.getElementById('chat-context-modal').hidden = false;
  }

  function closeContextModal() {
    document.getElementById('chat-context-modal').hidden = true;
  }

  function init() {
    const messages = load();
    renderMessages(messages);

    document.getElementById('chat-fab').addEventListener('click', () => {
      const panel = document.getElementById('chat-panel');
      panel.hidden ? openPanel() : closePanel();
    });
    document.getElementById('chat-close-btn').addEventListener('click', closePanel);

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

    document.getElementById('chat-context-btn').addEventListener('click', openContextModal);
    document.getElementById('chat-context-close').addEventListener('click', closeContextModal);
    document.getElementById('chat-context-form').addEventListener('submit', e => {
      e.preventDefault();
      const qInput = document.getElementById('chat-context-question');
      const aInput = document.getElementById('chat-context-answer');
      const question = qInput.value.trim();
      const answer = aInput.value.trim();
      if (!question || !answer) return;

      const items = loadContext();
      items.push({ id: crypto.randomUUID(), question, answer });
      saveContext(items);
      qInput.value = '';
      aInput.value = '';
      renderContextList();
      qInput.focus();
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
