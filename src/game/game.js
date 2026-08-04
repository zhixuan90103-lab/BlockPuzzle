/**
 * Block Blast 编排层：规则循环 + 指针 + 调用 feel 子系统。
 * 手感细节见 docs/FEEL-DESIGN.md 与 src/game/feel/*
 */
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { resizeToFrame } from '../create-renderer.js';
import {
  applySafeAreaCssVars,
  getFrameSize,
  isNativeApp,
  readSafeAreaInsets,
} from '../viewport.js';
import {
  COLOR,
  FEEL_CLEAR_MS,
  FEEL_CLEAR_STAGGER,
  FEEL_DEATH_FLASH_MS,
  FEEL_DEATH_PAUSE_MS,
  FEEL_DEATH_ROW_MS,
  FEEL_HIT_SLOP,
  FEEL_PLACE_SNAP_MS,
  FEEL_REJECT_MS,
  GRID,
  PIECE_PALETTE,
  SHOW_DEBUG_STATUS,
  TRAY_SIZE,
} from './defaults.js';
import {
  chaseTargetOnPointer,
  createDragSession,
  samplePointer,
  tickSmooth,
} from './feel/drag-session.js';
import { createGhostPolicy } from './feel/ghost-policy.js';
import { createGhostHaptics } from './feel/haptics-ghost.js';
import { countCells, matrixSize } from './forms.js';
import { createGrid } from './grid.js';
import { computeLayout } from './layout.js';
import {
  anyTrayPieceFits,
  clearPendingDealPlan,
  lastDealMeta,
} from './pieces.js';
import { createPuzzle } from './puzzle/generator.js';
import { createScoreState } from './score.js';
import { getTune } from './tune.js';
import { createBoardView } from './view.js';

/**
 * @param {{
 *   stage: HTMLElement,
 *   hud: HTMLElement,
 *   renderer: any,
 *   haptics: ReturnType<import('../native-haptics.js').createNativeHaptics>,
 *   setStatus?: (t: string) => void,
 * }} opts
 */
