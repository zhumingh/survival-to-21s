# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based dodge/survival game with a Node.js backend providing user auth and a global leaderboard.

## Running the Project

```bash
npm install          # first time only
npm start            # start server at http://localhost:3000
node --watch server.js  # dev mode with auto-restart
```

The server serves static files from `public/` and exposes the REST API.

## Project Structure

```
server.js            # Express server — auth, scores API, static file serving
game.db              # SQLite database (auto-created on first run)
package.json
public/
  index.html         # Entry point — auth screen, leaderboard overlay, game area
  css/style.css      # All styles
  js/game.js         # All frontend logic: auth, leaderboard, game loop
```

## Backend Architecture

**Database** (`better-sqlite3`, synchronous):
- `users(id, username COLLATE NOCASE, password_hash, created_at)`
- `scores(id, user_id, score_ms, steps, played_at)`

**Auth**: session-based (`express-session`), passwords hashed with `bcryptjs` (cost 10).

**API endpoints**:
- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/logout`
- `GET /api/auth/me` — returns `{ user }` or `{ user: null }`
- `POST /api/scores` — `{ scoreMs, steps }`, requires auth
- `GET /api/leaderboard` — top 20, one best score per user
- `GET /api/scores/me` — current user's top 10 scores, requires auth

## Frontend Architecture (`public/js/game.js`)

All state is module-level. Key variables:
- `currentUser` — `{ username }` or `null`
- `gameRunning` — guards `endGame()` from double-firing
- `currentElapsedMs` / `elapsedSeconds` — updated every game tick (not parsed from DOM)
- `enemies[]` — `{ element, xSpeed, ySpeed, attractedToHelper }`
- `playerPath[]` — `{ x, y }` snapshots per tick, drawn as bezier curve on game over

**Auth flow**: `checkAuth()` runs on load → calls `/api/auth/me` → shows auth screen or game instructions.

**Game loop** (`startGame`): Three concurrent `setInterval` timers:
- `gameInterval` (50ms): moves player, calls `updateEnemies()`
- `enemyInterval` (100ms): spawns enemies up to `MAX_ENEMIES = 200`
- `helperInterval` (5000ms): spawns gray decoy circles that lure 30% of enemies for 3s

**Difficulty**: `Math.floor(elapsedSeconds / 5)` enemies at indices `[0..n]` get 5× speed multiplier — one more fast enemy every 5 seconds.

**Score submission**: called from `endGame()` via `fetch('/api/scores', ...)` — fire-and-forget.

## Key Behaviors to Preserve

- `gameRunning` flag prevents `endGame()` from being called multiple times in one tick
- Diagonal movement normalized by `/ Math.sqrt(2)`
- Enemy spawn: random angle from center, distance 1/4–1/2 of max game dimension
- Mobile: initial enemy count 10 (vs 40 desktop)
- Touch swipe maps to 8 directional key states; all reset on `touchend`
- Dash: 35px/tick for 180ms, 2s cooldown shown as cyan bar at bottom center
