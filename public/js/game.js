// Written by Ken Zhu (zhumingh@gmail.com) with the power of Claude Code

// ===== DOM REFS =====
const gameArea = document.getElementById('gameArea');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const dashIndicator = document.getElementById('dashIndicator');

// ===== COUNTRY DATA =====
const COUNTRIES = [
    ['AF','Afghanistan'],['AL','Albania'],['DZ','Algeria'],['AR','Argentina'],
    ['AU','Australia'],['AT','Austria'],['BE','Belgium'],['BR','Brazil'],
    ['CA','Canada'],['CL','Chile'],['CN','China'],['CO','Colombia'],
    ['HR','Croatia'],['CZ','Czech Republic'],['DK','Denmark'],['EG','Egypt'],
    ['FI','Finland'],['FR','France'],['DE','Germany'],['GR','Greece'],
    ['HK','Hong Kong'],['HU','Hungary'],['IN','India'],['ID','Indonesia'],
    ['IR','Iran'],['IQ','Iraq'],['IE','Ireland'],['IL','Israel'],
    ['IT','Italy'],['JP','Japan'],['JO','Jordan'],['KZ','Kazakhstan'],
    ['KE','Kenya'],['KR','South Korea'],['KW','Kuwait'],['LB','Lebanon'],
    ['MY','Malaysia'],['MX','Mexico'],['MA','Morocco'],['NL','Netherlands'],
    ['NZ','New Zealand'],['NG','Nigeria'],['NO','Norway'],['PK','Pakistan'],
    ['PE','Peru'],['PH','Philippines'],['PL','Poland'],['PT','Portugal'],
    ['QA','Qatar'],['RO','Romania'],['RU','Russia'],['SA','Saudi Arabia'],
    ['RS','Serbia'],['SG','Singapore'],['ZA','South Africa'],['ES','Spain'],
    ['LK','Sri Lanka'],['SE','Sweden'],['CH','Switzerland'],['TW','Taiwan'],
    ['TH','Thailand'],['TR','Turkey'],['UA','Ukraine'],['AE','UAE'],
    ['GB','United Kingdom'],['US','United States'],['VN','Vietnam']
];

const COUNTRY_MAP = Object.fromEntries(COUNTRIES.map(([c, n]) => [c, n]));

function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    const base = 0x1F1E6;
    return String.fromCodePoint(base + code.charCodeAt(0) - 65) +
           String.fromCodePoint(base + code.charCodeAt(1) - 65);
}

function countryName(code) {
    return COUNTRY_MAP[code] || code;
}

