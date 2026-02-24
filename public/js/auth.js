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

  async checkSetupStatus() {
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      return data.configured;
    } catch (err) {
      console.error('[AUTH] Setup status check failed:', err);
      return false;
    }
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
