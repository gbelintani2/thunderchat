const express = require('express');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);

// --- Config ---
const PORT = process.env.PORT || 3000;
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
let WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
let PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_APP_ID = process.env.META_APP_ID;
const EMBEDDED_SIGNUP_CONFIG_ID = process.env.EMBEDDED_SIGNUP_CONFIG_ID;
let WABA_ID = process.env.WABA_ID;

// --- Config file ---
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      WHATSAPP_ACCESS_TOKEN = data.WHATSAPP_ACCESS_TOKEN || WHATSAPP_ACCESS_TOKEN;
      PHONE_NUMBER_ID = data.PHONE_NUMBER_ID || PHONE_NUMBER_ID;
      WABA_ID = data.WABA_ID || WABA_ID;
      console.log('[CONFIG] Loaded credentials from config.json');
    }
  } catch (err) {
    console.error('[CONFIG] Failed to load config.json:', err.message);
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('[CONFIG] Saved credentials to config.json');
  } catch (err) {
    console.error('[CONFIG] Failed to save config.json:', err.message);
    throw err;
  }
}

loadConfig();

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

// --- Page routes ---
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

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

  const entries = req.body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;

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
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
  console.log(`[WS] Broadcasted to ${clients.size} client(s)`);
}

wss.on('connection', (ws, req) => {
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

// --- Start server ---
server.listen(PORT, () => {
  console.log(`[SERVER] ThunderChat running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
});