export function createGame(opts) {
  const { stage, hud, renderer, haptics, setStatus } = opts;
  const frameEl = document.getElementById('phone-frame');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.bg);

  const frame0 = getFrameSize();
  const camera = new THREE.OrthographicCamera(
    -frame0.width / 2,
    frame0.width / 2,
    frame0.height / 2,
    -frame0.height / 2,
    0.1,
    100,
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const boardView = createBoardView(scene);
  const grid = createGrid();
  const scoreState = createScoreState();
  const searchParams = new URLSearchParams(window.location.search);
  const editorMode = searchParams.has('editor');
  const requestedLevel = Math.max(1, Number(searchParams.get('level') || 1) || 1);
  const editorLevel = requestedLevel;
  const initialPuzzleLevel = editorMode ? 1 : requestedLevel;
  let puzzleLevel = 0;
  let puzzle = null;

  /** @type {(import('./forms.js').PieceDef|null)[]} */
  let tray = [null, null, null];
  let trayScrollX = 0;
  /** @type {null | { pointerId: number, startFx: number, startFy: number, startScrollX: number, moved: boolean }} */
  let trayScrollDrag = null;
  /** @type {{ id: number, piece: import('./forms.js').PieceDef, trayIndex: number, originRow: number, originCol: number, cells: {row:number,col:number}[] }[]} */
  let placedPieces = [];
  let nextPlacedId = 1;

  /** @type {null | ReturnType<typeof createDragSession>} */
  let drag = null;

  /** @type {null | { originRow: number, originCol: number, valid: boolean, preclear: any }} */
  let hover = null;

  /**
   * 落子消行动画：先播特效，结束时只 clearExactCells（上一波格表），
   * 不整行扫盘，后放入的块不并入本波消除。
   * @type {null | {
   *   lines: { rows: number[], cols: number[], count: number },
   *   cells: { row: number, col: number, color: number, delay01: number, spin: number }[],
   *   sweep: { fromLeft: boolean, fromTop: boolean, epicRow: number, epicCol: number },
   *   start: number,
   *   duration: number,
   *   cellsPlaced: number,
   * }}
   */
  let clearFx = null;
  /** 消行演出进行中再触发的消除，排队顺序播 */
  /** @type {NonNullable<typeof clearFx>[]} */
  let clearQueue = [];

  /**
   * 松手落位：拖拽位 → 目标格快速吸附（视觉）；逻辑已 place。
   * @type {null | {
   *   start: number,
   *   duration: number,
   *   fromX: number,
   *   fromY: number,
   *   toX: number,
   *   toY: number,
   *   piece: import('./forms.js').PieceDef,
   *   hideCells: { row: number, col: number }[],
   * }}
   */
  let placeSnap = null;

  /**
   * 死亡演出：闪红×2 → 自下而上填满 → 停顿 → 自上而下露出死亡盘面 → 结算
   * @type {null | {
   *   phase: 'flash' | 'fill' | 'pause' | 'reveal',
   *   start: number,
   *   rowMs: number,
   *   pauseMs: number,
   *   flashMs: number,
   *   snapshot: (number|null)[][],
   *   fillers: (number|null)[][],
   *   displayCells: (number|null)[][],
   *   displayOpacity: number[][],
   * }}
   */
  let deathFx = null;

  let inputLockedUntil = 0;
  let gameOver = false;
  let layout = computeLayout(frame0, readSafeAreaInsets());
  boardView.rebuild(layout);

  const ghostPolicy = createGhostPolicy({
    grid,
    getLayout: () => layout,
    getTune,
  });
  const ghostHaptics = createGhostHaptics(haptics, getTune);

  const scoreEl = hud.querySelector('[data-game-score]');
  const bestEl = hud.querySelector('[data-best-score]');
  const phaseEl = hud.querySelector('[data-game-phase]');
  const statusEl = hud.querySelector('#status');
  // 结算/闪红层在 phone-frame 下，不在 #hud 内
  const overlayRoot = frameEl || hud;
  const overlayEl = overlayRoot.querySelector('[data-game-over]');
  const deathFlashEl = overlayRoot.querySelector('[data-death-flash]');
  const finalScoreEl = overlayRoot.querySelector('[data-final-score]');
  const restartBtn = overlayRoot.querySelector('[data-restart]');
  const editorEl = overlayRoot.querySelector('[data-level-editor]');
  const editorMaskEl = overlayRoot.querySelector('[data-editor-mask]');
  const editorCopyBtn = overlayRoot.querySelector('[data-editor-copy]');
  const editorClearBtn = overlayRoot.querySelector('[data-editor-clear]');
  const editorFillBtn = overlayRoot.querySelector('[data-editor-fill]');

  let bestScore = 0;
  try {
    bestScore = Number(localStorage.getItem('bb_best') || 0) || 0;
  } catch {
    bestScore = 0;
  }

  function startNextPuzzle() {
    puzzleLevel += 1;
    puzzle = createPuzzle(puzzleLevel);
    grid.load(puzzle.board);
    tray = puzzle.tray.slice(0, TRAY_SIZE);
    while (tray.length < TRAY_SIZE) tray.push(null);
    trayScrollX = 0;
    placedPieces = [];
  }

  function fillBoardForEditor() {
    /** @type {(number|null)[][]} */
    const board = [];
    for (let r = 0; r < GRID; r++) {
      board[r] = [];
      for (let c = 0; c < GRID; c++) board[r][c] = 0x8fbf61;
    }
    grid.load(board);
  }

  function trayEmpty() {
    return tray.every((p) => p == null);
  }

  function setGameOver(on) {
    gameOver = on;
    if (overlayEl) {
      overlayEl.hidden = !on;
      overlayEl.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) {
        overlayEl.classList.add('is-visible');
      } else {
        overlayEl.classList.remove('is-visible');
      }
    }
    if (on) {
      if (finalScoreEl) finalScoreEl.textContent = String(scoreState.score);
      if (scoreState.score > bestScore) {
        bestScore = scoreState.score;
        try {
          localStorage.setItem('bb_best', String(bestScore));
        } catch {
          /* ignore */
        }
      }
      syncHud();
    }
  }

  /** @returns {(number|null)[][]} */
  function cloneBoard(src) {
    return src.map((row) => row.slice());
  }

  /** 为空槽预生成填充色（死亡波用） */
  function buildDeathFillers(snapshot) {
    /** @type {(number|null)[][]} */
    const fillers = [];
    for (let r = 0; r < GRID; r++) {
      fillers[r] = [];
      for (let c = 0; c < GRID; c++) {
        if (snapshot[r][c] != null) {
          fillers[r][c] = null;
        } else {
          const idx = Math.floor(Math.random() * PIECE_PALETTE.length);
          fillers[r][c] = PIECE_PALETTE[idx] ?? 0x4da3ff;
        }
      }
    }
    return fillers;
  }

  function easeSmooth(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * @param {'fill' | 'reveal' | 'pause'} phase
   * @param {number} progress 连续进度 0..GRID（整数部分=已完成排，小数=当前排淡入/淡出）
   * @param {(number|null)[][]} snapshot
   * @param {(number|null)[][]} fillers
   * @returns {{ cells: (number|null)[][], opacity: number[][] }}
   */
  function buildDeathDisplay(phase, progress, snapshot, fillers) {
    const p = Math.max(0, Math.min(GRID, progress));
    const done = Math.floor(p);
    const frac = easeSmooth(p - done);

    /** @type {(number|null)[][]} */
    const cells = [];
    /** @type {number[][]} */
    const opacity = [];

    for (let r = 0; r < GRID; r++) {
      cells[r] = [];
      opacity[r] = [];
      for (let c = 0; c < GRID; c++) {
        const snap = snapshot[r][c];
        if (phase === 'fill') {
          // 自下而上：底部 done 行满；第 done 行正在淡入
          const d = GRID - 1 - r; // 0=底排
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else if (d < done) {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          } else if (d === done && done < GRID && frac > 0.001) {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = frac;
          } else {
            cells[r][c] = null;
            opacity[r][c] = 1;
          }
        } else if (phase === 'pause') {
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          }
        } else {
          // 自上而下揭开：顶部 done 行已是死亡盘；第 done 行 filler 淡出
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else if (r < done) {
            cells[r][c] = null;
            opacity[r][c] = 1;
          } else if (r === done && done < GRID) {
            // 淡出 filler
            const op = 1 - frac;
            if (op < 0.02) {
              cells[r][c] = null;
              opacity[r][c] = 1;
            } else {
              cells[r][c] = fillers[r][c];
              opacity[r][c] = op;
            }
          } else {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          }
        }
      }
    }
    return { cells, opacity };
  }

  function setDeathFlash(on) {
    if (!deathFlashEl) return;
    deathFlashEl.classList.toggle('is-active', !!on);
    deathFlashEl.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) {
      // 重触发 CSS 动画
      deathFlashEl.classList.remove('is-active');
      // force reflow
      void deathFlashEl.offsetWidth;
      deathFlashEl.classList.add('is-active');
    }
  }

  function startDeathFx() {
    if (deathFx || gameOver) return;
    drag = null;
    hover = null;
    const snapshot = cloneBoard(grid.cells);
    const fillers = buildDeathFillers(snapshot);
    const rowMs = FEEL_DEATH_ROW_MS;
    const pauseMs = FEEL_DEATH_PAUSE_MS;
    const flashMs = FEEL_DEATH_FLASH_MS;
    const disp = buildDeathDisplay('fill', 0, snapshot, fillers);
    deathFx = {
      phase: 'flash',
      start: performance.now(),
      rowMs,
      pauseMs,
      flashMs,
      snapshot,
      fillers,
      displayCells: disp.cells,
      displayOpacity: disp.opacity,
    };
    setDeathFlash(true);
    // 结算数据先写好，动画结束后再亮 overlay
    if (finalScoreEl) finalScoreEl.textContent = String(scoreState.score);
    if (scoreState.score > bestScore) {
      bestScore = scoreState.score;
      try {
        localStorage.setItem('bb_best', String(bestScore));
      } catch {
        /* ignore */
      }
    }
    syncHud();
    paint();
  }

  function finishDeathFx() {
    deathFx = null;
    setDeathFlash(false);
    setGameOver(true);
    paint();
  }

  function tickDeathFx() {
    if (!deathFx) return;
    const now = performance.now();
    const { phase, start, rowMs, pauseMs, flashMs, snapshot, fillers } = deathFx;
    const fillDur = GRID * rowMs;

    // 开场全屏闪红两次，再开始上升填块
    if (phase === 'flash') {
      const elapsed = now - start;
      // 闪红期间保持死亡盘面
      const hold = buildDeathDisplay('fill', 0, snapshot, fillers);
      deathFx.displayCells = hold.cells;
      deathFx.displayOpacity = hold.opacity;
      if (elapsed >= (flashMs ?? FEEL_DEATH_FLASH_MS)) {
        setDeathFlash(false);
        deathFx.phase = 'fill';
        deathFx.start = now;
      }
      paint();
      return;
    }

    if (phase === 'fill') {
      const elapsed = now - start;
      // 连续进度 0..GRID（含排内淡入）
      const progress = Math.min(GRID, elapsed / rowMs);
      const disp = buildDeathDisplay('fill', progress, snapshot, fillers);
      deathFx.displayCells = disp.cells;
      deathFx.displayOpacity = disp.opacity;
      if (elapsed >= fillDur) {
        const full = buildDeathDisplay('pause', GRID, snapshot, fillers);
        deathFx.displayCells = full.cells;
        deathFx.displayOpacity = full.opacity;
        deathFx.phase = 'pause';
        deathFx.start = now;
      }
      paint();
      return;
    }

    if (phase === 'pause') {
      const full = buildDeathDisplay('pause', GRID, snapshot, fillers);
      deathFx.displayCells = full.cells;
      deathFx.displayOpacity = full.opacity;
      if (now - start >= pauseMs) {
        deathFx.phase = 'reveal';
        deathFx.start = now;
      }
      paint();
      return;
    }

    // reveal：自上而下淡出填充，露出死亡盘
    {
      const elapsed = now - start;
      const progress = Math.min(GRID, elapsed / rowMs);
      const disp = buildDeathDisplay('reveal', progress, snapshot, fillers);
      deathFx.displayCells = disp.cells;
      deathFx.displayOpacity = disp.opacity;
      if (elapsed >= fillDur) {
        const final = buildDeathDisplay('reveal', GRID, snapshot, fillers);
        deathFx.displayCells = final.cells;
        deathFx.displayOpacity = final.opacity;
        paint();
        finishDeathFx();
        return;
      }
      paint();
    }
  }

  function checkGameOver() {
    // Puzzle mode intentionally has no fail state in v1. A bad placement simply
    // leaves the current puzzle incomplete.
    void anyTrayPieceFits;
  }

  function restart() {
    drag = null;
    hover = null;
    clearFx = null;
    clearQueue = [];
    placeSnap = null;
    deathFx = null;
    setDeathFlash(false);
    ghostHaptics.onClearFxEnd?.();
    boardView.clearAllDebris?.();
    grid.reset();
    placedPieces = [];
    nextPlacedId = 1;
    scoreState.reset();
    clearPendingDealPlan();
    puzzleLevel = initialPuzzleLevel - 1;
    startNextPuzzle();
    setGameOver(false);
    paint();
    updateStatus();
  }

  function syncHud() {
    if (scoreEl) scoreEl.textContent = String(puzzleLevel || 1);
    if (bestEl) bestEl.textContent = String(Math.max(bestScore, scoreState.score));
    if (statusEl) statusEl.hidden = !SHOW_DEBUG_STATUS;
    if (phaseEl) phaseEl.hidden = !SHOW_DEBUG_STATUS;
    applyScoreUi();
  }

  /** 分数字号 / 垂直位置（CSS 变量，真机调参即时生效） */
  function applyScoreUi() {
    const t = getTune();
    const frame = getFrameSize();
    const fontPx = Math.max(12, Number(t.UI_SCORE_FONT_PX) || 65);
    const shiftFrac = Number(t.UI_SCORE_OFFSET_Y) || 0;
    const shiftPx = shiftFrac * (frame.height || 0);
    const root = hud || document.documentElement;
    root.style.setProperty('--ui-score-font', `${fontPx}px`);
    root.style.setProperty('--ui-score-shift', `${shiftPx}px`);
  }

  /**
   * 落位目标 origin（frame 坐标，与 drag.frameX/Y 同语义：形状左上角）
   * @param {number} originRow
   * @param {number} originCol
   */
  function placeOriginFrame(originRow, originCol) {
    const rect = layout.cellRect(originCol, originRow);
    return { x: rect.x, y: rect.y };
  }

  /**
   * @param {import('./forms.js').PieceDef} piece
   * @param {number} originRow
   * @param {number} originCol
   */
  function collectPieceCells(piece, originRow, originCol) {
    /** @type {{ row: number, col: number }[]} */
    const out = [];
    const { rows, cols } = matrixSize(piece.matrix);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece.matrix[r][c]) out.push({ row: originRow + r, col: originCol + c });
      }
    }
    return out;
  }

  function rotateMatrixCW(matrix) {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const out = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = matrix[r][c];
    }
    return out;
  }

  function rotatePieceCW(piece) {
    const matrix = rotateMatrixCW(piece.matrix);
    const colorGrid = piece.cellColors || piece.matrix.map((row) => row.map((v) => (v ? piece.color : 0)));
    return {
      ...piece,
      id: `${piece.id}_r${((piece.rotationTurns || 0) + 1) % 4}`,
      matrix,
      cellColors: rotateMatrixCW(colorGrid),
      rotationTurns: ((piece.rotationTurns || 0) + 1) % 4,
    };
  }

  function placedAtCell(row, col) {
    for (let i = placedPieces.length - 1; i >= 0; i--) {
      const placed = placedPieces[i];
      if (placed.cells.some((cell) => cell.row === row && cell.col === col)) return placed;
    }
    return null;
  }

  function removePlacedPiece(placed) {
    placedPieces = placedPieces.filter((p) => p.id !== placed.id);
    for (const cell of placed.cells) {
      if (cell.row >= 0 && cell.row < GRID && cell.col >= 0 && cell.col < GRID) {
        grid.cells[cell.row][cell.col] = null;
      }
    }
  }

  function isInTrayBand(fx, fy) {
    const trayBand = layout.tray;
    return (
      fx >= trayBand.x &&
      fx <= trayBand.x + trayBand.w &&
      fy >= trayBand.y - layout.cell * 0.5 &&
      fy <= trayBand.y + trayBand.h + layout.cell * 0.8
    );
  }

  function tickPlaceSnap() {
    if (!placeSnap) return;
    const now = performance.now();
    if (now - placeSnap.start >= placeSnap.duration) {
      placeSnap = null;
      paint();
      return;
    }
    paint();
  }

  function paint() {
    const nowMs = performance.now();
    /** @type {number[][] | null} */
    let cellOpacity = deathFx?.displayOpacity ?? null;
    /** @type {null | { piece: any, frameX: number, frameY: number, scale: number, trayIndex?: number, alpha?: number }} */
    let dragPaint = null;

    if (deathFx) {
      dragPaint = null;
    } else if (drag) {
      dragPaint = {
        piece: drag.piece,
        frameX: drag.frameX,
        frameY: drag.frameY,
        scale: drag.scale,
        trayIndex: drag.trayIndex,
      };
    } else if (placeSnap) {
      const dur = Math.max(1, placeSnap.duration);
      const t = Math.min(1, Math.max(0, (nowMs - placeSnap.start) / dur));
      // ease-out cubic：前快后稳，落位干脆
      const e = 1 - (1 - t) ** 3;
      dragPaint = {
        piece: placeSnap.piece,
        frameX: placeSnap.fromX + (placeSnap.toX - placeSnap.fromX) * e,
        frameY: placeSnap.fromY + (placeSnap.toY - placeSnap.fromY) * e,
        scale: 0.97 + 0.03 * e,
        alpha: 0.92 + 0.08 * e,
      };
      // 落位中用 opacity=0 标记「隐藏格」；view 只关 visible，不改坏材质
      if (!cellOpacity) {
        cellOpacity = Array.from({ length: GRID }, () => Array(GRID).fill(1));
      }
      for (const hc of placeSnap.hideCells) {
        if (hc.row >= 0 && hc.row < GRID && hc.col >= 0 && hc.col < GRID) {
          cellOpacity[hc.row][hc.col] = 0;
        }
      }
    }

    boardView.render({
      layout,
      cells: deathFx?.displayCells ?? grid.cells,
      cellOpacity,
      tray: deathFx ? [null, null, null] : tray,
      drag: dragPaint,
      hover: deathFx || placeSnap ? null : hover,
      clearFx: deathFx ? null : clearFx,
      trayScrollX,
      nowMs,
    });
    syncHud();
  }

  /**
   * 收集将消格；缩放/扫光沿行或列「一边→另一边」。
   * 从哪一边起：看本次落子质心更靠近哪条边（左/右、上/下）。
   * @param {{ rows: number[], cols: number[] }} lines
   * @param {number[][]} matrix 刚落下的 polyomino
   * @param {number} originRow
   * @param {number} originCol
   * @returns {{
   *   cells: { row: number, col: number, color: number, delay01: number, spin: number }[],
   *   sweep: { fromLeft: boolean, fromTop: boolean, epicRow: number, epicCol: number },
   * }}
   */
  function collectLineCells(lines, matrix, originRow, originCol) {
    /** @type {{ row: number, col: number, color: number, delay01: number, spin: number }[]} */
    const out = [];
    const seen = new Set();
    const add = (r, c) => {
      const k = `${r},${c}`;
      if (seen.has(k)) return;
      seen.add(k);
      const color = grid.cells[r][c];
      if (color == null) return;
      out.push({ row: r, col: c, color, delay01: 0, spin: 0 });
    };
    for (const r of lines.rows) for (let c = 0; c < 8; c++) add(r, c);
    for (const c of lines.cols) for (let r = 0; r < 8; r++) add(r, c);

    /** @type {{ r: number, c: number }[]} */
    const anchors = [];
    if (matrix?.length) {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) anchors.push({ r: originRow + r, c: originCol + c });
        }
      }
    }
    if (!anchors.length) anchors.push({ r: originRow, c: originCol });

    let epicRow = 0;
    let epicCol = 0;
    for (const a of anchors) {
      epicRow += a.r;
      epicCol += a.c;
    }
    epicRow /= anchors.length;
    epicCol /= anchors.length;

    const mid = (GRID - 1) / 2;
    // 更靠近哪一边，就从那一边扫向对边
    const fromLeft = epicCol <= mid;
    const fromTop = epicRow <= mid;
    // 旋转与扫过方向一致：左→右/上→下 为负 Z（顺时针感），对边为正
    const spinRow = fromLeft ? -1 : 1;
    const spinCol = fromTop ? -1 : 1;

    const rowSet = new Set(lines.rows);
    const colSet = new Set(lines.cols);
    const last = GRID - 1;
    const stagger = Math.min(0.85, Math.max(0, FEEL_CLEAR_STAGGER));

    for (const cell of out) {
      /** @type {{ t: number, spin: number }[]} */
      const axis = [];
      // 行：左→右 或 右→左
      if (rowSet.has(cell.row)) {
        axis.push({
          t: fromLeft ? cell.col / last : (last - cell.col) / last,
          spin: spinRow,
        });
      }
      // 列：上→下 或 下→上
      if (colSet.has(cell.col)) {
        axis.push({
          t: fromTop ? cell.row / last : (last - cell.row) / last,
          spin: spinCol,
        });
      }
      // 行列交叉格取较早一侧，旋转跟该侧方向
      if (!axis.length) {
        cell.delay01 = 0;
        cell.spin = 0;
      } else {
        let best = axis[0];
        for (let i = 1; i < axis.length; i++) {
          if (axis[i].t < best.t) best = axis[i];
        }
        cell.delay01 = best.t * stagger;
        cell.spin = best.spin;
      }
    }
    out.sort((a, b) => a.delay01 - b.delay01 || a.row - b.row || a.col - b.col);
    return {
      cells: out,
      sweep: { fromLeft, fromTop, epicRow, epicCol },
    };
  }

  function isBoardFull() {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (grid.cells[r][c] == null) return false;
      }
    }
    return true;
  }

  function collectAllBoardCells() {
    /** @type {{ row: number, col: number, color: number, delay01: number, spin: number }[]} */
    const cells = [];
    const center = (GRID - 1) / 2;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const color = grid.cells[r][c];
        if (color == null) continue;
        const dist = Math.abs(r - center) + Math.abs(c - center);
        cells.push({
          row: r,
          col: c,
          color,
          delay01: Math.min(0.82, dist / (GRID + 2)),
          spin: (r + c) % 2 === 0 ? 1 : -1,
        });
      }
    }
    cells.sort((a, b) => a.delay01 - b.delay01 || a.row - b.row || a.col - b.col);
    return {
      cells,
      sweep: {
        fromLeft: true,
        fromTop: true,
        epicRow: center,
        epicCol: center,
      },
    };
  }

  /**
   * @param {NonNullable<typeof clearFx>} payload
   */
  function enqueueClearFx(payload) {
    if (clearFx) {
      clearQueue.push(payload);
      return;
    }
    clearFx = payload;
    ghostHaptics.onClearFxStart?.();
  }

  function finishClearFx() {
    if (!clearFx) return;
    const { lines, cellsPlaced, cells: clearCells } = clearFx;
    // 只清本波快照格，整行 clearLines 会误伤消行中后放入的块
    grid.clearExactCells(clearCells);
    const linesCleared = lines?.count ?? 0;
    clearFx = null;
    // 不强制掐断连续震：时长由 FEEL_HAPTIC_CLEAR_FX_DURATION_MS 自管；
    // 仅 restart 时 onClearFxEnd 强制 stop。
    scoreState.onPlace({
      cellsPlaced,
      linesCleared,
      boardEmpty: grid.isEmpty(),
    });
    if (trayEmpty() && grid.isEmpty()) startNextPuzzle();
    checkGameOver();

    // 队列中的下一波（后落子独立消除，不与上波混格）
    if (clearQueue.length) {
      const next = clearQueue.shift();
      if (next) {
        next.start = performance.now();
        clearFx = next;
        ghostHaptics.onClearFxStart?.();
      }
    }

    paint();
    updateStatus();
  }

  function tickClearFx() {
    if (!clearFx) return;
    const now = performance.now();
    if (now - clearFx.start >= clearFx.duration) {
      finishClearFx();
      return;
    }
    // 拖拽时由 tickDragFrame paint；仅清行时这里刷帧
    if (!drag) paint();
  }

  function framePointFromClient(clientX, clientY) {
    const rect = frameEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function cellFromFramePoint(fx, fy) {
    const { grid: g, cell } = layout;
    if (fx < g.x || fy < g.y || fx >= g.x + g.w || fy >= g.y + g.h) return null;
    const col = Math.floor((fx - g.x) / cell);
    const row = Math.floor((fy - g.y) / cell);
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;
    return { row, col };
  }

  function editorMaskText() {
    return grid.cells
      .map((row) => row.map((v) => (v == null ? '#' : '.')).join(''))
      .join('\n');
  }

  function syncEditorPanel() {
    if (!editorMode || !editorEl) return;
    editorEl.hidden = false;
    if (editorMaskEl) editorMaskEl.value = editorMaskText();
  }

  function setAllEditorCells(needed) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        grid.cells[r][c] = needed ? null : 0x8fbf61;
      }
    }
    paint();
    syncEditorPanel();
  }

  async function copyEditorMask() {
    const text = editorMaskText();
    if (editorMaskEl) {
      editorMaskEl.value = text;
      editorMaskEl.focus();
      editorMaskEl.select();
    }
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      document.execCommand?.('copy');
    }
  }

  function clampTrayScroll(x) {
    const slots = layout.tray.slots;
    if (!slots?.length) return 0;
    const last = slots[slots.length - 1];
    const contentRight = last.x + last.w;
    const max = Math.max(0, contentRight - (layout.tray.x + layout.tray.w));
    return Math.min(max, Math.max(0, x));
  }

  /** 正版：底栏三等分区优先，再回退块包围盒 */
  function hitTrayIndex(fx, fy) {
    for (const slot of layout.tray.slots) {
      const sx = slot.x - trayScrollX;
      if (
        fx >= sx &&
        fx <= sx + slot.w &&
        fy >= slot.y &&
        fy <= slot.y + slot.h &&
        tray[slot.index]
      ) {
        return slot.index;
      }
    }
    const tc = layout.tray.cell;
    const slop = Math.max(layout.cell * FEEL_HIT_SLOP, tc * 0.4);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < tray.length; i++) {
      const piece = tray[i];
      const slot = layout.tray.slots[i];
      if (!piece || !slot) continue;
      const { rows, cols } = matrixSize(piece.matrix);
      const tw = cols * tc;
      const th = rows * tc;
      const cx = slot.cx - trayScrollX;
      const left = cx - tw / 2 - slop;
      const right = cx + tw / 2 + slop;
      const top = slot.cy - th / 2 - slop;
      const bottom = slot.cy + th / 2 + slop;
      if (fx >= left && fx <= right && fy >= top && fy <= bottom) {
        const d = (fx - cx) ** 2 + (fy - slot.cy) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    return best;
  }

  function resolveHover() {
    if (!drag) {
      hover = null;
      return;
    }
    hover = ghostPolicy.resolve(
      drag,
      drag.frameX,
      drag.frameY,
      drag.piece.matrix,
    );
    ghostHaptics.onHover(drag, hover);
  }

  function updateDragFromPointer(fx, fy) {
    if (!drag) return;
    samplePointer(drag, fx, fy, layout, getTune);
    chaseTargetOnPointer(drag, getTune);
    resolveHover();
    paint();
  }

  function tickDragFrame() {
    if (!drag) return;
    tickSmooth(drag, getTune);
    resolveHover();
    paint();
  }

  function lockInput(ms) {
    inputLockedUntil = performance.now() + ms;
  }

  function isLocked() {
    // 消行 clearFx 不锁输入：可边消边拿下一块；仅 death / 短 reject 锁
    return performance.now() < inputLockedUntil || deathFx != null;
  }

  function onPointerDown(e) {
    // 只响应主指针：忽略第二指 / 多指，避免双点触控搅局
    if (e.isPrimary === false) return;
    if (editorMode) {
      const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
      const cell = cellFromFramePoint(fx, fy);
      if (!cell) return;
      e.preventDefault();
      const cur = grid.cells[cell.row][cell.col];
      grid.cells[cell.row][cell.col] = cur == null ? 0x8fbf61 : null;
      paint();
      syncEditorPanel();
      return;
    }
    if (gameOver || deathFx || isLocked() || drag) return;
    if (e.button != null && e.button !== 0) return;

    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    const boardCell = cellFromFramePoint(fx, fy);
    if (boardCell) {
      const placed = placedAtCell(boardCell.row, boardCell.col);
      if (placed) {
        e.preventDefault();
        stage.setPointerCapture?.(e.pointerId);
        const grabCell = layout.cellRect(placed.originCol, placed.originRow);
        removePlacedPiece(placed);
        drag = createDragSession({
          layout,
          piece: placed.piece,
          trayIndex: placed.trayIndex,
          pointerId: e.pointerId,
          fx,
          fy,
          getTune,
        });
        drag.frameX = grabCell.x;
        drag.frameY = grabCell.y;
        drag.targetOriginX = grabCell.x;
        drag.targetOriginY = grabCell.y;
        drag.baseCenterX = grabCell.x + (matrixSize(placed.piece.matrix).cols * layout.cell) / 2;
        drag.baseCenterY = grabCell.y + (matrixSize(placed.piece.matrix).rows * layout.cell) / 2;
        drag.tapStartFx = fx;
        drag.tapStartFy = fy;
        drag.returningFromBoard = true;
        drag.originalPlaced = placed;
        hover = null;
        paint();
        return;
      }
    }

    const idx = hitTrayIndex(fx, fy);
    if (idx < 0 || !tray[idx]) return;

    e.preventDefault();
    stage.setPointerCapture?.(e.pointerId);
    trayScrollDrag = {
      pointerId: e.pointerId,
      startFx: fx,
      startFy: fy,
      startScrollX: trayScrollX,
      trayIndex: idx,
      moved: false,
    };
    hover = null;
    paint();
  }

  function onPointerMove(e) {
    e.preventDefault();
    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    if (trayScrollDrag && e.pointerId === trayScrollDrag.pointerId && !drag) {
      const dx = fx - trayScrollDrag.startFx;
      const dy = fy - trayScrollDrag.startFy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) trayScrollDrag.moved = true;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        trayScrollX = clampTrayScroll(trayScrollDrag.startScrollX - dx);
        paint();
        return;
      }
      if (dy < -Math.max(10, layout.cell * 0.22)) {
        const piece = tray[trayScrollDrag.trayIndex];
        if (!piece) return;
        drag = createDragSession({
          layout,
          piece,
          trayIndex: trayScrollDrag.trayIndex,
          pointerId: e.pointerId,
          fx: trayScrollDrag.startFx,
          fy: trayScrollDrag.startFy,
          getTune,
        });
        drag.tapStartFx = trayScrollDrag.startFx;
        drag.tapStartFy = trayScrollDrag.startFy;
        drag.frameX -= trayScrollX;
        drag.targetOriginX -= trayScrollX;
        drag.baseCenterX -= trayScrollX;
        trayScrollDrag = null;
      } else {
        return;
      }
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    updateDragFromPointer(fx, fy);
  }

  function onPointerUp(e) {
    if (trayScrollDrag && e.pointerId === trayScrollDrag.pointerId && !drag) {
      e.preventDefault();
      try {
        stage.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      const active = trayScrollDrag;
      trayScrollDrag = null;
      const upPoint = framePointFromClient(e.clientX, e.clientY);
      const tapMove = Math.hypot(upPoint.x - active.startFx, upPoint.y - active.startFy);
      if (tapMove < Math.max(10, layout.cell * 0.22)) {
        const piece = tray[active.trayIndex];
        if (piece) tray[active.trayIndex] = rotatePieceCW(piece);
      }
      paint();
      updateStatus();
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    try {
      stage.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    const active = drag;
    if (active) {
      hover = ghostPolicy.resolve(
        active,
        active.frameX,
        active.frameY,
        active.piece.matrix,
      );
    }
    const h = hover;
    drag = null;

    const upPoint = framePointFromClient(e.clientX, e.clientY);
    const tapMove = Math.hypot(
      upPoint.x - (active.tapStartFx ?? upPoint.x),
      upPoint.y - (active.tapStartFy ?? upPoint.y),
    );
    if (!h?.valid && tapMove < Math.max(10, layout.cell * 0.22)) {
      tray[active.trayIndex] = rotatePieceCW(active.piece);
      hover = null;
      placeSnap = null;
      paint();
      updateStatus();
      return;
    }

    if (active.returningFromBoard && isInTrayBand(upPoint.x, upPoint.y)) {
      tray[active.trayIndex] = active.piece;
      hover = null;
      placeSnap = null;
      paint();
      updateStatus();
      return;
    }

    if (h?.valid) {
      const cellsPlaced = countCells(active.piece.matrix);
      const placedCells = collectPieceCells(active.piece, h.originRow, h.originCol);
      grid.place(
        active.piece.matrix,
        h.originRow,
        h.originCol,
        active.piece.cellColors || active.piece.color,
      );
      tray[active.trayIndex] = null;
      placedPieces.push({
        id: nextPlacedId++,
        piece: active.piece,
        trayIndex: active.trayIndex,
        originRow: h.originRow,
        originCol: h.originCol,
        cells: placedCells,
      });

      // 视觉：从拖拽位快速吸附到目标格（逻辑已 place）
      const to = placeOriginFrame(h.originRow, h.originCol);
      const snapMs = Math.max(
        0,
        Number(getTune().FEEL_PLACE_SNAP_MS ?? FEEL_PLACE_SNAP_MS) || 0,
      );
      if (snapMs > 0) {
        placeSnap = {
          start: performance.now(),
          duration: snapMs,
          fromX: active.frameX,
          fromY: active.frameY,
          toX: to.x,
          toY: to.y,
          piece: active.piece,
          hideCells: placedCells,
        };
      } else {
        placeSnap = null;
      }

      if (isBoardFull()) {
        const lines = {
          rows: Array.from({ length: GRID }, (_, i) => i),
          cols: [],
          count: GRID,
        };
        const collected = collectAllBoardCells();
        enqueueClearFx({
          lines,
          cells: collected.cells,
          sweep: collected.sweep,
          start: performance.now(),
          duration: FEEL_CLEAR_MS,
          cellsPlaced,
        });
        lockInput(FEEL_CLEAR_MS);
      } else {
        scoreState.onPlace({
          cellsPlaced,
          linesCleared: 0,
          boardEmpty: grid.isEmpty(),
        });
        checkGameOver();
      }
    } else {
      if (active.returningFromBoard && active.originalPlaced) {
        grid.place(
          active.originalPlaced.piece.matrix,
          active.originalPlaced.originRow,
          active.originalPlaced.originCol,
          active.originalPlaced.piece.cellColors || active.originalPlaced.piece.color,
        );
        placedPieces.push(active.originalPlaced);
      }
      // 未放下：短暂防误触（可选）；合法放下不锁
      placeSnap = null;
      lockInput(FEEL_REJECT_MS);
    }

    hover = null;
    paint();
    updateStatus();
  }

  function onPointerCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    hover = null;
    paint();
  }

  function updateStatus() {
    if (!SHOW_DEBUG_STATUS) {
      setStatus?.('');
      if (statusEl) statusEl.hidden = true;
      return;
    }
    if (statusEl) statusEl.hidden = false;
    const size = getFrameSize();
    setStatus?.(
      `debug\n` +
        `platform: ${Capacitor.getPlatform()} | haptics: ${haptics.isNativeIos() ? 'ios' : 'off'}\n` +
        `frame: ${Math.round(size.width)}×${Math.round(size.height)} · cell ${layout.cell.toFixed(1)}\n` +
        `puzzle: ${puzzleLevel} · missing ${puzzle?.missingCells ?? 0}\n` +
        `deal: ${lastDealMeta.difficulty ?? '?'} ` +
        (gameOver ? '\nGAME OVER' : ''),
    );
  }

  function relayout() {
    applySafeAreaCssVars(isNativeApp());
    const frame = getFrameSize();
    const safe = readSafeAreaInsets();
    const size = resizeToFrame(renderer, null);
    const w = size.width;
    const h = size.height;
    if (w < 2 || h < 2) return;

    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();

    layout = computeLayout(frame, safe);
    trayScrollX = clampTrayScroll(trayScrollX);
    boardView.rebuild(layout);
    drag = null;
    hover = null;
    applyScoreUi();
    paint();
    syncEditorPanel();
    updateStatus();
  }

  function applyTune(opts = {}) {
    applyScoreUi();
    if (opts.layout !== false) {
      relayout();
      return;
    }
    paint();
    updateStatus();
  }

  // init
  if (editorMode) {
    puzzleLevel = editorLevel;
    puzzle = createPuzzle(editorLevel);
    tray = Array.from({ length: TRAY_SIZE }, () => null);
    grid.load(puzzle.board);
  } else {
    puzzleLevel = initialPuzzleLevel - 1;
    startNextPuzzle();
  }
  boardView.rebuild(layout);
  setGameOver(false);
  paint();
  relayout();

  const pointerTarget = frameEl || stage;
  pointerTarget.style.touchAction = 'none';
  pointerTarget.addEventListener('pointerdown', onPointerDown);
  pointerTarget.addEventListener('pointermove', onPointerMove);
  pointerTarget.addEventListener('pointerup', onPointerUp);
  pointerTarget.addEventListener('pointercancel', onPointerCancel);

  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      restart();
    });
  }

  if (editorMode) {
    syncEditorPanel();
    editorCopyBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyEditorMask();
    });
    editorClearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setAllEditorCells(false);
    });
    editorFillBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setAllEditorCells(true);
    });
    editorEl?.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  let running = true;
  renderer.setAnimationLoop(() => {
    if (!running) return;
    if (deathFx) {
      tickDeathFx();
    } else {
      // 消行 / 拖拽 / 落位吸附可并行
      if (drag) tickDragFrame();
      if (placeSnap) tickPlaceSnap();
      if (clearFx) tickClearFx();
      else if (!drag && !placeSnap && boardView.hasActiveDebris?.()) paint();
    }
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    getLayout: () => layout,
    relayout,
    applyTune,
    restart,
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      pointerTarget.removeEventListener('pointerdown', onPointerDown);
      pointerTarget.removeEventListener('pointermove', onPointerMove);
      pointerTarget.removeEventListener('pointerup', onPointerUp);
      pointerTarget.removeEventListener('pointercancel', onPointerCancel);
      boardView.dispose();
    },
  };
}
