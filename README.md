# 🟩 Survival to 21s

> *A tiny green square. A world full of angry red circles. One simple goal: don't die.*

[![License: CC0 Music](https://img.shields.io/badge/music-CC0%20Public%20Domain-brightgreen)](https://opengameart.org/content/music-loops)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/database-SQLite-blue)](https://www.sqlite.org)

---

## What is this?

You are a **green square**. The world is filled with **red circles** that hate you for no reason. They multiply. They accelerate. They will hunt you down.

Your only job is to survive for **21 seconds**.

Sounds easy. It is not.

---

## 🎮 How to Play

| Action | Control |
|---|---|
| Move | `↑` `↓` `←` `→` arrow keys |
| Dash | `Space` — burst of speed, 2s cooldown |
| Survive | Don't touch the circles |

### Enemy guide

| Color | Personality |
|---|---|
| 🔴 Red | Common. Relentless. Everywhere. |
| 🟣 Purple | Rare. A little faster. Still wants you dead. |
| 🔵 Blue | Very rare. You'll see one right before you lose. |

### Difficulty curve

Every **5 seconds**, more enemies get a **5× speed boost**. The longer you survive, the more of them are sprinting directly at your face.

A **gray decoy** appears every 5 seconds to lure 30% of enemies away. Use it wisely — it only lasts 3 seconds.

### The goal

Beat **21 seconds**. It sounds humble. Most people don't make it.

---

## 🏆 Leaderboard

This isn't just a solo game. Create an account, submit your score, and see how you stack up against everyone else.

- **Global leaderboard** — top 20 players, best score per person
- **My Scores** — your full personal history
- Scores are saved automatically on game over

---

## 🚀 Running Locally

```bash
# Clone the repo
git clone https://github.com/zhumingh/survival-to-21s.git
cd survival-to-21s

# Install dependencies
npm install

# Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

> For development with auto-restart on file changes:
> ```bash
> node --watch server.js
> ```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS (no frameworks) |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Auth | Session-based with bcrypt password hashing |
| Music | CC0 chiptune loop from [OpenGameArt.org](https://opengameart.org/content/music-loops) |

---

## 📁 Project Structure

```
├── server.js          # Express server — auth & scores API
├── public/
│   ├── index.html     # Game UI
│   ├── css/style.css  # All styles
│   ├── js/game.js     # Game logic, auth, leaderboard
│   └── music/bg.mp3   # Background music (CC0)
└── game.db            # SQLite database (auto-created)
```

---

## 💡 Tips for Surviving Past 21s

1. **Don't stop moving.** Standing still is how you die.
2. **Save your dash.** Use it to escape, not to go faster.
3. **Watch the decoy.** When the gray circle appears, enemies briefly lose interest in you — use that window.
4. **Hug the edges early.** The center is chaos after 15 seconds.
5. **Accept your fate.** The circles always win eventually.

---

## 🎵 Music

Background music: *"fast_background"* from [OpenGameArt.org](https://opengameart.org/content/music-loops), licensed **CC0 (Public Domain)**.

Click **♪** in the top-right corner during gameplay to mute.

---

*Built with Claude Code. Tested by dying approximately 47 times.*
