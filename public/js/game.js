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
    return `${Math.floor(ms / 1000)}s${String(ms % 1000).padStart(3, '0')}`;
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
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('keydown', (event) => {
    if (event.key in keys) keys[event.key] = true;
    if (event.key === ' ') triggerDash();
});
document.addEventListener('keyup', (event) => {
    if (event.key in keys) keys[event.key] = false;
});

gameArea.addEventListener('touchstart', handleTouchStart, false);
gameArea.addEventListener('touchmove', handleTouchMove, false);
gameArea.addEventListener('touchend', handleTouchEnd, false);

function handleTouchStart(evt) {
    const t = evt.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
}

function handleTouchMove(evt) {
    if (!touchStartX || !touchStartY) return;
    const dx = evt.touches[0].clientX - touchStartX;
    const dy = evt.touches[0].clientY - touchStartY;
    const degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

    keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    if (degrees >= 337.5 || degrees < 22.5)     keys.ArrowRight = true;
    else if (degrees < 67.5)                    keys.ArrowRight = keys.ArrowDown = true;
    else if (degrees < 112.5)                   keys.ArrowDown = true;
    else if (degrees < 157.5)                   keys.ArrowDown = keys.ArrowLeft = true;
    else if (degrees < 202.5)                   keys.ArrowLeft = true;
    else if (degrees < 247.5)                   keys.ArrowLeft = keys.ArrowUp = true;
    else if (degrees < 292.5)                   keys.ArrowUp = true;
    else                                        keys.ArrowUp = keys.ArrowRight = true;

    evt.preventDefault();
}

function handleTouchEnd() {
    keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    touchStartX = 0; touchStartY = 0;
}

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
    if (keys.ArrowUp)    dy -= step;
    if (keys.ArrowDown)  dy += step;
    if (keys.ArrowLeft)  dx -= step;
    if (keys.ArrowRight) dx += step;
    if (dx !== 0 && dy !== 0) { dx /= Math.sqrt(2); dy /= Math.sqrt(2); }

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
    const angle = Math.random() * 2 * Math.PI;
    const minDist = Math.max(gameArea.clientWidth, gameArea.clientHeight) / 4;
    const dist = minDist + Math.random() * minDist;

    enemy.style.left = `${Math.max(0, Math.min(gameArea.clientWidth - 10, centerX + Math.cos(angle) * dist))}px`;
    enemy.style.top  = `${Math.max(0, Math.min(gameArea.clientHeight - 10, centerY + Math.sin(angle) * dist))}px`;

    const sz = Math.random();
    const size = sz < 0.8 ? 10 : sz < 0.9 ? 20 : 30;
    enemy.style.width = `${size}px`;
    enemy.style.height = `${size}px`;

    gameArea.appendChild(enemy);
    enemies.push({ element: enemy, xSpeed: (Math.random() - 0.5) * 6, ySpeed: (Math.random() - 0.5) * 6 });
}

let nearMissTimeout = null;

function updateEnemies() {
    if (!gameRunning) return;
    const playerRect = player.getBoundingClientRect();
    const fastCount = Math.min(Math.floor(elapsedSeconds / 5), enemies.length);
    const fastEnemies = enemies.slice(0, fastCount);
    let nearMiss = false;

    enemies = enemies.filter((enemyObj) => {
        const enemy = enemyObj.element;
        const enemyRect = enemy.getBoundingClientRect();
        const dx = playerRect.left - enemyRect.left;
        const dy = playerRect.top - enemyRect.top;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > Math.max(gameArea.clientWidth, gameArea.clientHeight) / 2) {
            gameArea.removeChild(enemy);
            return false;
        }

        const dirX = dx / dist;
        const dirY = dy / dist;
        const spd = fastEnemies.includes(enemyObj) ? 5 : 1;
        let newLeft = parseFloat(enemy.style.left) + (dirX * 2 + enemyObj.xSpeed) * (Math.random() * 0.5 + 0.75) * spd;
        let newTop  = parseFloat(enemy.style.top)  + (dirY * 2 + enemyObj.ySpeed) * (Math.random() * 0.5 + 0.75) * spd;

        if (newLeft <= 0 || newLeft >= gameArea.clientWidth - 10)  { enemyObj.xSpeed = -enemyObj.xSpeed; newLeft = Math.max(0, Math.min(gameArea.clientWidth - 10, newLeft)); }
        if (newTop  <= 0 || newTop  >= gameArea.clientHeight - 10) { enemyObj.ySpeed = -enemyObj.ySpeed; newTop  = Math.max(0, Math.min(gameArea.clientHeight - 10, newTop)); }

        enemy.style.left = `${newLeft}px`;
        enemy.style.top  = `${newTop}px`;

        if (isCollision(playerRect, enemyRect)) { endGame(); return true; }
        if (dist < 25) nearMiss = true;
        return true;
    });

    if (nearMiss && !player.classList.contains('dashing')) {
        player.classList.add('near-miss');
        clearTimeout(nearMissTimeout);
        nearMissTimeout = setTimeout(() => player.classList.remove('near-miss'), 120);
    }
}