// Populate country select
(function () {
    const sel = document.getElementById('authCountry');
    COUNTRIES.forEach(([code, name]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${countryFlag(code)} ${name}`;
        sel.appendChild(opt);
    });
})();

// ===== AUTH STATE =====
let currentUser = null;
let authMode = 'login';

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
            currentUser = { ...data.user, country: data.user.country || '' };
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

let storyShown = false;

function onLoggedIn() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('loggedInUsername').textContent = currentUser.username;
    const flag = countryFlag(currentUser.country);
    document.getElementById('currentUserDisplay').textContent =
        (flag ? flag + ' ' : '') + currentUser.username;

    if (storyShown) {
        showLobby();
    } else {
        storyShown = true;
        showStory();
    }
}

function showLobby() {
    document.getElementById('gameInstructions').style.display = 'flex';
}

function showStory() {
    const screen  = document.getElementById('storyScreen');
    const paras   = Array.from(document.querySelectorAll('.story-para'));
    const beginBtn = document.getElementById('storyBeginBtn');
    const skipBtn  = document.getElementById('storySkipBtn');

    screen.style.opacity = '0';
    screen.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        screen.style.opacity = '1';
    }));

    const SHOW_MS  = 3400; // how long each paragraph stays visible
    const FADE_MS  = 1300; // matches CSS transition duration
    const timers   = [];
    let   current  = -1;

    function nextPara() {
        // Fade out current
        if (current >= 0) paras[current].classList.remove('visible');
        current++;
        if (current < paras.length) {
            // Fade in next after the outgoing fade finishes
            timers.push(setTimeout(() => {
                paras[current].classList.add('visible');
                timers.push(setTimeout(nextPara, SHOW_MS));
            }, current === 0 ? 0 : FADE_MS));
        } else {
            // All done — show begin button
            timers.push(setTimeout(() => beginBtn.classList.add('visible'), FADE_MS));
        }
    }
    timers.push(setTimeout(nextPara, 400));

    function proceed() {
        timers.forEach(clearTimeout);
        screen.style.opacity = '0';
        skipBtn.removeEventListener('click', proceed);
        beginBtn.removeEventListener('click', proceed);
        document.removeEventListener('keydown', onKey);
        setTimeout(() => {
            screen.style.display = 'none';
            // Reset for next time it might be shown
            paras.forEach(p => p.classList.remove('visible'));
            beginBtn.classList.remove('visible');
            showLobby();
        }, 700);
    }

    function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') proceed();
    }

    beginBtn.addEventListener('click', proceed);
    skipBtn.addEventListener('click', proceed);
    document.addEventListener('keydown', onKey);
}

// ===== PASSWORD STRENGTH =====
function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 0, label: 'Weak', color: '#ff4444' };
    if (score <= 2) return { level: 1, label: 'Fair', color: '#ffaa00' };
    if (score <= 3) return { level: 2, label: 'Good', color: '#00cc66' };
    return { level: 3, label: 'Strong', color: '#00ff88' };
}

function updateStrengthBar() {
    const pw = document.getElementById('authPassword').value;
    const bar = document.getElementById('strengthBar');
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (authMode !== 'register' || !pw) {
        fill.style.width = '0%';
        label.textContent = '';
        return;
    }
    const s = getPasswordStrength(pw);
    const pct = [20, 45, 75, 100][s.level];
    fill.style.width = pct + '%';
    fill.style.background = s.color;
    label.textContent = s.label;
    label.style.color = s.color;
}

document.getElementById('authPassword').addEventListener('input', () => {
    updateStrengthBar();
    if (authMode === 'register') validateConfirmPassword();
});

// ===== SHOW/HIDE PASSWORD =====
document.getElementById('pwToggle').addEventListener('click', () => {
    const pwInput = document.getElementById('authPassword');
    const btn = document.getElementById('pwToggle');
    const showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    btn.classList.toggle('showing', !showing);
});

// ===== CONFIRM PASSWORD =====
function validateConfirmPassword() {
    if (authMode !== 'register') return true;
    const pw = document.getElementById('authPassword').value;
    const cpw = document.getElementById('authConfirmPassword').value;
    const hint = document.getElementById('confirmHint');
    const input = document.getElementById('authConfirmPassword');
    if (!cpw) { hint.textContent = ''; hint.className = 'input-hint'; input.classList.remove('input-error', 'input-valid'); return false; }
    if (pw !== cpw) {
        hint.textContent = 'Passwords do not match';
        hint.className = 'input-hint error';
        input.classList.add('input-error');
        input.classList.remove('input-valid');
        return false;
    }
    hint.textContent = 'Passwords match';
    hint.className = 'input-hint success';
    input.classList.remove('input-error');
    input.classList.add('input-valid');
    return true;
}
document.getElementById('authConfirmPassword').addEventListener('input', validateConfirmPassword);

// ===== USERNAME VALIDATION =====
document.getElementById('authUsername').addEventListener('input', () => {
    if (authMode !== 'register') return;
    const val = document.getElementById('authUsername').value;
    const hint = document.getElementById('usernameHint');
    const input = document.getElementById('authUsername');
    if (!val) { hint.textContent = ''; hint.className = 'input-hint'; input.classList.remove('input-error', 'input-valid'); return; }
    if (val.length < 2) {
        hint.textContent = 'At least 2 characters';
        hint.className = 'input-hint error';
        input.classList.add('input-error');
        input.classList.remove('input-valid');
    } else if (!/^[a-zA-Z0-9_]+$/.test(val)) {
        hint.textContent = 'Letters, numbers, underscore only';
        hint.className = 'input-hint error';
        input.classList.add('input-error');
        input.classList.remove('input-valid');
    } else {
        hint.textContent = '';
        hint.className = 'input-hint';
        input.classList.remove('input-error');
        input.classList.add('input-valid');
    }
});

// ===== AUTH SUBMIT =====
document.getElementById('authSubmit').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    if (!username || !password) { errorEl.textContent = 'Please fill in all fields'; return; }

    if (authMode === 'register') {
        if (username.length < 2 || username.length > 20) { errorEl.textContent = 'Username must be 2–20 characters'; return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) { errorEl.textContent = 'Username: letters, numbers, underscore only'; return; }
        if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters'; return; }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { errorEl.textContent = 'Password needs both letters and numbers'; return; }
        if (!validateConfirmPassword()) { errorEl.textContent = 'Passwords do not match'; return; }
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    errorEl.textContent = '';

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = { username, password };
    if (authMode === 'register') {
        body.country = document.getElementById('authCountry').value;
        body.email = document.getElementById('authEmail').value.trim();
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error; return; }
        currentUser = { username: data.username, country: data.country || '' };
        onLoggedIn();
    } catch {
        errorEl.textContent = 'Connection error. Please try again.';
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

// ===== TOGGLE LOGIN / REGISTER =====
function setRegisterFields(show) {
    const fields = ['emailGroup', 'confirmGroup', 'countryGroup'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (show) { el.classList.remove('field-hidden'); el.style.display = ''; }
        else { el.classList.add('field-hidden'); }
    });
    const bar = document.getElementById('strengthBar');
    if (show) { bar.classList.remove('field-hidden'); bar.style.display = ''; }
    else { bar.classList.add('field-hidden'); }
}

// Initialize hidden state
setRegisterFields(false);

document.getElementById('authToggleBtn').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    const isReg = authMode === 'register';
    document.getElementById('authFormTitle').textContent = isReg ? 'Create Account' : 'Sign In';
    document.getElementById('authSubmit').textContent    = isReg ? 'Create Account' : 'Sign In';
    document.getElementById('authToggleBtn').textContent =
        isReg ? 'Already have an account? Sign in' : 'New here? Create an account';
    setRegisterFields(isReg);
    document.getElementById('authError').textContent = '';
    // Clear validation states
    document.getElementById('usernameHint').textContent = '';
    document.getElementById('confirmHint').textContent = '';
    document.getElementById('authUsername').classList.remove('input-error', 'input-valid');
    document.getElementById('authConfirmPassword').classList.remove('input-error', 'input-valid');
    updateStrengthBar();
});

document.getElementById('authUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        if (authMode === 'register') document.getElementById('authEmail').focus();
        else document.getElementById('authPassword').focus();
    }
});
document.getElementById('authEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authPassword').focus();
});
document.getElementById('authPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        if (authMode === 'register') document.getElementById('authConfirmPassword').focus();
        else document.getElementById('authSubmit').click();
    }
});
document.getElementById('authConfirmPassword').addEventListener('keydown', e => {
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
        const urlMap = { global: '/api/leaderboard', mine: '/api/scores/me', countries: '/api/leaderboard/countries' };
        const res = await fetch(urlMap[tab]);
        if (res.status === 401) { contentEl.textContent = 'Login to see your scores.'; return; }
        const rows = await res.json();

        const empty = { global: 'No scores yet. Be the first!', mine: 'No scores yet. Play a game!', countries: 'No country data yet.' };
        if (!rows.length) { contentEl.textContent = empty[tab]; return; }

        const table = document.createElement('table');
        table.className = 'lb-table';

        if (tab === 'global') {
            table.innerHTML = `<thead><tr><th>#</th><th>Player</th><th>Country</th><th>Time</th><th>Steps</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            rows.forEach((row, i) => {
                const tr = document.createElement('tr');
                if (currentUser && row.username === currentUser.username) tr.className = 'lb-me';
                const flag = row.country ? countryFlag(row.country) : '🏳';
                const name = row.country ? countryName(row.country) : '—';
                tr.innerHTML = `<td>${i + 1}</td><td>${row.username}</td><td>${flag} ${name}</td><td>${fmtScore(row.score_ms)}</td><td>${row.steps}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

        } else if (tab === 'countries') {
            table.innerHTML = `<thead><tr><th>#</th><th>Country</th><th>Players</th><th>Best</th><th>Avg</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            rows.forEach((row, i) => {
                const tr = document.createElement('tr');
                const flag = countryFlag(row.country);
                const name = countryName(row.country);
                const isMe = currentUser && currentUser.country === row.country;
                if (isMe) tr.className = 'lb-me';
                tr.innerHTML = `<td>${i + 1}</td><td>${flag} ${name}</td><td>${row.players}</td><td>${fmtScore(row.best_ms)}</td><td>${fmtScore(row.avg_ms)}</td>`;
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
    milestoneTimer = setTimeout(() => { el.style.opacity = '0'; }, 700);
}

// ===== PATH DRAWING =====
function drawPlayerPath() {
    if (playerPath.length < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
    Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '999', pointerEvents: 'none' });
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

// Draws a scaled, fitted path trace inside the game-over panel
function drawPathInPanel(containerEl) {
    if (playerPath.length < 2) return;

    // Bounding box of the actual path
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of playerPath) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    const PAD   = 22;
    const CW    = 370;
    const CH    = 200;
    const pathW = (maxX - minX) || 1;
    const pathH = (maxY - minY) || 1;
    const scale = Math.min((CW - PAD * 2) / pathW, (CH - PAD * 2) / pathH);
    const offX  = PAD + ((CW - PAD * 2) - pathW * scale) / 2;
    const offY  = PAD + ((CH - PAD * 2) - pathH * scale) / 2;

    const tx = x => offX + (x - minX) * scale;
    const ty = y => offY + (y - minY) * scale;

    const canvas  = document.createElement('canvas');
    canvas.width  = CW;
    canvas.height = CH;
    canvas.style.cssText = 'width:100%;border-radius:10px;display:block;';

    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, CW, CH);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CW; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
    for (let y = 0; y <= CH; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

    // Glowing path
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 7;
    ctx.strokeStyle = 'rgba(0,255,136,0.9)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(tx(playerPath[0].x), ty(playerPath[0].y));
    for (let i = 1; i < playerPath.length - 1; i++) {
        const cpx = (playerPath[i].x + playerPath[i + 1].x) / 2;
        const cpy = (playerPath[i].y + playerPath[i + 1].y) / 2;
        ctx.bezierCurveTo(tx(playerPath[i].x), ty(playerPath[i].y), tx(cpx), ty(cpy), tx(playerPath[i + 1].x), ty(playerPath[i + 1].y));
    }
    ctx.lineTo(tx(playerPath[playerPath.length - 1].x), ty(playerPath[playerPath.length - 1].y));
    ctx.stroke();
    ctx.restore();

    // Start marker — green dot
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath();
    ctx.arc(tx(playerPath[0].x), ty(playerPath[0].y), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Death marker — red dot
    ctx.save();
    ctx.shadowColor = '#FF4136';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#FF4136';
    ctx.beginPath();
    ctx.arc(tx(playerPath[playerPath.length - 1].x), ty(playerPath[playerPath.length - 1].y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    containerEl.appendChild(canvas);
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
    playGameOverSound();

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
        <div class="go-player">
            <span class="go-player-flag">${currentUser ? (countryFlag(currentUser.country) || '🎮') : '🎮'}</span>
            <span class="go-player-name">${currentUser ? currentUser.username : 'Guest'}</span>
        </div>
        <div class="go-time" id="goTimeCounter">0.00s</div>
        <div class="go-stars" id="goStars"></div>
        <div class="go-rank" id="goRank" style="color:${rankColor};animation-delay:0.9s">${rank}</div>
        <div id="goPathCanvas" style="margin-bottom:4px;"></div>
        <div style="color:rgba(255,255,255,0.2);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Your route this round</div>
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
    drawPathInPanel(document.getElementById('goPathCanvas'));

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
        restartMsg.textContent = 'Press Enter / Space or tap to restart';
        panel.appendChild(restartMsg);

        function restart(e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
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
    playMusic();
}

// ===== MUSIC (Web Audio API) =====
let audioCtx = null;
let masterGain = null;
let bgNodes = [];
let musicMuted = false;
let arpeggioTimer = null;

function ensureCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = musicMuted ? 0 : 0.22;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function stopBgNodes() {
    if (arpeggioTimer) { clearInterval(arpeggioTimer); arpeggioTimer = null; }
    bgNodes.forEach(n => { try { n.stop(); } catch(_) {} });
    bgNodes = [];
}

// Soft sine pluck — one note at a time
function pluckNote(freq, vol, when) {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, when + 1.6);
    osc.connect(g); g.connect(masterGain);
    osc.start(when); osc.stop(when + 1.7);
    bgNodes.push(osc, g);
}

function playMusic() {
    ensureCtx();
    stopBgNodes();
    if (musicMuted) return;

    const now = audioCtx.currentTime;

    // --- deep sub-bass breath (very soft) ---
    const sub = audioCtx.createOscillator();
    const subG = audioCtx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 55; // A1
    subG.gain.setValueAtTime(0, now);
    subG.gain.linearRampToValueAtTime(0.06, now + 3);
    sub.connect(subG); subG.connect(masterGain);
    sub.start(now);
    bgNodes.push(sub, subG);

    // --- slow breathing LFO on sub ---
    const breathLfo = audioCtx.createOscillator();
    const breathG   = audioCtx.createGain();
    breathLfo.frequency.value = 0.12;
    breathG.gain.value = 0.03;
    breathLfo.connect(breathG); breathG.connect(subG.gain);
    breathLfo.start(now);
    bgNodes.push(breathLfo, breathG);

    // --- warm pad (Am chord: A3, C4, E4) slowly fading in ---
    const padNotes = [220, 261.63, 329.63, 440];
    padNotes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const f   = audioCtx.createBiquadFilter();
        const g   = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq + (i % 2 === 0 ? 0.5 : -0.5); // subtle chorus detune
        f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 1;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.04 - i * 0.006, now + 4 + i);
        osc.connect(f); f.connect(g); g.connect(masterGain);
        osc.start(now);
        bgNodes.push(osc, f, g);
    });

    // --- pentatonic arpeggio: Am pentatonic A3 C4 D4 E4 G4 ---
    const arpScale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25, 587.33];
    let arpIdx = 0;
    const playArp = () => {
        if (!audioCtx || musicMuted) return;
        const t = audioCtx.currentTime;
        pluckNote(arpScale[arpIdx % arpScale.length], 0.055, t);
        // every 4th note add a soft octave below for depth
        if (arpIdx % 4 === 0) pluckNote(arpScale[arpIdx % arpScale.length] / 2, 0.03, t + 0.01);
        arpIdx++;
    };
    // stagger start so pad fades in first
    setTimeout(() => {
        if (!audioCtx) return;
        playArp();
        arpeggioTimer = setInterval(playArp, 480); // ~125 BPM feel, gentle
    }, 2000);
}

function pauseMusic() {
    stopBgNodes();
}

function playGameOverSound() {
    ensureCtx();
    const now = audioCtx.currentTime;
    const out  = audioCtx.destination;

    // Warm reverb-like tail: convolver simulation via two delayed echoes
    function warmNote(freq, startTime, duration, peakVol, pitchDrop) {
        const osc  = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator(); // slight detune for warmth
        const filt = audioCtx.createBiquadFilter();
        const g    = audioCtx.createGain();

        osc.type  = 'triangle';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 1.004, startTime); // subtle chorus
        if (pitchDrop) {
            osc.frequency.linearRampToValueAtTime(freq * pitchDrop, startTime + duration);
            osc2.frequency.linearRampToValueAtTime(freq * 1.004 * pitchDrop, startTime + duration);
        }

        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(1800, startTime);
        filt.frequency.linearRampToValueAtTime(600, startTime + duration * 0.6);

        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(peakVol, startTime + 0.06);
        g.gain.setValueAtTime(peakVol, startTime + duration * 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 0.5);

        osc.connect(filt);  osc2.connect(filt);
        filt.connect(g);    g.connect(out);

        osc.start(startTime);  osc.stop(startTime + duration + 0.6);
        osc2.start(startTime); osc2.stop(startTime + duration + 0.6);
    }

    // Bittersweet descending melody: C5 → Bb4 → Ab4 → G4
    // Sounds musical and warm, but the minor descent feels gently disappointing
    const melody = [
        { freq: 523.25, t: 0.0,  dur: 0.55, vol: 0.10, drop: 0.99 },
        { freq: 466.16, t: 0.42, dur: 0.55, vol: 0.10, drop: 0.98 },
        { freq: 415.30, t: 0.84, dur: 0.55, vol: 0.09, drop: 0.97 },
        { freq: 392.00, t: 1.28, dur: 1.20, vol: 0.09, drop: 0.94 }, // long final note droops
    ];
    melody.forEach(n => warmNote(n.freq, now + n.t, n.dur, n.vol, n.drop));

    // Soft harmony pad underneath (Am-ish chord: A3 + E4)
    [[220, 0.1, 2.4], [329.63, 0.08, 2.0]].forEach(([freq, vol, dur]) => {
        const osc = audioCtx.createOscillator();
        const g   = audioCtx.createGain();
        osc.type  = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, now + 0.1);
        g.gain.linearRampToValueAtTime(vol, now + 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g); g.connect(out);
        osc.start(now + 0.1); osc.stop(now + dur + 0.1);
    });

    // Gentle soft thud at the start (muffled kick feel)
    const kick = audioCtx.createOscillator();
    const kickG = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, now);
    kick.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    kickG.gain.setValueAtTime(0.18, now);
    kickG.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    kick.connect(kickG); kickG.connect(out);
    kick.start(now); kick.stop(now + 0.25);
}


document.getElementById('muteBtn').addEventListener('click', () => {
    musicMuted = !musicMuted;
    document.getElementById('muteBtn').classList.toggle('muted', musicMuted);
    if (masterGain) {
        masterGain.gain.setTargetAtTime(musicMuted ? 0 : 0.28, audioCtx.currentTime, 0.1);
    }
    if (!musicMuted && gameRunning) playMusic();
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
