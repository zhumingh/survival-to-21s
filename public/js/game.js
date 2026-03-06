// Written by Ken Zhu (zhumingh@gmail.com) with the power of Claude Code

// ===== DOM REFS =====
const gameArea = document.getElementById('gameArea');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const dashIndicator = document.getElementById('dashIndicator');

// ===== AUTH STATE =====
let currentUser = null;
let authMode = 'login';

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
            currentUser = data.user;
            onLoggedIn();
        } else {
            showAuthScreen();
        }
    } catch {
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('gameInstructions').style.display = 'none';
}

function onLoggedIn() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('gameInstructions').style.display = 'flex';
    document.getElementById('loggedInUsername').textContent = currentUser.username;
    document.getElementById('currentUserDisplay').textContent = currentUser.username;
}

document.getElementById('authSubmit').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    if (!username || !password) { errorEl.textContent = 'Please fill in all fields'; return; }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    errorEl.textContent = '';

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error; return; }
        currentUser = { username: data.username };
        onLoggedIn();
    } catch {
        errorEl.textContent = 'Connection error. Please try again.';
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

document.getElementById('authToggleBtn').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('authFormTitle').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    document.getElementById('authSubmit').textContent    = authMode === 'login' ? 'Sign In' : 'Create Account';
    document.getElementById('authToggleBtn').textContent =
        authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in';
    document.getElementById('authError').textContent = '';
});

document.getElementById('authUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authPassword').focus();
});
document.getElementById('authPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authSubmit').click();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authError').textContent = '';
    document.getElementById('gameInstructions').style.display = 'none';
    showAuthScreen();
});

// ===== LEADERBOARD =====
let currentLbTab = 'global';

document.getElementById('leaderboardBtn').addEventListener('click', showLeaderboard);
document.getElementById('leaderboardClose').addEventListener('click', () => {
    document.getElementById('leaderboardOverlay').style.display = 'none';
});

document.querySelectorAll('.lb-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLbTab = btn.dataset.tab;
        loadLeaderboardTab(currentLbTab);
    });
});

function showLeaderboard() {
    document.getElementById('leaderboardOverlay').style.display = 'flex';
    loadLeaderboardTab(currentLbTab);
}

