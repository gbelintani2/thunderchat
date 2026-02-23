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
