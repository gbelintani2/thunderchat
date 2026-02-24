# ThunderChat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use 10x-engineer:executing-plans to implement this plan task-by-task.

**Goal:** Build a WhatsApp-integrated web chat app with a WhatsApp-like UI, deployed as a single Node.js service on Render.com.

**Architecture:** Express server serves static HTML/CSS/JS frontend, handles WhatsApp Cloud API webhook callbacks, proxies outgoing messages, and pushes real-time updates to the browser via WebSocket. No database — localStorage only.

**Tech Stack:** Node.js, Express, ws (WebSocket), jsonwebtoken, vanilla HTML/CSS/JS

---

## Task Dependencies

Tasks in the same parallel group can be worked on concurrently.
Tasks with dependencies must wait for their prerequisites.

| Task | Parallel Group | Depends On | Files Touched |
|------|---------------|------------|---------------|
| 1: Project scaffold | A | — | `package.json`, `.env.example`, `.gitignore` |
| 2: Server core + auth | B | Task 1 | `server.js` |
| 3: Landing page | B | Task 1 | `public/index.html`, `public/css/styles.css` |
| 4: Login page + auth JS | C | Tasks 2, 3 | `public/login.html`, `public/js/auth.js`, `public/css/styles.css` |
| 5: Chat HTML + CSS | C | Task 3 | `public/chat.html`, `public/css/styles.css` |
| 6: WebSocket + webhook routes | D | Task 2 | `server.js` |
| 7: Chat JS (localStorage + WebSocket client) | D | Tasks 4, 5 | `public/js/chat.js`, `public/js/app.js` |
| 8: Meta setup guide | B | Task 1 | `docs/meta-setup-guide.md` |
| 9: Final integration + smoke test | E | Tasks 6, 7, 8 | — |

**Parallel execution:** Tasks 2, 3, 8 (Group B) run simultaneously after Task 1. Tasks 4, 5 (Group C) run after Group B. Tasks 6, 7 (Group D) run after Group C. Task 9 (Group E) runs last.

---

### Task 1: Project Scaffold

**Parallel group:** A

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Update: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "thunderchat",
  "version": "1.0.0",
  "description": "WhatsApp-integrated web chat via Cloud API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

**Step 2: Create .env.example**

```
# Auth
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
JWT_SECRET=change-this-to-a-random-string

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your-system-user-access-token
PHONE_NUMBER_ID=your-phone-number-id
WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token
APP_SECRET=your-meta-app-secret

# Optional
META_API_VERSION=v21.0
PORT=3000
```

**Step 3: Update .gitignore**

Add to the existing `.gitignore`:
```
.env
```

**Step 4: Install dependencies**

```bash
cd /Users/gbelintani/Projects/ThunderChat/thunderchat && npm install
```

Expected: `node_modules/` created, `package-lock.json` generated.

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore && git commit -m "scaffold: init package.json, env template, dependencies"
```

---

### Task 2: Server Core + Auth

**Parallel group:** B — depends on Task 1

**Files:**
- Create: `server.js`

**Step 1: Create server.js with Express setup, static serving, and login route**

```js
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);

// --- Config ---
const PORT = process.env.PORT || 3000;
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.error('[AUTH] No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[AUTH] Invalid token:', err.message);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// --- Login route ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] Login attempt for user: ${username}`);
  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET);
    console.log('[AUTH] Login successful');
    return res.json({ token });
  }
  console.error('[AUTH] Login failed — invalid credentials');
  return res.status(401).json({ error: 'Invalid credentials' });
});

