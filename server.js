// Written by Ken Zhu (zhumingh@gmail.com) with the power of Claude Code
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'game.db');
const db = new Database(dbPath);

// Init DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score_ms INTEGER NOT NULL,
    steps INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migration: add country column to existing DBs
try { db.exec(`ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT ''`); } catch (_) {}
// Safe migration: add email column
try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''`); } catch (_) {}
// Safe migration: add google_id column for OAuth users
try { db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`); } catch (_) {}

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dodge-game-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, country, email } = req.body;
  const name = username?.trim();
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: 'Username must be 2–20 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Username: letters, numbers, underscore only' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must include both letters and numbers' });

  const emailVal = (email || '').trim();
  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return res.status(400).json({ error: 'Invalid email format' });

  const countryCode = /^[A-Z]{2}$/.test((country || '').toUpperCase()) ? country.toUpperCase() : '';

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, country, email) VALUES (?, ?, ?, ?)').run(name, hash, countryCode, emailVal);
    req.session.userId = result.lastInsertRowid;
    req.session.username = name;
    req.session.country  = countryCode;
    res.json({ success: true, username: name, country: countryCode });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  req.session.userId  = user.id;
  req.session.username = user.username;
  req.session.country  = user.country || '';
  res.json({ success: true, username: user.username, country: user.country || '' });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Current user
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { id: req.session.userId, username: req.session.username, country: req.session.country || '' } });
});

// Submit score
app.post('/api/scores', requireAuth, (req, res) => {
  const { scoreMs, steps } = req.body;
  if (typeof scoreMs !== 'number' || typeof steps !== 'number' || scoreMs < 0 || steps < 0)
    return res.status(400).json({ error: 'Invalid score data' });
  db.prepare('INSERT INTO scores (user_id, score_ms, steps) VALUES (?, ?, ?)').run(req.session.userId, scoreMs, steps);
  res.json({ success: true });
});

// Global leaderboard — best score per user
app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.country, s.score_ms, s.steps, s.played_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.score_ms = (SELECT MAX(score_ms) FROM scores WHERE user_id = s.user_id)
    GROUP BY s.user_id
    ORDER BY s.score_ms DESC
    LIMIT 20
  `).all();
  res.json(rows);
});

// Country leaderboard — best score and player count per country
app.get('/api/leaderboard/countries', (req, res) => {
  const rows = db.prepare(`
    SELECT u.country,
           COUNT(DISTINCT u.id)    AS players,
           MAX(s.score_ms)         AS best_ms,
           CAST(ROUND(AVG(s.score_ms)) AS INTEGER) AS avg_ms
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE u.country != ''
    GROUP BY u.country
    ORDER BY best_ms DESC
    LIMIT 30
  `).all();
  res.json(rows);
});

// My scores
app.get('/api/scores/me', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT score_ms, steps, played_at
    FROM scores WHERE user_id = ?
    ORDER BY score_ms DESC LIMIT 10
  `).all(req.session.userId);
  res.json(rows);
});

// Google OAuth — requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL             = process.env.BASE_URL || 'http://localhost:3000';
const GOOGLE_CALLBACK      = `${BASE_URL}/api/auth/google/callback`;

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.redirect('/?googleError=not_configured');
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_CALLBACK,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'online',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || !GOOGLE_CLIENT_ID) return res.redirect('/?googleError=1');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  GOOGLE_CALLBACK,
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/?googleError=1');

    // Fetch Google profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.id) return res.redirect('/?googleError=1');

    // Find existing user by google_id
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

    if (!user) {
      // Derive a valid username from display name
      let base = (profile.name || profile.email?.split('@')[0] || 'player')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20);
      if (base.length < 2) base = 'player';

      let username = base;
      let suffix = 1;
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        username = base.slice(0, 18) + suffix++;
      }

      const result = db.prepare(
        'INSERT INTO users (username, password_hash, email, google_id) VALUES (?, ?, ?, ?)'
      ).run(username, '', profile.email || '', profile.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.country  = user.country || '';
    res.redirect('/');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect('/?googleError=1');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
