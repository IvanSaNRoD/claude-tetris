'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_STORAGE_KEY = 'tetris-skin';

// Cada skin define su paleta, el color de rejilla por tema y su funcion de dibujo.
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d'],
    grid: { dark: '#22222e', light: '#dcdce6' },
    draw: drawBlockRetro,
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00f0ff', '#fff700', '#c840ff', '#00ff85', '#ff0055', '#3d6bff', '#ff8a00'],
    grid: { dark: '#141426', light: '#141426' },
    draw: drawBlockNeon,
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6e2', '#ffe9a8', '#dcc4f2', '#bfe5c0', '#f5b8b8', '#bacff0', '#f7d2ac'],
    grid: { dark: '#2a2a38', light: '#e9e9f3' },
    draw: drawBlockPastel,
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#2ec4c4', '#e0c02c', '#a24ec2', '#4eb04e', '#d43f3f', '#3f6fd4', '#e08a2c'],
    grid: { dark: '#1e1e2c', light: '#d5d5e2' },
    draw: drawBlockPixel,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HS_STORAGE_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const MAX_NAME_LEN = 10;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const comboEl = document.getElementById('combo');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const startRecordsEl = document.getElementById('start-records');
const overlayRecordsEl = document.getElementById('overlay-records');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const themeToggleIcon = themeToggleBtn.querySelector('.theme-toggle-icon');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backToPauseBtn = document.getElementById('back-to-pause-btn');
const startLevelSelect = document.getElementById('start-level-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const START_LEVEL_STORAGE_KEY = 'tetris-start-level';

let board, current, next, holdPiece, canHold, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let currentTheme = 'dark';
let currentSkin = 'retro';
let startLevel = 1;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  combo = cleared ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
  canHold = true;
  spawn();
  drawHold();
}

function hold() {
  if (!canHold) return;
  const swap = holdPiece;
  holdPiece = makePiece(current.type);
  canHold = false;
  current = swap || next;
  if (!swap) next = randomPiece();
  drawNext();
  drawHold();
  if (collide(current.shape, current.x, current.y)) endGame();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = 'x' + combo;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.restore();
}

// ---- Renderers por skin (px,py = esquina superior izquierda en pixeles) ----