function isCollision(r1, r2) {
    return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
}

// ===== HELPER DECOY =====
function createHelper() {
    const helper = document.createElement('div');
    helper.classList.add('helper');
    Object.assign(helper.style, {
        position: 'absolute', width: '20px', height: '20px',
        backgroundColor: '#e0e0e0', borderRadius: '50%',
        left: `${Math.random() * (gameArea.clientWidth - 20)}px`,
        top:  `${Math.random() * (gameArea.clientHeight - 20)}px`
    });
    gameArea.appendChild(helper);

    const attracted = enemies.filter(() => Math.random() < 0.3);
    attracted.forEach(e => { e.attractedToHelper = true; });
    setTimeout(() => {
        if (helper.parentNode === gameArea) gameArea.removeChild(helper);
        attracted.forEach(e => { e.attractedToHelper = false; });
    }, 3000);
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
    pauseMusic();

    const finalMs = currentElapsedMs;
    const finalSecs = Math.floor(finalMs / 1000);

    // Update local high score
    if (finalSecs > highScore) {
        highScore = finalSecs;
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

    // Build game over UI
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.7);z-index:1000;';
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:1001;width:80%;max-width:420px;opacity:0;';
    document.body.appendChild(container);

    drawPlayerPath();

    container.innerHTML = `
        <div style="color:#FF4136;font-size:36px;font-weight:bold;margin-bottom:16px;">Game Over!</div>
        <div style="color:#fff;font-size:24px;margin-bottom:6px;">Score: ${fmtScore(finalMs)}</div>
        <div style="color:#ffd700;font-size:16px;margin-bottom:6px;">Best: ${highScore}s</div>
        <div style="color:#fff;font-size:18px;margin-bottom:16px;">Steps: ${playerPath.length}</div>
        ${currentUser ? '<div style="color:#4CAF50;font-size:13px;margin-bottom:12px;">Score saved!</div>' : ''}
    `;

    const lbBtn = document.createElement('button');
    lbBtn.textContent = 'View Leaderboard';
    lbBtn.style.cssText = 'padding:8px 18px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:white;border-radius:6px;cursor:pointer;font-size:14px;margin-bottom:20px;';
    lbBtn.addEventListener('click', showLeaderboard);
    container.appendChild(lbBtn);

    // Cleanup enemies + helpers
    enemies.forEach(e => { if (e.element.parentNode === gameArea) gameArea.removeChild(e.element); });
    enemies = [];
    gameArea.querySelectorAll('.helper').forEach(h => { if (h.parentNode === gameArea) gameArea.removeChild(h); });

    setTimeout(() => {
        const restartMsg = document.createElement('div');
        restartMsg.textContent = 'Press any key or tap to restart';
        restartMsg.style.cssText = 'color:#7FDBFF;font-size:16px;cursor:pointer;';
        container.appendChild(restartMsg);

        function restart() {
            document.body.removeChild(overlay);
            document.body.removeChild(container);
            document.removeEventListener('keydown', restart);
            document.removeEventListener('touchstart', restart);
            startGame();
        }
        document.addEventListener('keydown', restart);
        document.addEventListener('touchstart', restart);
    }, 2000);

    let opacity = 0;
    const fadeIn = setInterval(() => {
        opacity = Math.min(1, opacity + 0.1);
        container.style.opacity = opacity;
        if (opacity >= 1) clearInterval(fadeIn);
    }, 50);
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
    elapsedSeconds = 0;
    currentElapsedMs = 0;
    isDashing = false;
    dashCooldown = false;
    dashIndicator.style.transition = 'none';
    dashIndicator.style.width = '100%';
    gameRunning = true;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    for (let i = 0; i < (isMobile ? 10 : 40); i++) createEnemy();

    gameStartTime = Date.now();
    gameInterval = setInterval(() => {
        currentElapsedMs = Date.now() - gameStartTime;
        elapsedSeconds = Math.floor(currentElapsedMs / 1000);
        scoreDisplay.textContent = `Progress: ${elapsedSeconds}s${String(currentElapsedMs % 1000).padStart(3, '0')}`;
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