// --- Start server (placeholder — webhook & WS added in Task 6) ---
server.listen(PORT, () => {
  console.log(`[SERVER] ThunderChat running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
});
```

**Step 2: Test manually**

```bash
cd /Users/gbelintani/Projects/ThunderChat/thunderchat && node server.js
```

In another terminal:
```bash
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"admin","password":"changeme"}'
```

Expected: `{"token":"eyJ..."}` — a valid JWT.

```bash
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"wrong","password":"wrong"}'
```

Expected: `{"error":"Invalid credentials"}` with 401.

**Step 3: Commit**

```bash
git add server.js && git commit -m "feat: add Express server with auth login route"
```

---

### Task 3: Landing Page

**Parallel group:** B — depends on Task 1

**Files:**
- Create: `public/index.html`
- Create: `public/css/styles.css`

**Step 1: Create public/css/styles.css**

WhatsApp-inspired theme. This file will be extended in later tasks.

```css
/* --- Reset & Base --- */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #111b21;
  color: #e9edef;
  height: 100vh;
  overflow: hidden;
}

a {
  color: #00a884;
  text-decoration: none;
}

/* --- Landing Page --- */
.landing-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
  background: linear-gradient(180deg, #00a884 0%, #00a884 30%, #111b21 30%);
}

.landing-card {
  background: #202c33;
  border-radius: 8px;
  padding: 48px 40px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.landing-card h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #e9edef;
}

.landing-card p {
  font-size: 15px;
  color: #8696a0;
  margin-bottom: 32px;
  line-height: 1.5;
}

.btn-primary {
  display: inline-block;
  background-color: #00a884;
  color: #fff;
  border: none;
  border-radius: 24px;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #06cf9c;
}

/* --- Login Page --- */
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(180deg, #00a884 0%, #00a884 30%, #111b21 30%);
}

.login-card {
  background: #202c33;
  border-radius: 8px;
  padding: 40px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.login-card h2 {
  font-size: 22px;
  margin-bottom: 24px;
  text-align: center;
  color: #e9edef;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #8696a0;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #3b4a54;
  border-radius: 8px;
  background: #2a3942;
  color: #e9edef;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #00a884;
}

.login-error {
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  margin-bottom: 16px;
  display: none;
}

.btn-login {
  width: 100%;
  padding: 12px;
  background-color: #00a884;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-login:hover {
  background-color: #06cf9c;
}

/* --- Chat Page --- */
.chat-container {
  display: flex;
  height: 100vh;
  background: #111b21;
}

/* Sidebar */
.sidebar {
  width: 340px;
  min-width: 340px;
  background: #111b21;
  border-right: 1px solid #2a3942;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #202c33;
  height: 60px;
}

.sidebar-header h2 {
  font-size: 18px;
  font-weight: 500;
}

.contact-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
}

.contact-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #222d34;
  transition: background-color 0.15s;
}

.contact-item:hover,
.contact-item.active {
  background: #2a3942;
}

.contact-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b4a54;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #8696a0;
  margin-right: 12px;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-size: 16px;
  font-weight: 400;
  color: #e9edef;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-preview {
  font-size: 13px;
  color: #8696a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.contact-meta {
  text-align: right;
  flex-shrink: 0;
  margin-left: 8px;
}

.contact-time {
  font-size: 12px;
  color: #8696a0;
}

.contact-unread {
  background: #00a884;
  color: #111b21;
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  margin-left: auto;
}

/* Chat panel */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0b141a;
}

.chat-panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8696a0;
  font-size: 15px;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #202c33;
  height: 60px;
  border-bottom: 1px solid #2a3942;
}

.chat-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b4a54;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #8696a0;
  margin-right: 12px;
}

.chat-header-name {
  font-size: 16px;
  font-weight: 500;
  color: #e9edef;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 60px;
  display: flex;
  flex-direction: column;
}

.message {
  max-width: 65%;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 14.5px;
  line-height: 1.4;
  position: relative;
  word-wrap: break-word;
}

.message-sent {
  background: #005c4b;
  align-self: flex-end;
  border-top-right-radius: 0;
}

.message-received {
  background: #202c33;
  align-self: flex-start;
  border-top-left-radius: 0;
}

.message-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  text-align: right;
  margin-top: 4px;
}

.message-status {
  font-size: 11px;
  margin-left: 4px;
}

.message-status.sent { color: rgba(255,255,255,0.45); }
.message-status.delivered { color: rgba(255,255,255,0.45); }
.message-status.read { color: #53bdeb; }

/* Input bar */
.input-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #202c33;
  gap: 10px;
}

.input-bar input {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #2a3942;
  color: #e9edef;
  font-size: 15px;
  outline: none;
}

.input-bar input::placeholder {
  color: #8696a0;
}

.btn-send {
  background: #00a884;
  border: none;
  border-radius: 50%;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.btn-send:hover {
  background: #06cf9c;
}

.btn-send svg {
  fill: #fff;
  width: 20px;
  height: 20px;
}

/* Logout button */
.btn-logout {
  background: none;
  border: 1px solid #3b4a54;
  color: #8696a0;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-logout:hover {
  background: #2a3942;
  color: #e9edef;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #3b4a54;
  border-radius: 3px;
}
```

**Step 2: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThunderChat</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="landing-container">
    <div class="landing-card">
      <h1>ThunderChat</h1>
      <p>A web-based WhatsApp messaging interface. Send and receive WhatsApp messages directly from your browser.</p>
      <a href="/login.html" class="btn-primary">Login</a>
    </div>
  </div>
</body>
</html>
```

**Step 3: Verify in browser**

```bash
cd /Users/gbelintani/Projects/ThunderChat/thunderchat && node server.js
```

Open `http://localhost:3000` — should show a green-topped card with ThunderChat branding and a Login button.

**Step 4: Commit**

```bash
git add public/index.html public/css/styles.css && git commit -m "feat: add landing page with WhatsApp-style theme"
```

---

### Task 4: Login Page + Auth JS

**Parallel group:** C — depends on Tasks 2, 3

**Files:**
- Create: `public/login.html`
- Create: `public/js/auth.js`

**Step 1: Create public/js/auth.js**

```js
// auth.js — handles login form submission and token management

const Auth = {
  TOKEN_KEY: 'thunderchat_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  logout() {
    console.log('[AUTH] Logging out');
    this.clearToken();
    window.location.href = '/login.html';
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      console.log('[AUTH] Not authenticated, redirecting to login');
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  async login(username, password) {
    console.log('[AUTH] Attempting login...');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[AUTH] Login failed:', data.error);
        throw new Error(data.error || 'Login failed');
      }
      console.log('[AUTH] Login successful');
      this.setToken(data.token);
      return data;
    } catch (err) {
      console.error('[AUTH] Login error:', err.message);
      throw err;
    }
  },
};
```

**Step 2: Create public/login.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThunderChat — Login</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <h2>ThunderChat</h2>
      <div class="login-error" id="loginError"></div>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn-login">Login</button>
      </form>
    </div>
  </div>
  <script src="/js/auth.js"></script>
  <script>
    // Redirect if already logged in
    if (Auth.isLoggedIn()) {
      window.location.href = '/chat.html';
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('loginError');
      errorEl.style.display = 'none';

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        await Auth.login(username, password);
        window.location.href = '/chat.html';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

**Step 3: Test manually**

Run server, go to `http://localhost:3000/login.html`. Enter `admin`/`changeme` — should redirect to `/chat.html` (which will 404 for now). Enter wrong creds — should show error.

**Step 4: Commit**

```bash
git add public/login.html public/js/auth.js && git commit -m "feat: add login page with JWT auth flow"
```

---

### Task 5: Chat HTML

**Parallel group:** C — depends on Task 3

**Files:**
- Create: `public/chat.html`

**Step 1: Create public/chat.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThunderChat</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="chat-container">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>ThunderChat</h2>
        <button class="btn-logout" id="logoutBtn">Logout</button>
      </div>
      <ul class="contact-list" id="contactList">
        <!-- Populated by chat.js -->
      </ul>
    </div>

    <!-- Chat Panel -->
    <div class="chat-panel" id="chatPanel">
      <div class="chat-panel-empty" id="emptyState">
        Select a conversation to start messaging
      </div>

      <!-- Active chat (hidden until contact selected) -->
      <div id="activeChat" style="display:none; flex-direction:column; height:100%;">
        <div class="chat-header">
          <div class="chat-header-avatar" id="chatAvatar"></div>
          <span class="chat-header-name" id="chatName"></span>
        </div>
        <div class="messages-area" id="messagesArea">
          <!-- Messages populated by chat.js -->
        </div>
        <div class="input-bar">
          <input type="text" id="messageInput" placeholder="Type a message" autocomplete="off">
          <button class="btn-send" id="sendBtn">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
  <script src="/js/auth.js"></script>
  <script src="/js/app.js"></script>
  <script src="/js/chat.js"></script>
</body>
</html>
```

**Step 2: Verify in browser**

Load `http://localhost:3000/chat.html` — should show the sidebar + empty chat panel layout.

**Step 3: Commit**

```bash
git add public/chat.html && git commit -m "feat: add chat page HTML structure"
```

---

### Task 6: WebSocket + Webhook Routes

**Parallel group:** D — depends on Task 2

**Files:**
- Modify: `server.js`

**Step 1: Add webhook routes, send API proxy, and WebSocket server to server.js**

Add the following **before** the `server.listen(...)` call in `server.js`:

```js
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// --- Webhook verification ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[WEBHOOK] Verification request received');
  console.log('[WEBHOOK] Mode:', mode, '| Token match:', token === WEBHOOK_VERIFY_TOKEN);

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[WEBHOOK] Verification successful');
    return res.status(200).send(challenge);
  }
  console.error('[WEBHOOK] Verification failed');
  return res.status(403).send('Forbidden');
});

// --- Webhook signature validation ---
function validateWebhookSignature(req) {
  if (!APP_SECRET) {
    console.warn('[WEBHOOK] APP_SECRET not set, skipping signature validation');
    return true;
  }
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.error('[WEBHOOK] No signature header present');
    return false;
  }
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!valid) {
    console.error('[WEBHOOK] Signature mismatch');
  }
  return valid;
}

// --- Webhook incoming messages ---
app.post('/webhook', (req, res) => {
  console.log('[WEBHOOK] Incoming POST:', JSON.stringify(req.body, null, 2));

  if (!validateWebhookSignature(req)) {
    return res.status(403).send('Invalid signature');
  }

  // Process entries
  const entries = req.body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;

      // Incoming messages
      if (value.messages) {
        for (const msg of value.messages) {
          const contact = (value.contacts && value.contacts[0]) || {};
          const payload = {
            type: 'incoming_message',
            from: msg.from,
            name: contact.profile ? contact.profile.name : msg.from,
            messageId: msg.id,
            timestamp: msg.timestamp,
            messageType: msg.type,
            text: msg.text ? msg.text.body : '',
          };
          console.log('[WEBHOOK] Broadcasting incoming message:', JSON.stringify(payload));
          broadcastToClients(payload);
        }
      }

      // Status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          const payload = {
            type: 'status_update',
            messageId: status.id,
            status: status.status,
            recipientId: status.recipient_id,
            timestamp: status.timestamp,
          };
          console.log('[WEBHOOK] Broadcasting status update:', JSON.stringify(payload));
          broadcastToClients(payload);
        }
      }
    }
  }

  res.status(200).send('OK');
});

// --- Send message proxy ---
app.post('/api/send', authenticateToken, async (req, res) => {
  const { to, message } = req.body;
  console.log(`[API] Sending message to ${to}: "${message}"`);

  if (!to || !message) {
    console.error('[API] Missing "to" or "message" field');
    return res.status(400).json({ error: 'Missing "to" or "message" field' });
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: message },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log('[API] WhatsApp API response:', JSON.stringify(data));

    if (!response.ok) {
      console.error('[API] WhatsApp API error:', data.error);
      return res.status(response.status).json({ error: data.error || data });
    }
    return res.json(data);
  } catch (err) {
    console.error('[API] Request failed:', err.message);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcastToClients(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msg);
    }
  }
  console.log(`[WS] Broadcasted to ${clients.size} client(s)`);
}

wss.on('connection', (ws, req) => {
  // Authenticate via query param: ?token=xxx
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.error('[WS] Connection rejected — no token');
    ws.close(4001, 'No token provided');
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error('[WS] Connection rejected — invalid token:', err.message);
    ws.close(4003, 'Invalid token');
    return;
  }

  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Client error:', err.message);
    clients.delete(ws);
  });
});
```

Also add `const crypto = require('crypto');` and `const { WebSocketServer } = require('ws');` at the top of the file with the other requires.

**Step 2: Test webhook verification**

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your-webhook-verify-token&hub.challenge=test123"
```

Expected: `test123`

**Step 3: Test send endpoint (will fail against Meta API without real creds, but should not crash)**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"admin","password":"changeme"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -X POST http://localhost:3000/api/send -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"to":"1234567890","message":"test"}'
```

Expected: error response from WhatsApp API (not a crash).

**Step 4: Commit**

```bash
git add server.js && git commit -m "feat: add webhook routes, send proxy, and WebSocket server"
```

---

### Task 7: Chat JS (localStorage + WebSocket Client)

**Parallel group:** D — depends on Tasks 4, 5

**Files:**
- Create: `public/js/app.js`
- Create: `public/js/chat.js`

**Step 1: Create public/js/app.js**

```js
// app.js — shared utilities

const App = {
  formatTime(timestamp) {
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  },

  getInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};
```

**Step 2: Create public/js/chat.js**

```js
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
    // Find the message across all conversations and update its status
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
```

**Step 3: Full manual test**

1. Start server: `node server.js`
2. Go to `http://localhost:3000` → click Login
3. Enter `admin`/`changeme` → should redirect to chat
4. Check browser console — should see `[CHAT] Initialized` and `[WS] Connected`

**Step 4: Commit**

```bash
git add public/js/app.js public/js/chat.js && git commit -m "feat: add chat logic with localStorage and WebSocket client"
```

---

### Task 8: Meta Setup Guide

**Parallel group:** B — depends on Task 1

**Files:**
- Create: `docs/meta-setup-guide.md`

**Step 1: Create docs/meta-setup-guide.md**

```markdown
# Meta App & Tech Provider Setup Guide

Step-by-step instructions for setting up the Meta App, WhatsApp Business API integration, and becoming a Tech Provider.

---

## Part 1: Create a Meta Business Account

1. Go to [business.facebook.com](https://business.facebook.com).
2. Click **Create Account**.
3. Enter your business name, your name, and business email.
4. Fill in your business details (address, website, etc.).
5. Verify your email address.

---

## Part 2: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com).
2. Click **My Apps** in the top-right corner.
3. Click **Create App**.
4. Select **Other** as the use case, then click **Next**.
5. Select **Business** as the app type, then click **Next**.
6. Enter an app name (e.g., "ThunderChat").
7. Enter your contact email.
8. Select your Meta Business Account from the dropdown.
9. Click **Create App**.

---

## Part 3: Add WhatsApp to Your App

1. In the App Dashboard, scroll down to **Add Products to Your App**.
2. Find **WhatsApp** and click **Set Up**.
3. Select your Meta Business Account when prompted.
4. You'll be taken to the **WhatsApp > Getting Started** panel.

At this point, Meta has automatically:
- Created a **WhatsApp Business Account (WABA)** for you.
- Assigned a **test phone number** you can use for development.
- Generated a **temporary access token** (valid ~24 hours).

---

## Part 4: Get Your Credentials

### Temporary Access Token (for testing)
1. In the App Dashboard, go to **WhatsApp > API Setup**.
2. Copy the **Temporary access token** shown.
3. Note the **Phone number ID** displayed below the token.

### Permanent Access Token (for production)
1. Go to [business.facebook.com](https://business.facebook.com).
2. Navigate to **Settings > System Users**.
3. Click **Add** to create a new System User.
4. Set the role to **Admin**.
5. Click **Add Assets** > **Apps** > select your ThunderChat app > toggle **Full Control**.
6. Click **Generate New Token**.
7. Select your app from the dropdown.
8. Check these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
9. Click **Generate Token**.
10. **Copy and save this token securely** — it won't be shown again.

### App Secret
1. In the App Dashboard, go to **Settings > Basic**.
2. Click **Show** next to the App Secret field.
3. Copy the App Secret.

---

## Part 5: Register a Phone Number

### Using the Test Number (easiest for development)
The test number provided by Meta works immediately. You can send messages to up to 5 verified recipient numbers.

### Adding Your Own Number
1. In the App Dashboard, go to **WhatsApp > API Setup**.
2. Click **Add phone number**.
3. Enter your business phone number details.
4. Choose verification method: **SMS** or **Voice call**.
5. Enter the OTP code you receive.
6. Your number is now registered.

**Note:** The phone number cannot already be registered with WhatsApp or WhatsApp Business App. You must delete WhatsApp from that number first.

---

## Part 6: Set Up Webhooks

1. In the App Dashboard, go to **WhatsApp > Configuration**.
2. Under **Webhook**, click **Edit**.
3. Enter:
   - **Callback URL:** `https://your-render-app.onrender.com/webhook`
   - **Verify token:** The value you set in `WEBHOOK_VERIFY_TOKEN` env var
4. Click **Verify and Save**.
5. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` (required — for incoming messages and status updates)

**Important:** Your server must be running and accessible at the callback URL before you can verify the webhook.

---

## Part 7: Configure ThunderChat Environment Variables

Set these environment variables in your Render.com dashboard:

```
AUTH_USERNAME=your-chosen-username
AUTH_PASSWORD=your-chosen-password
JWT_SECRET=generate-a-random-string

WHATSAPP_ACCESS_TOKEN=your-system-user-access-token
PHONE_NUMBER_ID=your-phone-number-id
WEBHOOK_VERIFY_TOKEN=your-chosen-verify-token
APP_SECRET=your-meta-app-secret

META_API_VERSION=v21.0
PORT=3000
```

---

## Part 8: Set the App to Live Mode

1. In the App Dashboard, go to **Settings > Basic**.
2. Fill in all required fields:
   - **Privacy Policy URL** (required)
   - **Terms of Service URL** (optional but recommended)
   - **App Icon** (optional)
3. Toggle the **App Mode** switch from **In Development** to **Live**.

**Note:** While in Development mode, only users with a role on the app (admin, developer, tester) can interact with it. Live mode is required for webhooks to work with real users.

---

## Part 9: Business Verification (Recommended)

Business verification lifts messaging limits and is required for Tech Provider status.

1. Go to [business.facebook.com](https://business.facebook.com).
2. Navigate to **Settings > Security Center**.
3. Click **Start Verification**.
4. You'll need to provide:
   - Legal business name
   - Business address
   - Business phone number
   - Business website
   - Official documentation (business license, utility bill, etc.)
5. Verification typically takes 1-3 business days.

### Messaging Limits by Verification Status
| Status | Limit |
|--------|-------|
| Unverified | 250 business-initiated conversations/day |
| Verified (Tier 1) | 1,000 conversations/day |
| Verified (Tier 2) | 10,000 conversations/day |
| Verified (Tier 3) | 100,000 conversations/day |
| Verified (Tier 4) | Unlimited |

Tiers increase automatically based on message quality and volume.

---

## Part 10: Becoming a Tech Provider

A Tech Provider builds WhatsApp solutions for other businesses. Clients manage their own billing with Meta directly.

### Prerequisites
- A verified Meta Business Account
- A Meta App with WhatsApp integration
- Completed App Review

### Step 1: Complete App Review

1. In the App Dashboard, go to **App Review > Permissions and Features**.
2. Request these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. For each permission, provide:
   - A detailed description of how you'll use it
   - A screencast demonstrating the functionality
   - Step-by-step instructions for the reviewer
4. Submit for review. This typically takes 3-5 business days.

### Step 2: Set Up Facebook Login for Business

This enables Embedded Signup — allowing your clients to connect their WhatsApp Business Account through your app.

1. In the App Dashboard, go to **Add Products** > **Facebook Login for Business** > **Set Up**.
2. Configure the **Valid OAuth Redirect URIs** with your app's callback URL.
3. Set the **Deauthorize Callback URL** and **Data Deletion Request URL**.

### Step 3: Implement Embedded Signup

Embedded Signup lets your clients:
1. Create or select a Meta Business Account
2. Create or select a WhatsApp Business Account
3. Register a phone number

All within your app's interface using Meta's pre-built UI flow.

Documentation: [developers.facebook.com/docs/whatsapp/embedded-signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)

### Step 4: Upgrading to Tech Partner

Once you meet these criteria, you're eligible for Tech Partner status (Meta Partner badge):

| Requirement | Threshold |
|-------------|-----------|
| Average daily conversations (last 7 days) | ≥ 2,500 |
| Active customers | ≥ 10 |
| Quality metric | ≥ 90% |

Tech Partner benefits include:
- Meta Business Partner badge
- Access to Partner Portal
- Dedicated partner support
- Incentive programs

---

## Troubleshooting

### "Webhook verification failed"
- Ensure your server is running and the callback URL is accessible.
- Check that `WEBHOOK_VERIFY_TOKEN` matches what you entered in the App Dashboard.
- Verify the URL uses HTTPS.

### "Message failed to send" (Error 131030)
- The recipient hasn't messaged your number first (24-hour window).
- You need to use a template message to initiate conversations.

### "Number not registered" (Error 470)
- The recipient phone number doesn't have WhatsApp.
- Use the full international format without `+` (e.g., `1234567890`).

### "Invalid access token"
- Temporary tokens expire after ~24 hours. Use a System User token for production.
- Ensure the token has `whatsapp_business_messaging` permission.
```

**Step 2: Commit**

```bash
git add docs/meta-setup-guide.md && git commit -m "docs: add Meta App and Tech Provider setup guide"
```

---

### Task 9: Final Integration + Smoke Test

**Parallel group:** E — depends on Tasks 6, 7, 8

**Files:** None (testing only)

**Step 1: Create .env file from template**

```bash
cp .env.example .env
```

Edit `.env` with test values (use defaults for auth, leave WhatsApp fields as placeholders).

**Step 2: Start the server**

```bash
node server.js
```

Expected console output:
```
[SERVER] ThunderChat running on port 3000
[SERVER] Environment: development
```

**Step 3: Full flow test**

1. Open `http://localhost:3000` — Landing page loads with ThunderChat branding
2. Click "Login" — navigates to login page
3. Enter `admin`/`changeme` — redirects to chat page
4. Browser console shows `[CHAT] Initialized` and `[WS] Connected`
5. Open DevTools > Application > Local Storage — `thunderchat_token` is set

**Step 4: Test webhook simulation**

In another terminal:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"id":"123","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15551234567","phone_number_id":"123"},"contacts":[{"profile":{"name":"Test User"},"wa_id":"5511999999999"}],"messages":[{"from":"5511999999999","id":"wamid.test123","timestamp":"1700000000","type":"text","text":{"body":"Hello from webhook test!"}}]},"field":"messages"}]}]}'
```

Expected:
- Server console shows `[WEBHOOK] Incoming POST:...` and `[WEBHOOK] Broadcasting incoming message:...`
- Browser chat page shows "Test User" in the sidebar with the message (if WebSocket is connected — note signature validation will skip since `APP_SECRET` isn't set in test)

**Step 5: Commit any final adjustments**

```bash
git add -A && git commit -m "chore: final integration smoke test passed"
```
