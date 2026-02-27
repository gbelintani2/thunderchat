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
const WHATSAPP_BUSINESS_PIN = process.env.WHATSAPP_BUSINESS_PIN || '123456';
let WABA_ID = process.env.WABA_ID;
const FLOWS_PRIVATE_KEY = process.env.FLOWS_PRIVATE_KEY
  ? process.env.FLOWS_PRIVATE_KEY.replace(/\\n/g, '\n')
  : null;

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

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// --- Setup routes ---
app.get('/api/setup/status', (req, res) => {
  const configured = !!(WHATSAPP_ACCESS_TOKEN && PHONE_NUMBER_ID);
  res.json({ configured });
});

app.get('/api/setup/config', authenticateToken, (req, res) => {
  if (!META_APP_ID || !EMBEDDED_SIGNUP_CONFIG_ID) {
    return res.status(500).json({ error: 'Embedded Signup not configured on server' });
  }
  res.json({ appId: META_APP_ID, configId: EMBEDDED_SIGNUP_CONFIG_ID });
});

app.post('/api/setup/complete', authenticateToken, async (req, res) => {
  const { code, wabaId, phoneNumberId } = req.body;
  console.log('[SETUP] Completing Embedded Signup...');
  console.log('[SETUP] WABA ID:', wabaId, '| Phone Number ID:', phoneNumberId);

  if (!code || !wabaId || !phoneNumberId) {
    return res.status(400).json({ error: 'Missing code, wabaId, or phoneNumberId' });
  }

  try {
    // Step 1: Exchange code for access token
    console.log('[SETUP] Exchanging code for access token...');
    const tokenUrl = `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?client_id=${META_APP_ID}&client_secret=${APP_SECRET}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[SETUP] Token exchange failed:', tokenData);
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData });
    }

    const accessToken = tokenData.access_token;
    console.log('[SETUP] Access token obtained');

    // Step 2: Subscribe app to WABA webhooks
    console.log('[SETUP] Subscribing to WABA webhooks...');
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    const subscribeData = await subscribeRes.json();

    if (!subscribeRes.ok) {
      console.error('[SETUP] Webhook subscription failed:', subscribeData);
      return res.status(400).json({ error: 'Webhook subscription failed', details: subscribeData });
    }
    console.log('[SETUP] Webhook subscription successful');

    // Step 3: Register phone number
    console.log('[SETUP] Registering phone number...');
    const registerRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin: WHATSAPP_BUSINESS_PIN,
        }),
      }
    );
    const registerData = await registerRes.json();

    if (!registerRes.ok) {
      console.error('[SETUP] Phone registration failed:', registerData);
      // Non-fatal: phone may already be registered
      console.warn('[SETUP] Continuing despite registration error');
    } else {
      console.log('[SETUP] Phone registration successful');
    }

    // Step 4: Save credentials
    const config = {
      WHATSAPP_ACCESS_TOKEN: accessToken,
      PHONE_NUMBER_ID: phoneNumberId,
      WABA_ID: wabaId,
    };
    saveConfig(config);

    // Step 5: Update in-memory config
    WHATSAPP_ACCESS_TOKEN = accessToken;
    PHONE_NUMBER_ID = phoneNumberId;
    WABA_ID = wabaId;

    console.log('[SETUP] Embedded Signup complete');
    return res.json({ success: true });
  } catch (err) {
    console.error('[SETUP] Error:', err.message);
    return res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
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

// --- WhatsApp Flows endpoint ---
function handleFlowRequest(flowData) {
  const { version, action, screen, data, flow_token } = flowData;

  if (action === 'ping') {
    return { version, data: { status: 'active' } };
  }

  if (action === 'INIT') {
    return {
      version,
      screen: 'WELCOME',
      data: {
        welcome_message: 'Welcome to ThunderChat! How can we help you?',
      },
    };
  }

  if (action === 'data_exchange') {
    return {
      version,
      screen: 'SUCCESS',
      data: {
        extension_message_response: {
          params: { flow_token, ...(data || {}) },
        },
      },
    };
  }

  // BACK or unknown — return to welcome screen
  return {
    version,
    screen: 'WELCOME',
    data: {
      welcome_message: 'Welcome to ThunderChat! How can we help you?',
    },
  };
}

app.post('/api/flows', (req, res) => {
  console.log('[FLOWS] Incoming request');

  if (!FLOWS_PRIVATE_KEY) {
    console.error('[FLOWS] FLOWS_PRIVATE_KEY not configured');
    return res.status(500).json({ error: 'Flows endpoint not configured' });
  }

  const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

  if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
    return res.status(400).json({ error: 'Missing encrypted flow data' });
  }

  try {
    // Decrypt AES key with RSA private key
    const privateKey = crypto.createPrivateKey(FLOWS_PRIVATE_KEY);
    const decryptedAesKey = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(encrypted_aes_key, 'base64')
    );

    // Decrypt flow data with AES-128-GCM
    const iv = Buffer.from(initial_vector, 'base64');
    const encryptedBuffer = Buffer.from(encrypted_flow_data, 'base64');
    const authTag = encryptedBuffer.slice(-16);
    const ciphertext = encryptedBuffer.slice(0, -16);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');

    const flowData = JSON.parse(decrypted);
    console.log('[FLOWS] Decrypted request:', JSON.stringify(flowData));

    // Process
    const response = handleFlowRequest(flowData);
    console.log('[FLOWS] Response:', JSON.stringify(response));

    // Encrypt response with AES-128-GCM
    const responseIv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, responseIv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(response), 'utf8'), cipher.final()]);
    const responseTag = cipher.getAuthTag();

    return res.json({
      encrypted_flow_data: Buffer.concat([encrypted, responseTag]).toString('base64'),
      initial_vector: responseIv.toString('base64'),
    });
  } catch (err) {
    console.error('[FLOWS] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process flow request' });
  }
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