function fmtScore(ms) {
    const s  = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${s}.${String(cs).padStart(2, '0')}s`;
}

async function loadLeaderboardTab(tab) {
    const contentEl = document.getElementById('leaderboardContent');
    contentEl.textContent = 'Loading...';

    try {
        const url = tab === 'global' ? '/api/leaderboard' : '/api/scores/me';
        const res = await fetch(url);
        if (res.status === 401) { contentEl.textContent = 'Login to see your scores.'; return; }
        const rows = await res.json();

        if (!rows.length) {
            contentEl.textContent = tab === 'global' ? 'No scores yet. Be the first!' : 'No scores yet. Play a game!';
            return;
        }

        const table = document.createElement('table');
        table.className = 'lb-table';

        if (tab === 'global') {
            table.innerHTML = `<thead><tr><th>#</th><th>Player</th><th>Time</th><th>Steps</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            rows.forEach((row, i) => {
                const tr = document.createElement('tr');
                if (currentUser && row.username === currentUser.username) tr.className = 'lb-me';
                tr.innerHTML = `<td>${i + 1}</td><td>${row.username}</td><td>${fmtScore(row.score_ms)}</td><td>${row.steps}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
        } else {
            table.innerHTML = `<thead><tr><th>#</th><th>Time</th><th>Steps</th><th>Date</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            rows.forEach((row, i) => {
                const tr = document.createElement('tr');
                const date = new Date(row.played_at).toLocaleDateString();
                tr.innerHTML = `<td>${i + 1}</td><td>${fmtScore(row.score_ms)}</td><td>${row.steps}</td><td>${date}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
        }

        contentEl.innerHTML = '';
        contentEl.appendChild(table);
    } catch {
        contentEl.textContent = 'Failed to load scores.';
    }
}

// ===== GAME STATE =====
let enemies = [];
let gameInterval;
let enemyInterval;
let helperInterval;
let gameRunning = false;

// Helper (decoy) — stored as coords so attracted enemies can actually chase it
let helperPos = null;  // { x, y }
let helperEl  = null;

// Per-run stats
let closestCall   = Infinity; // min center-to-center px between player and any enemy
let enemiesDodged = 0;
let milestoneShown = new Set();
let milestoneTimer = null;
let gameStartTime = null;
let currentElapsedMs = 0;
let elapsedSeconds = 0;
const MAX_ENEMIES = 200;

// Dash
let isDashing = false;
let dashCooldown = false;
const DASH_DURATION = 180;
const DASH_COOLDOWN = 2000;

// High score (local)
let highScore = parseInt(localStorage.getItem('dodge_highscore') || '0');
highScoreDisplay.textContent = `Best: ${highScore}s`;

// Player
let playerPath = [];
let playerPos = {
    x: Math.floor(gameArea.clientWidth / 2 - player.clientWidth / 2),
    y: Math.floor(gameArea.clientHeight / 2 - player.clientHeight / 2)
};
player.style.left = `${playerPos.x}px`;
player.style.top = `${playerPos.y}px`;

// Keys
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

document.addEventListener('keydown', (event) => {
    if (event.key in keys) keys[event.key] = true;
    if (event.key === ' ') triggerDash();
});
document.addEventListener('keyup', (event) => {
    if (event.key in keys) keys[event.key] = false;
});

// Touch: follow-finger (mobile moves toward wherever finger is)
let touchTarget = null; // { x, y } in gameArea coords

gameArea.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = gameArea.getBoundingClientRect();
    const t = e.touches[0];
    touchTarget = { x: t.clientX - r.left, y: t.clientY - r.top };
}, { passive: false });

gameArea.addEventListener('touchmove', e => {
    e.preventDefault();
    const r = gameArea.getBoundingClientRect();
    const t = e.touches[0];
    touchTarget = { x: t.clientX - r.left, y: t.clientY - r.top };
}, { passive: false });

gameArea.addEventListener('touchend',    () => { touchTarget = null; });
gameArea.addEventListener('touchcancel', () => { touchTarget = null; });

// ===== DASH =====
function triggerDash() {
    if (isDashing || dashCooldown) return;
    isDashing = true;
    dashCooldown = true;
    player.classList.add('dashing');

    setTimeout(() => { isDashing = false; player.classList.remove('dashing'); }, DASH_DURATION);

    dashIndicator.style.transition = 'none';
    dashIndicator.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        dashIndicator.style.transition = `width ${DASH_COOLDOWN}ms linear`;
        dashIndicator.style.width = '100%';
    }));

    setTimeout(() => { dashCooldown = false; }, DASH_COOLDOWN);
}

// ===== PLAYER =====
function movePlayer() {
    const step = isDashing ? 35 : 10;
    let dx = 0, dy = 0;

    if (touchTarget) {
        // Follow-finger: move toward touch point
        const cx  = playerPos.x + 5;
        const cy  = playerPos.y + 5;
        const tdx = touchTarget.x - cx;
        const tdy = touchTarget.y - cy;
        const d   = Math.sqrt(tdx * tdx + tdy * tdy);
        if (d > 2) { dx = (tdx / d) * step; dy = (tdy / d) * step; }
    } else {
        if (keys.ArrowUp)    dy -= step;
        if (keys.ArrowDown)  dy += step;
        if (keys.ArrowLeft)  dx -= step;
        if (keys.ArrowRight) dx += step;
        if (dx !== 0 && dy !== 0) { dx /= Math.sqrt(2); dy /= Math.sqrt(2); }
    }

    playerPos.x = Math.max(0, Math.min(gameArea.clientWidth - player.clientWidth, playerPos.x + dx));
    playerPos.y = Math.max(0, Math.min(gameArea.clientHeight - player.clientHeight, playerPos.y + dy));
    player.style.left = `${playerPos.x}px`;
    player.style.top = `${playerPos.y}px`;
    playerPath.push({ x: playerPos.x, y: playerPos.y });
}

// ===== ENEMIES =====
function createEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;

    const enemy = document.createElement('div');
    enemy.classList.add('enemy');

    const rn = Math.random();
    enemy.style.backgroundColor = rn < 0.8 ? '#ff0000' : rn < 0.95 ? '#800080' : '#0000ff';

    const centerX = gameArea.clientWidth / 2;
    const centerY = gameArea.clientHeight / 2;
    const angle   = Math.random() * 2 * Math.PI;
    const minDist = Math.max(gameArea.clientWidth, gameArea.clientHeight) / 4;
    const dist    = minDist + Math.random() * minDist;

    const ex = Math.max(0, Math.min(gameArea.clientWidth - 10,  centerX + Math.cos(angle) * dist));
    const ey = Math.max(0, Math.min(gameArea.clientHeight - 10, centerY + Math.sin(angle) * dist));
    enemy.style.left = `${ex}px`;
    enemy.style.top  = `${ey}px`;

    const sz   = Math.random();
    const size = sz < 0.8 ? 10 : sz < 0.9 ? 20 : 30;
    enemy.style.width  = `${size}px`;
    enemy.style.height = `${size}px`;

    gameArea.appendChild(enemy);
    enemies.push({ element: enemy, x: ex, y: ey, size, xSpeed: (Math.random() - 0.5) * 6, ySpeed: (Math.random() - 0.5) * 6 });
}

let nearMissTimeout = null;
const PLAYER_SIZE   = 10;

function updateEnemies() {
    if (!gameRunning) return;
    const px      = playerPos.x;
    const py      = playerPos.y;
    const maxDim  = Math.max(gameArea.clientWidth, gameArea.clientHeight);
    const fastCount = Math.min(Math.floor(elapsedSeconds / 5), enemies.length);
    let nearMiss  = false;

    enemies = enemies.filter((enemyObj, index) => {
        // Distance from player using stored positions — no DOM layout reads
        const cdx = px - enemyObj.x;
        const cdy = py - enemyObj.y;
        const cd2 = cdx * cdx + cdy * cdy;

        // Cull if drifted too far
        if (cd2 > (maxDim / 2) * (maxDim / 2)) {
            gameArea.removeChild(enemyObj.element);
            enemiesDodged++;
            return false;
        }

        const cd = Math.sqrt(cd2);
        if (cd < closestCall) closestCall = cd;

        // Target: helper decoy if attracted, otherwise player
        let targetX = px, targetY = py;
        if (enemyObj.attractedToHelper && helperPos) {
            targetX = helperPos.x;
            targetY = helperPos.y;
        }

        const tdx   = targetX - enemyObj.x;
        const tdy   = targetY - enemyObj.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        const dirX  = tdx / tdist;
        const dirY  = tdy / tdist;
        const spd   = index < fastCount ? 5 : 1;

        enemyObj.x += (dirX * 2 + enemyObj.xSpeed) * (Math.random() * 0.5 + 0.75) * spd;
        enemyObj.y += (dirY * 2 + enemyObj.ySpeed) * (Math.random() * 0.5 + 0.75) * spd;

        // Bounce off walls
        if (enemyObj.x <= 0 || enemyObj.x >= gameArea.clientWidth - enemyObj.size) {
            enemyObj.xSpeed = -enemyObj.xSpeed;
            enemyObj.x = Math.max(0, Math.min(gameArea.clientWidth - enemyObj.size, enemyObj.x));
        }
        if (enemyObj.y <= 0 || enemyObj.y >= gameArea.clientHeight - enemyObj.size) {
            enemyObj.ySpeed = -enemyObj.ySpeed;
            enemyObj.y = Math.max(0, Math.min(gameArea.clientHeight - enemyObj.size, enemyObj.y));
        }

        enemyObj.element.style.left = `${enemyObj.x}px`;
        enemyObj.element.style.top  = `${enemyObj.y}px`;

        // AABB collision (skip if dashing — dash is invincible)
        if (!isDashing && !(px + PLAYER_SIZE < enemyObj.x || px > enemyObj.x + enemyObj.size ||
                             py + PLAYER_SIZE < enemyObj.y || py > enemyObj.y + enemyObj.size)) {
            endGame();
        }

        if (cd < 25) nearMiss = true;
        return true;
    });

    if (nearMiss && !player.classList.contains('dashing')) {
        player.classList.add('near-miss');
        clearTimeout(nearMissTimeout);
        nearMissTimeout = setTimeout(() => player.classList.remove('near-miss'), 120);
    }
}

// ===== HELPER DECOY =====
function createHelper() {
    // Remove any still-active helper
    if (helperEl && helperEl.parentNode === gameArea) gameArea.removeChild(helperEl);

    const hx = Math.random() * (gameArea.clientWidth  - 20);
    const hy = Math.random() * (gameArea.clientHeight - 20);
    helperPos = { x: hx, y: hy };

    helperEl = document.createElement('div');
    helperEl.classList.add('helper');
    Object.assign(helperEl.style, {
        position: 'absolute', width: '20px', height: '20px',
        backgroundColor: '#e0e0e0', borderRadius: '50%',
        boxShadow: '0 0 8px #fff',
        left: `${hx}px`, top: `${hy}px`
    });
    gameArea.appendChild(helperEl);

    const attracted = enemies.filter(() => Math.random() < 0.3);
    attracted.forEach(e => { e.attractedToHelper = true; });

    setTimeout(() => {
        if (helperEl && helperEl.parentNode === gameArea) gameArea.removeChild(helperEl);
        helperEl  = null;
        helperPos = null;
        attracted.forEach(e => { e.attractedToHelper = false; });
    }, 3000);
}

// ===== MILESTONE FLASH =====
function showMilestone(text) {
    const el = document.getElementById('milestone');
    if (!el) return;
    clearTimeout(milestoneTimer);
    el.textContent = text;
    el.style.opacity = '1';
    milestoneTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

// ===== PATH DRAWING =====
function drawPlayerPath() {
    const canvas = document.createElement('canvas');
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
    Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '999' });
    gameArea.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerPath[0].x, playerPath[0].y);
    for (let i = 1; i < playerPath.length - 1; i++) {
        const cp = { x: (playerPath[i].x + playerPath[i + 1].x) / 2, y: (playerPath[i].y + playerPath[i + 1].y) / 2 };
        ctx.bezierCurveTo(playerPath[i].x, playerPath[i].y, cp.x, cp.y, playerPath[i + 1].x, playerPath[i + 1].y);
    }
    ctx.lineTo(playerPath[playerPath.length - 1].x, playerPath[playerPath.length - 1].y);
    ctx.stroke();
}

// ===== END GAME =====
function endGame() {
    if (!gameRunning) return;
    gameRunning = false;

    clearInterval(gameInterval);
    clearInterval(enemyInterval);
    clearInterval(helperInterval);
    clearTimeout(milestoneTimer);
    pauseMusic();

    const finalMs   = currentElapsedMs;
    const finalSecs = finalMs / 1000;

    // Update local high score
    if (Math.floor(finalSecs) > highScore) {
        highScore = Math.floor(finalSecs);
        localStorage.setItem('dodge_highscore', highScore);
        highScoreDisplay.textContent = `Best: ${highScore}s`;
    }

    // Submit score to server
    if (currentUser) {
        fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scoreMs: finalMs, steps: playerPath.length })
        }).catch(console.error);
    }

    // ── Star rating ──────────────────────────────────────────────────
    let stars, rank, rankColor;
    if (finalSecs >= 21)      { stars = 5; rank = 'LEGENDARY';    rankColor = '#FF6EC7'; }
    else if (finalSecs >= 15) { stars = 4; rank = 'IMPRESSIVE';   rankColor = '#FFD700'; }
    else if (finalSecs >= 10) { stars = 3; rank = 'NOT BAD';      rankColor = '#00CFFF'; }
    else if (finalSecs >= 5)  { stars = 2; rank = 'KEEP GOING';   rankColor = '#aaa'; }
    else                      { stars = 1; rank = 'JUST STARTED'; rankColor = '#777'; }

    // ── Closest-call label ───────────────────────────────────────────
    const cpx = closestCall === Infinity ? 999 : closestCall;
    const callLabel = cpx < 15 ? "Hair's breadth!" : cpx < 30 ? 'Close shave!' : cpx < 60 ? 'Careful!' : 'Comfortable';
    const closestPx = closestCall === Infinity ? '—' : Math.round(closestCall) + 'px';

    // ── Milestone badges ─────────────────────────────────────────────
    const badgeHTML = [10, 20, 30]
        .filter(s => milestoneShown.has(s))
        .map((s, i) => `<span class="go-badge" style="animation-delay:${1.4 + i * 0.12}s">${s}s SURVIVED</span>`)
        .join('');

    // ── Overlay ──────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:1000;';
    document.body.appendChild(overlay);

    // ── Panel ────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'go-panel';
    panel.innerHTML = `
        <div class="go-title">GAME OVER</div>
        <div class="go-time" id="goTimeCounter">0.00s</div>
        <div class="go-stars" id="goStars"></div>
        <div class="go-rank" id="goRank" style="color:${rankColor};animation-delay:0.9s">${rank}</div>
        <div class="go-stats">
            <div class="go-stat" style="animation-delay:1.0s">
                <div class="go-stat-label">Time survived</div>
                <div class="go-stat-value">${fmtScore(finalMs)}</div>
            </div>
            <div class="go-stat" style="animation-delay:1.05s">
                <div class="go-stat-label">Best ever</div>
                <div class="go-stat-value">${highScore}s</div>
            </div>
            <div class="go-stat" style="animation-delay:1.1s">
                <div class="go-stat-label">Steps taken</div>
                <div class="go-stat-value">${playerPath.length.toLocaleString()}</div>
            </div>
            <div class="go-stat" style="animation-delay:1.15s">
                <div class="go-stat-label">Enemies dodged</div>
                <div class="go-stat-value">${enemiesDodged}</div>
            </div>
            <div class="go-stat" style="animation-delay:1.2s">
                <div class="go-stat-label">Closest call</div>
                <div class="go-stat-value">${closestPx}</div>
            </div>
            <div class="go-stat" style="animation-delay:1.25s">
                <div class="go-stat-label">Proximity</div>
                <div class="go-stat-value" style="font-size:13px;padding-top:3px">${callLabel}</div>
            </div>
        </div>
        <div class="go-badges">${badgeHTML}</div>
        ${currentUser ? '<div class="go-saved" style="animation-delay:1.5s">Score saved to leaderboard!</div>' : ''}
    `;
    document.body.appendChild(panel);

    drawPlayerPath();

    // Cleanup enemies + helpers
    enemies.forEach(e => { if (e.element.parentNode === gameArea) gameArea.removeChild(e.element); });
    enemies = [];
    if (helperEl && helperEl.parentNode === gameArea) gameArea.removeChild(helperEl);
    helperEl = null; helperPos = null;

    // Animated time counter (counts up from 0 to final time over 1.3s)
    const timeEl     = document.getElementById('goTimeCounter');
    const countStart = performance.now();
    const countDur   = 1300;
    (function tick(now) {
        const p  = Math.min((now - countStart) / countDur, 1);
        const ms = Math.round(finalMs * p);
        const s  = Math.floor(ms / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        timeEl.textContent = `${s}.${String(cs).padStart(2, '0')}s`;
        if (p < 1) requestAnimationFrame(tick);
    })(performance.now());

    // Stars pop in one by one
    const starsEl = document.getElementById('goStars');
    for (let i = 0; i < 5; i++) {
        const star = document.createElement('span');
        star.className = 'go-star';
        star.textContent = i < stars ? '★' : '☆';
        star.style.color = i < stars ? '#FFD700' : 'rgba(255,255,255,0.15)';
        star.style.animationDelay = (1.0 + i * 0.12) + 's';
        starsEl.appendChild(star);
    }

    // Leaderboard button
    const lbBtn = document.createElement('button');
    lbBtn.className   = 'go-lb-btn';
    lbBtn.textContent = 'View Leaderboard';
    lbBtn.addEventListener('click', showLeaderboard);
    panel.appendChild(lbBtn);

    // Restart prompt after 2.5s
    setTimeout(() => {
        const restartMsg = document.createElement('div');
        restartMsg.className   = 'go-restart';
        restartMsg.textContent = 'Press any key or tap to restart';
        panel.appendChild(restartMsg);

        function restart() {
            document.body.removeChild(overlay);
            document.body.removeChild(panel);
            document.removeEventListener('keydown', restart);
            document.removeEventListener('touchstart', restart);
            startGame();
        }
        document.addEventListener('keydown', restart);
        document.addEventListener('touchstart', restart);
    }, 2500);
}

// ===== START GAME =====
function startGame() {
    const existingCanvas = gameArea.querySelector('canvas');
    if (existingCanvas) gameArea.removeChild(existingCanvas);

    playerPos = {
        x: gameArea.clientWidth / 2 - player.clientWidth / 2,
        y: gameArea.clientHeight / 2 - player.clientHeight / 2
    };
    player.style.left = `${playerPos.x}px`;
    player.style.top = `${playerPos.y}px`;
    player.style.transform = '';
    player.className = 'player';

    playerPath = [{ x: playerPos.x, y: playerPos.y }];
    enemies = [];
    elapsedSeconds   = 0;
    currentElapsedMs = 0;
    isDashing        = false;
    dashCooldown     = false;
    closestCall      = Infinity;
    enemiesDodged    = 0;
    milestoneShown   = new Set();
    helperPos        = null;
    helperEl         = null;
    dashIndicator.style.transition = 'none';
    dashIndicator.style.width = '100%';
    gameRunning = true;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    for (let i = 0; i < (isMobile ? 10 : 40); i++) createEnemy();

    gameStartTime = Date.now();
    gameInterval = setInterval(() => {
        currentElapsedMs = Date.now() - gameStartTime;
        elapsedSeconds = Math.floor(currentElapsedMs / 1000);
        const cs = Math.floor((currentElapsedMs % 1000) / 10);
        scoreDisplay.textContent = `Progress: ${elapsedSeconds}.${String(cs).padStart(2, '0')}s`;

        // Milestone speed-up alerts
        if (elapsedSeconds >= 10 && !milestoneShown.has(10)) { milestoneShown.add(10); showMilestone('SPEED UP!'); }
        if (elapsedSeconds >= 20 && !milestoneShown.has(20)) { milestoneShown.add(20); showMilestone('FASTER!'); }
        if (elapsedSeconds >= 30 && !milestoneShown.has(30)) { milestoneShown.add(30); showMilestone('MAXIMUM SPEED!'); }

        movePlayer();
        updateEnemies();
    }, 50);

    enemyInterval = setInterval(createEnemy, 100);
    helperInterval = setInterval(createHelper, 5000);
    bgMusic.currentTime = 0;
    playMusic();
}

// ===== MUSIC =====
const bgMusic = document.getElementById('bgMusic');
bgMusic.volume = 0.3;
let musicMuted = false;

function playMusic() {
    if (musicMuted) return;
    bgMusic.play().catch(() => {}); // ignore autoplay policy errors
}
function pauseMusic() {
    bgMusic.pause();
}

document.getElementById('muteBtn').addEventListener('click', () => {
    musicMuted = !musicMuted;
    document.getElementById('muteBtn').classList.toggle('muted', musicMuted);
    if (musicMuted) {
        bgMusic.pause();
    } else if (gameRunning) {
        bgMusic.play().catch(() => {});
    }
});

// ===== EVENT LISTENERS =====
document.getElementById('backToIndex').addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the game?')) window.location.href = 'index.html';
});

document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('gameInstructions').style.display = 'none';
    startGame();
});

// ===== INIT =====
checkAuth();
