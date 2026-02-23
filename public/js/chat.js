// chat.js — chat logic, localStorage, WebSocket client

(function () {
  'use strict';

  // --- Auth gate ---
  if (!Auth.requireAuth()) return;

  // --- Constants ---
  const STORAGE_KEY = 'thunderchat_conversations';
  const WS_RECONNECT_BASE = 1000;
  const WS_RECONNECT_MAX = 30000;

  // --- State ---
  let conversations = loadConversations();
  let activeContact = null;
  let ws = null;
  let wsReconnectDelay = WS_RECONNECT_BASE;

  // --- DOM ---
  const contactList = document.getElementById('contactList');
  const chatPanel = document.getElementById('chatPanel');
  const emptyState = document.getElementById('emptyState');
  const activeChat = document.getElementById('activeChat');
  const chatAvatar = document.getElementById('chatAvatar');
  const chatName = document.getElementById('chatName');
  const messagesArea = document.getElementById('messagesArea');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // --- localStorage ---
  function loadConversations() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('[CHAT] Failed to load conversations:', e);
      return {};
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error('[CHAT] Failed to save conversations:', e);
    }
  }

  function getConversation(phone) {
    if (!conversations[phone]) {
      conversations[phone] = { name: phone, messages: [], unread: 0 };
    }
    return conversations[phone];
  }

  // --- Render sidebar ---
  function renderContacts() {
    const sorted = Object.entries(conversations).sort((a, b) => {
      const lastA = a[1].messages.length ? a[1].messages[a[1].messages.length - 1].timestamp : 0;
      const lastB = b[1].messages.length ? b[1].messages[b[1].messages.length - 1].timestamp : 0;
      return lastB - lastA;
    });

    contactList.innerHTML = '';
    for (const [phone, convo] of sorted) {
      const lastMsg = convo.messages.length ? convo.messages[convo.messages.length - 1] : null;
      const li = document.createElement('li');
      li.className = 'contact-item' + (phone === activeContact ? ' active' : '');
      li.innerHTML = `
        <div class="contact-avatar">${App.getInitial(convo.name)}</div>
        <div class="contact-info">
          <div class="contact-name">${App.escapeHtml(convo.name)}</div>
          <div class="contact-preview">${lastMsg ? App.escapeHtml(lastMsg.text || '') : ''}</div>
        </div>
        <div class="contact-meta">
          <div class="contact-time">${lastMsg ? App.formatTime(lastMsg.timestamp) : ''}</div>
          ${convo.unread > 0 ? `<div class="contact-unread">${convo.unread}</div>` : ''}
        </div>
      `;
      li.addEventListener('click', () => openChat(phone));
      contactList.appendChild(li);
    }
  }

  // --- Render messages ---
  function renderMessages() {
    if (!activeContact) return;
    const convo = getConversation(activeContact);
    messagesArea.innerHTML = '';

    for (const msg of convo.messages) {
      const div = document.createElement('div');
      div.className = 'message ' + (msg.direction === 'sent' ? 'message-sent' : 'message-received');
      div.setAttribute('data-message-id', msg.messageId || '');

      let statusHtml = '';
      if (msg.direction === 'sent' && msg.status) {
        const statusIcon = msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓';
        statusHtml = `<span class="message-status ${msg.status}">${statusIcon}</span>`;
      }

      div.innerHTML = `
        <div>${App.escapeHtml(msg.text || '')}</div>
        <div class="message-time">${App.formatTime(msg.timestamp)}${statusHtml}</div>
      `;
      messagesArea.appendChild(div);
    }

    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  // --- Open chat ---
  function openChat(phone) {
    activeContact = phone;
    const convo = getConversation(phone);
    convo.unread = 0;
    saveConversations();

    emptyState.style.display = 'none';
    activeChat.style.display = 'flex';
    chatAvatar.textContent = App.getInitial(convo.name);
    chatName.textContent = convo.name;

    renderMessages();
    renderContacts();
    messageInput.focus();
  }

  // --- Send message ---
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeContact) return;

    messageInput.value = '';
    const timestamp = Math.floor(Date.now() / 1000);

    // Optimistic add
    const convo = getConversation(activeContact);
    const msg = {
      direction: 'sent',
      text,
      timestamp,
      status: 'pending',
      messageId: null,
    };
    convo.messages.push(msg);
    saveConversations();
    renderMessages();
    renderContacts();

    console.log(`[CHAT] Sending message to ${activeContact}: "${text}"`);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`,
        },
        body: JSON.stringify({ to: activeContact, message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error('[CHAT] Send failed:', data.error);
        msg.status = 'failed';
      } else {
        msg.status = 'sent';
        msg.messageId = data.messages && data.messages[0] ? data.messages[0].id : null;
        console.log('[CHAT] Message sent, ID:', msg.messageId);
      }
    } catch (err) {
      console.error('[CHAT] Send error:', err.message);
      msg.status = 'failed';
    }

    saveConversations();
    renderMessages();
  }

  // --- WebSocket ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}?token=${Auth.getToken()}`;
    console.log('[WS] Connecting...');

    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected');
      wsReconnectDelay = WS_RECONNECT_BASE;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received:', JSON.stringify(data));

        if (data.type === 'incoming_message') {
          handleIncomingMessage(data);
        } else if (data.type === 'status_update') {
          handleStatusUpdate(data);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected (code: ${event.code})`);
      if (event.code === 4001 || event.code === 4003) {
        console.error('[WS] Auth failure, redirecting to login');
        Auth.logout();
        return;
      }
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }

  function scheduleReconnect() {
    console.log(`[WS] Reconnecting in ${wsReconnectDelay}ms...`);
    setTimeout(() => {
      wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_RECONNECT_MAX);
      connectWebSocket();
    }, wsReconnectDelay);
  }

  function handleIncomingMessage(data) {
    const convo = getConversation(data.from);
    if (data.name && data.name !== data.from) {
      convo.name = data.name;
    }
    convo.messages.push({
      direction: 'received',
      text: data.text,
      timestamp: data.timestamp,
      messageId: data.messageId,
    });
    if (data.from !== activeContact) {
      convo.unread = (convo.unread || 0) + 1;
    }
    saveConversations();
    renderContacts();
    if (data.from === activeContact) {
      renderMessages();
    }
  }

  function handleStatusUpdate(data) {
    for (const phone of Object.keys(conversations)) {
      const convo = conversations[phone];
      for (const msg of convo.messages) {
        if (msg.messageId === data.messageId) {
          console.log(`[CHAT] Status update: ${msg.messageId} -> ${data.status}`);
          msg.status = data.status;
          saveConversations();
          if (phone === activeContact) {
            renderMessages();
          }
          return;
        }
      }
    }
  }

  // --- Event listeners ---
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  logoutBtn.addEventListener('click', () => Auth.logout());

  // --- Init ---
  renderContacts();
  connectWebSocket();
  console.log('[CHAT] Initialized');
})();
