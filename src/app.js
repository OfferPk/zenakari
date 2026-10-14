/**
 * ZenAkari - Game Controller & SVG Board View
 * Handles user interaction, SVG rendering, animations, audio triggers,
 * undo history, deductive hints, and progress persistence.
 */

(function () {
  'use strict';

  // Game State
  let currentLevelIdx = 0;
  let engine = null;
  let audio = null;
  let activeMode = 'lantern'; // 'lantern' | 'dot'
  let undoStack = [];
  let moveCount = 0;
  let solvedLevels = new Set();
  let hintTimeout = null;

  // DOM Elements
  const boardSvg = document.getElementById('board-svg');
  const packNameEl = document.getElementById('pack-name');
  const levelNameEl = document.getElementById('level-name');
  const statUnlitEl = document.getElementById('stat-unlit');
  const statLanternsEl = document.getElementById('stat-lanterns');

  const btnSound = document.getElementById('btn-sound');
  const btnRules = document.getElementById('btn-rules');
  const btnLevels = document.getElementById('btn-levels');
  const btnUndo = document.getElementById('btn-undo');
  const btnMode = document.getElementById('btn-mode');
  const modeIcon = document.getElementById('mode-icon');
  const modeLabel = document.getElementById('mode-label');
  const btnHint = document.getElementById('btn-hint');
  const btnReset = document.getElementById('btn-reset');

  const modalLevels = document.getElementById('modal-levels');
  const closeLevels = document.getElementById('close-levels');
  const packGrid = document.getElementById('pack-grid');

  const modalRules = document.getElementById('modal-rules');
  const closeRules = document.getElementById('close-rules');

  const modalVictory = document.getElementById('modal-victory');
  const btnNextLevel = document.getElementById('btn-next-level');

  // Load progress
  function loadProgress() {
    try {
      const saved = localStorage.getItem('zenakari_progress');
      if (saved) {
        const arr = JSON.parse(saved);
        solvedLevels = new Set(arr);
      }
      const savedLevel = localStorage.getItem('zenakari_current_level');
      if (savedLevel !== null) {
        currentLevelIdx = parseInt(savedLevel, 10) || 0;
      }
    } catch (e) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem('zenakari_progress', JSON.stringify(Array.from(solvedLevels)));
      localStorage.setItem('zenakari_current_level', currentLevelIdx);
    } catch (e) {}
  }

  // Initialize
  function initGame() {
    audio = new AkariAudio();
    updateSoundButton();
    loadProgress();
    loadLevel(currentLevelIdx);
    setupEventListeners();
  }

  function updateSoundButton() {
    btnSound.textContent = audio.enabled ? '🔊' : '🔇';
  }

  // Load specific level
  function loadLevel(idx) {
    if (idx < 0 || idx >= AKARI_LEVELS.length) idx = 0;
    currentLevelIdx = idx;
    saveProgress();

    const lvl = AKARI_LEVELS[idx];
    engine = new AkariEngine(lvl.width, lvl.height, lvl.walls);
    undoStack = [];
    moveCount = 0;

    packNameEl.textContent = lvl.pack;
    levelNameEl.textContent = `${lvl.name} (${lvl.width}×${lvl.height})`;

    renderBoard();
  }

  // Save current grid to undo stack
  function pushUndo() {
    const snap = engine.grid.map(row => [...row]);
    undoStack.push(snap);
    if (undoStack.length > 50) undoStack.shift();
  }

  // Handle cell click
  function handleCellClick(r, c, forceDot = false) {
    if (engine.isWall(r, c)) return;

    pushUndo();
    moveCount++;

    const cur = engine.grid[r][c];
    let next;

    if (forceDot) {
      next = cur === 'dot' ? 'empty' : 'dot';
    } else if (activeMode === 'lantern') {
      next = cur === 'lantern' ? 'empty' : 'lantern';
    } else {
      next = cur === 'dot' ? 'empty' : 'dot';
    }

    engine.grid[r][c] = next;

    if (next === 'lantern') {
      audio.playLantern(r + c);
    } else if (next === 'dot') {
      audio.playDot();
    } else {
      audio.playTap();
    }

    renderBoard();
    checkVictory();
  }

  // Check victory condition
  function checkVictory() {
    const illum = engine.calculateIllumination();
    if (illum.isComplete) {
      audio.playComplete();
      solvedLevels.add(currentLevelIdx + 1);
      saveProgress();

      setTimeout(() => {
        modalVictory.classList.add('open');
      }, 350);
    }
  }

  // Render SVG Board
  function renderBoard(highlightCoord = null) {
    const lvl = AKARI_LEVELS[currentLevelIdx];
    const W = lvl.width;
    const H = lvl.height;
    const size = 500;
    const pad = 10;
    const innerSize = size - pad * 2;
    const cellW = innerSize / W;
    const cellH = innerSize / H;

    const illum = engine.calculateIllumination();

    statUnlitEl.textContent = illum.unlitCells;
    statLanternsEl.textContent = illum.lanternsCount;

    let svgHtml = '';

    // Defs: Gradients and filters
    svgHtml += `
      <defs>
        <!-- Amber Light Beam Gradient -->
        <linearGradient id="beam-horiz" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.25" />
          <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.25" />
        </linearGradient>

        <!-- Amber Radial Core -->
        <radialGradient id="lantern-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="35%" stop-color="#fef08a" stop-opacity="0.95" />
          <stop offset="70%" stop-color="#f59e0b" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#d97706" stop-opacity="0" />
        </radialGradient>

        <!-- Conflict Red Glow -->
        <radialGradient id="conflict-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="45%" stop-color="#ef4444" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#991b1b" stop-opacity="0" />
        </radialGradient>

        <!-- Stone Wall Gradient -->
        <linearGradient id="wall-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>

        <!-- Pathway Cell Gradient -->
        <linearGradient id="cell-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#141e2e" />
        </linearGradient>
      </defs>
    `;

    // Garden board outer frame
    svgHtml += `<rect x="0" y="0" width="${size}" height="${size}" rx="18" fill="#0c121c" stroke="#334155" stroke-width="3" />`;

    // 1. Draw base pathway grid cells and stone walls
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const x = pad + c * cellW;
        const y = pad + r * cellH;
        const isW = engine.isWall(r, c);

        if (isW) {
          const count = engine.getWallCount(r, c);
          const st = illum.wallStatuses.get(`${r},${c}`);
          let strokeColor = '#475569';
          let textColor = '#cbd5e1';

          if (count !== null) {
            if (st.satisfied) {
              strokeColor = '#34d399';
              textColor = '#34d399';
            } else if (st.violated) {
              strokeColor = '#f87171';
              textColor = '#f87171';
            }
          }

          svgHtml += `
            <g class="wall-cell">
              <rect x="${x + 2}" y="${y + 2}" width="${cellW - 4}" height="${cellH - 4}" rx="8"
                    fill="url(#wall-grad)" stroke="${strokeColor}" stroke-width="${st && st.satisfied ? 3 : 2}" />
          `;

          if (count !== null) {
            svgHtml += `
              <text x="${x + cellW / 2}" y="${y + cellH / 2 + cellH * 0.14}"
                    font-size="${cellH * 0.46}" font-weight="700" fill="${textColor}"
                    text-anchor="middle" font-family="sans-serif">${count}</text>
            `;
          }
          svgHtml += `</g>`;
        } else {
          // Open pathway cell
          const isLit = illum.litCount[r][c] > 0;
          const bgFill = isLit ? 'rgba(245, 158, 11, 0.18)' : 'url(#cell-grad)';
          const borderStroke = isLit ? 'rgba(251, 191, 36, 0.4)' : '#334155';

          svgHtml += `
            <rect class="path-cell" data-r="${r}" data-c="${c}"
                  x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="6"
                  fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.5"
                  style="cursor: pointer;" />
          `;
        }
      }
    }

    // 2. Draw continuous warm illumination beam overlays
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!engine.isWall(r, c) && illum.litCount[r][c] > 0) {
          const x = pad + c * cellW;
          const y = pad + r * cellH;
          svgHtml += `
            <rect x="${x + 3}" y="${y + 3}" width="${cellW - 6}" height="${cellH - 6}" rx="5"
                  fill="rgba(251, 191, 36, 0.12)" pointer-events="none" />
          `;
        }
      }
    }

    // 3. Draw Lanterns and Dots
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (engine.isWall(r, c)) continue;
        const cell = engine.grid[r][c];
        const cx = pad + c * cellW + cellW / 2;
        const cy = pad + r * cellH + cellH / 2;
        const isConflict = illum.conflicts.has(`${r},${c}`);

        if (cell === 'lantern') {
          const glowGrad = isConflict ? 'url(#conflict-glow)' : 'url(#lantern-glow)';
          const glowR = Math.min(cellW, cellH) * 0.42;

          svgHtml += `
            <g class="lantern-item" data-r="${r}" data-c="${c}" style="cursor: pointer;">
              <!-- Outer Glow Aura -->
              <circle cx="${cx}" cy="${cy}" r="${glowR}" fill="${glowGrad}" />
              <!-- Pagoda Lantern Icon -->
              <text x="${cx}" y="${cy + cellH * 0.14}" font-size="${cellH * 0.48}"
                    text-anchor="middle" pointer-events="none"
                    style="filter: drop-shadow(0 0 6px ${isConflict ? '#ef4444' : '#fbbf24'});">🏮</text>
          `;
          if (isConflict) {
            svgHtml += `
              <circle cx="${cx}" cy="${cy}" r="${glowR * 0.9}" fill="none"
                      stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4,3" pointer-events="none" />
            `;
          }
          svgHtml += `</g>`;
        } else if (cell === 'dot') {
          svgHtml += `
            <g class="dot-item" data-r="${r}" data-c="${c}" style="cursor: pointer;">
              <circle cx="${cx}" cy="${cy}" r="${Math.min(cellW, cellH) * 0.12}"
                      fill="#94a3b8" opacity="0.75" pointer-events="none" />
            </g>
          `;
        }
      }
    }

    // 4. Highlight for Deductive Hint Beacon
    if (highlightCoord) {
      const hx = pad + highlightCoord.c * cellW;
      const hy = pad + highlightCoord.r * cellH;
      svgHtml += `
        <rect x="${hx + 2}" y="${hy + 2}" width="${cellW - 4}" height="${cellH - 4}" rx="8"
              fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-dasharray="8,5">
          <animate attributeName="stroke-opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </rect>
      `;
    }

    boardSvg.innerHTML = svgHtml;

    // Attach click listeners to SVG elements
    boardSvg.querySelectorAll('.path-cell, .lantern-item, .dot-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const r = parseInt(el.getAttribute('data-r'), 10);
        const c = parseInt(el.getAttribute('data-c'), 10);
        handleCellClick(r, c, false);
      });

      // Context menu / right click to place dot
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const r = parseInt(el.getAttribute('data-r'), 10);
        const c = parseInt(el.getAttribute('data-c'), 10);
        handleCellClick(r, c, true);
      });
    });
  }

  // Event Listeners
  function setupEventListeners() {
    // Sound Toggle
    btnSound.addEventListener('click', () => {
      audio.toggle();
      updateSoundButton();
    });

    // Rules Modal
    btnRules.addEventListener('click', () => modalRules.classList.add('open'));
    closeRules.addEventListener('click', () => modalRules.classList.remove('open'));

    // Levels Modal
    btnLevels.addEventListener('click', () => {
      renderPacksModal();
      modalLevels.classList.add('open');
    });
    closeLevels.addEventListener('click', () => modalLevels.classList.remove('open'));

    // Mode Toggle (Lantern vs Dot)
    btnMode.addEventListener('click', () => {
      activeMode = activeMode === 'lantern' ? 'dot' : 'lantern';
      modeIcon.textContent = activeMode === 'lantern' ? '🏮' : '•';
      modeLabel.textContent = activeMode === 'lantern' ? 'Lantern' : 'Dot';
      btnMode.classList.toggle('active', activeMode === 'lantern');
      audio.playTap();
    });

    // Undo
    btnUndo.addEventListener('click', () => {
      if (undoStack.length > 0) {
        engine.grid = undoStack.pop();
        audio.playTap();
        renderBoard();
      }
    });

    // Reset
    btnReset.addEventListener('click', () => {
      pushUndo();
      engine.clear();
      audio.playTap();
      renderBoard();
    });

    // Hint
    btnHint.addEventListener('click', () => {
      const hint = engine.getHint();
      if (hint && hint.r !== undefined && hint.c !== undefined) {
        audio.playWallDone();
        renderBoard({ r: hint.r, c: hint.c });

        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(() => {
          renderBoard();
        }, 3500);
      }
    });

    // Victory Next Level
    btnNextLevel.addEventListener('click', () => {
      modalVictory.classList.remove('open');
      loadLevel((currentLevelIdx + 1) % AKARI_LEVELS.length);
    });

    // Close modals on overlay tap
    [modalLevels, modalRules, modalVictory].forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  // Render Pack Modal Grid
  function renderPacksModal() {
    let html = '';
    AKARI_PACKS.forEach(pack => {
      const [start, end] = pack.levels;
      let packSolved = 0;
      for (let i = start; i <= end; i++) {
        if (solvedLevels.has(i)) packSolved++;
      }

      html += `
        <div class="pack-card">
          <div class="pack-header">
            <span class="pack-title" style="color: ${pack.color}">${pack.name} (${pack.size})</span>
            <span class="pack-progress">${packSolved} / 10 Solved</span>
          </div>
          <div class="level-buttons">
      `;

      for (let i = start; i <= end; i++) {
        const isSolved = solvedLevels.has(i);
        const isCurrent = i === currentLevelIdx + 1;
        const currentStyle = isCurrent ? 'outline: 2px solid #38bdf8;' : '';
        html += `
          <button class="lvl-btn ${isSolved ? 'solved' : ''}" style="${currentStyle}" data-lvl="${i - 1}">
            ${i}
          </button>
        `;
      }

      html += `
          </div>
        </div>
      `;
    });

    packGrid.innerHTML = html;

    packGrid.querySelectorAll('.lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-lvl'), 10);
        modalLevels.classList.remove('open');
        loadLevel(idx);
      });
    });
  }

  // Auto-start on load
  window.addEventListener('DOMContentLoaded', initGame);
})();
