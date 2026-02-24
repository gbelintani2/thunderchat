# ThunderChat Design

## Overview

ThunderChat is a web chat application that integrates with the WhatsApp Business Cloud API. It provides a WhatsApp-like UI for sending and receiving messages through a business WhatsApp number. Built as a single Node.js/Express service deployed on Render.com.

## Architecture

```
Browser (Static Frontend)
  ├── HTML/CSS/JS served by Express
  ├── localStorage for chat history, auth state, preferences
  └── WebSocket connection to server
        │
Express Server
  ├── Serves static frontend files
  ├── POST /webhook — receives WhatsApp messages from Meta
  ├── GET /webhook — Meta verification handshake
  ├── POST /api/send — proxies outgoing messages to WhatsApp Cloud API
  ├── POST /api/login — validates credentials
  └── WebSocket server — pushes incoming messages to browser in real-time
        │
WhatsApp Cloud API (graph.facebook.com)
  ├── Send messages via POST
  └── Delivers incoming messages via webhook POST
```

Key constraints:
- No database. Server is a thin proxy. Browser persists everything in localStorage.
- Reply-only mode — no template messages. Users must message the WhatsApp number first.
- Single-user auth via username/password in env vars.

## Frontend

Three views, all vanilla HTML/CSS/JS (no framework, no build step):

### Landing Page (`/`)
- Hero section with ThunderChat branding
- Brief description
- "Login" button

### Login Page (`/login`)
- Username + password form
- Submits to `POST /api/login`
- On success: stores JWT in localStorage, redirects to chat
- On failure: shows error message

### Chat View (`/chat`)
- Protected — redirects to login if no valid auth token
- WhatsApp-style layout:
  - Left sidebar: contact list sorted by last message time, showing name/number, last message preview, timestamp, unread count
  - Right panel: active conversation with message bubbles (green for sent, white for received), timestamps, delivery status (sent/delivered/read)
  - Bottom input bar: text input + send button
- All chat history in localStorage, keyed by contact phone number
- WebSocket connection with auto-reconnect (exponential backoff: 1s, 2s, 4s, max 30s)

## Backend

### Authentication
- `POST /api/login` — validates `{ username, password }` against `AUTH_USERNAME` / `AUTH_PASSWORD` env vars. Returns JWT signed with `JWT_SECRET`.
- All `/api/*` routes and WebSocket connections require valid JWT.

### WhatsApp Webhook
- `GET /webhook` — Meta verification. Checks `hub.verify_token` against `WEBHOOK_VERIFY_TOKEN`, returns `hub.challenge`.
- `POST /webhook` — Receives incoming messages and status updates. Validates request signature via HMAC-SHA256 using `APP_SECRET`. Broadcasts to WebSocket clients. Returns 200 immediately.

### Message Sending
- `POST /api/send` — Accepts `{ to, message }`. Proxies to `https://graph.facebook.com/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages` using `WHATSAPP_ACCESS_TOKEN`. Returns API response.

### WebSocket Server
- Runs on same HTTP server using `ws` library
- Authenticates on connection via JWT
- Pushes `incoming_message` and `status_update` events to clients

### Environment Variables
```
AUTH_USERNAME          — Login username
AUTH_PASSWORD          — Login password
JWT_SECRET            — Secret for signing JWT tokens

WHATSAPP_ACCESS_TOKEN — System User access token
PHONE_NUMBER_ID       — WhatsApp Business phone number ID
WEBHOOK_VERIFY_TOKEN  — Token for Meta webhook verification
APP_SECRET            — Meta App Secret for webhook signature validation

META_API_VERSION      — Graph API version (default: v21.0)
PORT                  — Server port (default: 3000)
```

## Logging

All console logs prefixed with tags: `[AUTH]`, `[WEBHOOK]`, `[API]`, `[WS]`, `[SERVER]`.

Logged events: webhook payloads, API requests/responses, WebSocket connect/disconnect, auth attempts, errors with stack traces.

## Error Handling

- WhatsApp API errors returned to frontend with Meta's error code and message
- Webhook signature failures: logged and rejected with 403
- Invalid auth: logged with timestamp
- WebSocket errors: client-side reconnect with exponential backoff
- Global Express error handler for unhandled errors

## Deployment (Render.com)

- Single Web Service, Node environment
- Build command: `npm install`
- Start command: `node server.js`
- Env vars in Render dashboard
- Render provides HTTPS (required for webhooks)
- Render URL = webhook callback URL in Meta App Dashboard

## Project Structure

```
thunderchat/
├── server.js
├── package.json
├── public/
│   ├── index.html
│   ├── login.html
│   ├── chat.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── auth.js
│       ├── chat.js
│       └── app.js
├── docs/
│   └── meta-setup-guide.md
├── .env.example
└── .gitignore
```