function drawBlockRetro(c, px, py, size, color) {
  c.fillStyle = color;
  c.fillRect(px + 1, py + 1, size - 2, size - 2);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(c, px, py, size, color) {
  const alpha = c.globalAlpha;
  c.fillStyle = 'rgba(0,0,0,0.8)';
  c.fillRect(px + 2, py + 2, size - 4, size - 4);
  c.shadowColor = color;
  c.shadowBlur = size * 0.55;
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
  c.shadowBlur = size * 0.3;
  c.globalAlpha = alpha * 0.35;
  c.fillStyle = color;
  c.fillRect(px + 5, py + 5, size - 10, size - 10);
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  if (typeof c.roundRect === 'function') { c.roundRect(x, y, w, h, r); return; }
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBlockPastel(c, px, py, size, color) {
  const r = Math.max(3, size * 0.28);
  roundRectPath(c, px + 1.5, py + 1.5, size - 3, size - 3, r);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 1.5;
  c.stroke();
  // brillo superior
  roundRectPath(c, px + size * 0.22, py + size * 0.16, size * 0.56, size * 0.18, size * 0.09);
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.fill();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

function drawBlockPixel(c, px, py, size, color) {
  const u = Math.max(2, Math.round(size / 10)); // unidad de "pixel"
  c.fillStyle = color;
  c.fillRect(px, py, size, size);
  // textura dithered determinista
  c.fillStyle = shade(color, -28);
  for (let i = 0; i < size; i += u) {
    for (let j = 0; j < size; j += u) {
      if (((i / u) + (j / u)) % 3 === 0) c.fillRect(px + i, py + j, u, u);
    }
  }
  // bisel chunky
  c.fillStyle = shade(color, 55);
  c.fillRect(px, py, size, u);
  c.fillRect(px, py, u, size);
  c.fillStyle = shade(color, -60);
  c.fillRect(px, py + size - u, size, u);
  c.fillRect(px + size - u, py, u, size);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid[currentTheme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawPiecePreview(context, canvasEl, piece) {
  const NB = 30;
  context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB);
}

function drawNext() {
  drawPiecePreview(nextCtx, nextCanvas, next);
}

function drawHold() {
  drawPiecePreview(holdCtx, holdCanvas, holdPiece);
  holdCanvas.classList.toggle('preview-locked', !canHold);
}

// ---- Récords (localStorage) ----

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(HS_STORAGE_KEY));
    if (!raw || typeof raw !== 'object') return emptyRecords();
    return {
      scores: Array.isArray(raw.scores) ? raw.scores.slice(0, MAX_RECORDS) : [],
      bestCombo: Number(raw.bestCombo) || 0,
      maxLines: Number(raw.maxLines) || 0,
    };
  } catch (e) {
    return emptyRecords();
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(HS_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    /* almacenamiento no disponible: los récords solo duran la sesión */
  }
}

function qualifies(value, scores) {
  return scores.length < MAX_RECORDS || value > scores[scores.length - 1].score;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

function renderRecords(container, records, highlight) {
  const rows = records.scores.map((entry, i) => `
    <li class="record-row${i === highlight ? ' is-new' : ''}">
      <span class="record-rank">${i + 1}</span>
      <span class="record-name">${escapeHTML(entry.name)}</span>
      <span class="record-score">${Number(entry.score).toLocaleString()}</span>
      <span class="record-meta">${entry.lines || 0} líneas \u00b7 nivel ${entry.level || 1} \u00b7 combo x${entry.combo || 0}</span>
    </li>`).join('');
  container.innerHTML = `
    ${rows ? `<ol class="record-list">${rows}</ol>` : '<p class="record-empty">Sin récords todavía</p>'}
    <div class="record-stats">
      <span>MEJOR COMBO <b>x${records.bestCombo}</b></span>
      <span>MÁX LÍNEAS <b>${records.maxLines}</b></span>
    </div>`;
}

function resetRecords() {
  if (!confirm('\u00bfBorrar todos los récords guardados?')) return;
  try {
    localStorage.removeItem(HS_STORAGE_KEY);
  } catch (e) {
    /* nada que borrar */
  }
  const records = emptyRecords();
  renderRecords(startRecordsEl, records, -1);
  renderRecords(overlayRecordsEl, records, -1);
}

function submitScore(e) {
  e.preventDefault();
  const records = loadRecords();
  const entry = {
    name: (nameInput.value.trim() || 'ANON').toUpperCase().slice(0, MAX_NAME_LEN),
    score,
    lines,
    level,
    combo: maxCombo,
    date: Date.now(),
  };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score || a.date - b.date);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  saveRecords(records);
  nameForm.classList.add('hidden');
  renderRecords(overlayRecordsEl, records, records.scores.indexOf(entry));
  renderRecords(startRecordsEl, records, -1);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  const records = loadRecords();
  if (maxCombo > records.bestCombo) records.bestCombo = maxCombo;
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords(records);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent =
    `${score.toLocaleString()} pts \u00b7 ${lines} líneas \u00b7 combo máx x${maxCombo}`;
  nameForm.classList.toggle('hidden', !(score > 0 && qualifies(score, records.scores)));
  renderRecords(overlayRecordsEl, records, -1);
  renderRecords(startRecordsEl, records, -1);
  overlay.classList.remove('hidden');
  if (!nameForm.classList.contains('hidden')) {
    nameInput.value = '';
    nameInput.focus();
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.setAttribute('aria-pressed', String(theme === 'light'));
  themeToggleBtn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeToggleIcon.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  redrawAll();
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function redrawAll() {
  if (!board) return;
  draw();
  drawNext();
  drawHold();
}

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  document.documentElement.setAttribute('data-skin', currentSkin);
  skinSelect.value = currentSkin;
  localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
  redrawAll();
}

function initSkin() {
  skinSelect.innerHTML = '';
  for (const [key, cfg] of Object.entries(SKINS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = cfg.label;
    skinSelect.appendChild(opt);
  }
  applySkin(localStorage.getItem(SKIN_STORAGE_KEY) || 'retro');
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showPauseMainView();
  pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  pauseOverlay.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function showPauseMainView() {
  pauseMainView.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
}

function showPauseControlsView() {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
}

function applyStartLevel(value) {
  startLevel = Math.min(10, Math.max(1, parseInt(value, 10) || 1));
  localStorage.setItem(START_LEVEL_STORAGE_KEY, String(startLevel));
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_STORAGE_KEY), 10);
  startLevel = Number.isInteger(saved) && saved >= 1 && saved <= 10 ? saved : 1;
  startLevelSelect.value = String(startLevel);
}

function restartFromPause() {
  pauseOverlay.classList.add('hidden');
  paused = false;
  init();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function resetState() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  holdPiece = null;
  canHold = true;
  next = randomPiece();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
}

function init() {
  resetState();
  startOverlay.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function showStart() {
  resetState();
  current = null;
  next = null;
  gameOver = true;
  draw();
  drawNext();
  renderRecords(startRecordsEl, loadRecords(), -1);
  startOverlay.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      hold();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
menuBtn.addEventListener('click', showStart);
startBtn.addEventListener('click', init);
resetRecordsBtn.addEventListener('click', resetRecords);
nameForm.addEventListener('submit', submitScore);
themeToggleBtn.addEventListener('click', toggleTheme);
skinSelect.addEventListener('change', e => applySkin(e.target.value));

resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', restartFromPause);
showControlsBtn.addEventListener('click', showPauseControlsView);
backToPauseBtn.addEventListener('click', showPauseMainView);
startLevelSelect.addEventListener('change', e => applyStartLevel(e.target.value));

initTheme();
initSkin();
initStartLevel();
showStart();
