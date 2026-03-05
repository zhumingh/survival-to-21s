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
  const { username, password } = req.body;
  const name = username?.trim();
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: 'Username must be 2–20 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(name, hash);
    req.session.userId = result.lastInsertRowid;
    req.session.username = name;
    res.json({ success: true, username: name });
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

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ success: true, username: user.username });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Current user
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { id: req.session.userId, username: req.session.username } });
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
    SELECT u.username, s.score_ms, s.steps, s.played_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.score_ms = (SELECT MAX(score_ms) FROM scores WHERE user_id = s.user_id)
    GROUP BY s.user_id
    ORDER BY s.score_ms DESC
    LIMIT 20
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
