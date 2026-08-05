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
  TRAY_BOUNCE_DAMPING,
  TRAY_BOUNCE_STIFFNESS,
  TRAY_FLIP_MS,
  TRAY_FLING_FRICTION,
  TRAY_FLING_MAX_V,
  TRAY_LIFT_SWIPE_UP_CELLS,
  TRAY_LOGIC_OVERSCROLL_FRAC,
  TRAY_LONG_PRESS_MS,
  TRAY_SCROLL_AXIS,
  TRAY_SCROLL_BLOCK_UP_RATIO,
  TRAY_SCROLL_SLOP_PX,
  TRAY_SIZE,
  TRAY_TAP_SLOP_PX,
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
import {
  buildScreenSlots,
  clampScroll,
  createTrayMetrics,
  easeOutCubic,
  insertIndexFromFx,
  lerp,
  pieceScreenCenterX,
  pieceScreenLeftX,
  rubberScrollX,
  trayScrollLimits,
} from './tray-layout.js';
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

  /**
   * 候选列表。拖起未落盘时原槽可为 null（占位），其它块位置/scroll 不变；
   * 落盘成功后再压实去掉洞。
   * @type {(import('./forms.js').PieceDef|null)[]}
   */
  let tray = [];
  let trayScrollX = 0;
  let trayScrollV = 0;
  /** @type {'idle' | 'dragging' | 'gliding' | 'bouncing'} */
  let trayScrollPhase = 'idle';
  let trayScrollLastT = 0;
  let nextPieceUid = 1;
  /**
   * 指针在 tray 上的预备态（点转 / 横滑 / 长按·上滑拖）
   * @type {null | {
   *   pointerId: number,
   *   startFx: number,
   *   startFy: number,
   *   startScrollX: number,
   *   trayIndex: number,
   *   pieceUid: number | string,
   *   t0: number,
   *   mode: 'armed' | 'scroll',
   *   longPressFired: boolean,
   *   lastFx: number,
   *   lastFy: number,
   *   lastT: number,
   * }}
   */
  let trayPointer = null;
  /**
   * FLIP 附加偏移（屏幕 px）：drawX = baseScreenX + offset
   * 动画 offset: from → 0，绝不把绝对坐标写进 piece
   * @type {Map<string | number, { from: number, start: number, dur: number }>}
   */
  let trayFlip = new Map();
  /** @type {{ id: number, piece: import('./forms.js').PieceDef, pieceUid?: number|string, trayIndex: number, originRow: number, originCol: number, cells: {row:number,col:number}[] }[]} */
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
  /** @type {null | { start: number, duration: number, stagger: number }} */
  let boardRevealFx = null;

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

  function ensurePieceUid(piece) {
    if (piece == null) return piece;
    if (piece.uid == null) {
      piece.uid = nextPieceUid++;
    }
    return piece;
  }

  function normalizeTrayList(list) {
    return (list || [])
      .filter(Boolean)
      .slice(0, TRAY_SIZE)
      .map((p) => ensurePieceUid({ ...p }));
  }

  function trayMetrics() {
    return createTrayMetrics(layout.tray, tray.length);
  }

  function scrollLimits() {
    return trayScrollLimits(trayMetrics());
  }

  /**
   * 逻辑 scroll 允许的短暂越界范围（跟手/滑行），禁止无界飞出。
   * 绘制永远用 visualScrollX()（rubber 映射），整排不会因 scroll 上千而消失。
   */
  function logicScrollBounds() {
    const m = trayMetrics();
    const lim = trayScrollLimits(m);
    const pad = Math.max(24, m.viewW * TRAY_LOGIC_OVERSCROLL_FRAC);
    return { min: lim.min - pad, max: lim.max + pad, lim, viewW: m.viewW };
  }

  /** 绘制 / 命中专用：出界一律 rubber，空闲硬夹 */
  function visualScrollX() {
    if (!Number.isFinite(trayScrollX)) return 0;
    const m = trayMetrics();
    const lim = trayScrollLimits(m);
    if (trayScrollPhase === 'idle') {
      return clampScroll(trayScrollX, lim);
    }
    // dragging / gliding / bouncing：逻辑可暂出界，视觉永远有界
    return rubberScrollX(trayScrollX, lim.min, lim.max, m.viewW);
  }

  /** 逻辑 scroll 清洗 */
  function sanitizeTrayScroll() {
    if (!Number.isFinite(trayScrollX)) trayScrollX = 0;
    if (!Number.isFinite(trayScrollV)) trayScrollV = 0;
    const m = trayMetrics();
    const lim = trayScrollLimits(m);
    const b = logicScrollBounds();
    if (
      m.fits &&
      trayScrollPhase !== 'dragging' &&
      trayScrollPhase !== 'gliding' &&
      trayScrollPhase !== 'bouncing'
    ) {
      trayScrollX = 0;
      trayScrollV = 0;
      return;
    }
    if (trayScrollPhase === 'idle') {
      trayScrollX = clampScroll(trayScrollX, lim);
    } else {
      // 任何动态相位都钳在有限 overscroll 内
      trayScrollX = Math.min(b.max, Math.max(b.min, trayScrollX));
    }
  }

  /**
   * 同步 layout.tray.slots —— 仅调试区框；绘制走 trayDrawList()。
   */
  function refreshTraySlots() {
    if (!layout?.tray) return;
    const m = trayMetrics();
    layout.tray.slotW = m.slotW;
    layout.tray.cy = m.cy;
    layout.tray.slots = buildScreenSlots(m, 0);
    sanitizeTrayScroll();
  }

  function flipOffsetAt(uid, nowMs) {
    if (uid == null) return 0;
    const anim = trayFlip.get(uid);
    if (!anim) return 0;
    if (!Number.isFinite(anim.from)) {
      trayFlip.delete(uid);
      return 0;
    }
    const t = (nowMs - anim.start) / Math.max(1, anim.dur);
    if (t >= 1) {
      trayFlip.delete(uid);
      return 0;
    }
    return lerp(anim.from, 0, easeOutCubic(t));
  }

  /** 屏幕中心 X（含 FLIP 偏移，用视觉 scroll） */
  function screenCxAt(index, nowMs = performance.now()) {
    const m = trayMetrics();
    const p = tray[index];
    const off = p?.uid != null ? flipOffsetAt(p.uid, nowMs) : 0;
    return pieceScreenCenterX(m, index, visualScrollX(), off);
  }

  function captureScreenCenters() {
    /** @type {Map<string|number, number>} */
    const map = new Map();
    const now = performance.now();
    const m = trayMetrics();
    const scroll = visualScrollX();
    for (let i = 0; i < tray.length; i++) {
      const p = tray[i];
      if (p?.uid == null) continue;
      map.set(p.uid, pieceScreenCenterX(m, i, scroll, flipOffsetAt(p.uid, now)));
    }
    return map;
  }

  /**
   * 列表变更后：scroll 锚定（仅内容超出时）+ FLIP 偏移
   * @param {Map<string|number, number>} prevCenters
   * @param {string|number|null} [preferUid]
   */
  function afterTrayListChange(prevCenters, preferUid = null) {
    const m = trayMetrics();
    const lim = trayScrollLimits(m);

    if (m.fits) {
      trayScrollX = 0;
      trayScrollV = 0;
      trayScrollPhase = 'idle';
    } else {
      let anchorUid = preferUid;
      if (anchorUid == null || !tray.some((p) => p.uid === anchorUid)) {
        for (const p of tray) {
          if (p?.uid != null && prevCenters.has(p.uid)) {
            anchorUid = p.uid;
            break;
          }
        }
      }
      if (anchorUid != null) {
        const idx = tray.findIndex((p) => p.uid === anchorUid);
        const want = prevCenters.get(anchorUid);
        if (idx >= 0 && want != null && Number.isFinite(want)) {
          // want = viewX + contentCenter - scroll  =>  scroll = viewX + contentCenter - want
          const step = m.stride > 0 ? m.stride : m.slotW;
          const contentCx = m.pad + (idx + 0.5) * step;
          trayScrollX = m.viewX + contentCx - want;
        }
      }
      trayScrollX = clampScroll(trayScrollX, lim);
    }

    // FLIP：offset = oldScreen - newBaseScreen，再收到 0
    const now = performance.now();
    trayFlip = new Map();
    for (let i = 0; i < tray.length; i++) {
      const p = tray[i];
      if (p?.uid == null) continue;
      const base = pieceScreenCenterX(m, i, trayScrollX, 0);
      const old = prevCenters.has(p.uid) ? prevCenters.get(p.uid) : base;
      if (old == null || !Number.isFinite(old) || !Number.isFinite(base)) continue;
      const from = old - base;
      if (Math.abs(from) < 0.5) continue;
      trayFlip.set(p.uid, { from, start: now, dur: TRAY_FLIP_MS });
    }
    refreshTraySlots();
  }

  function applyTrayListChange(mutator, preferAnchorUid = null) {
    const prev = captureScreenCenters();
    mutator();
    afterTrayListChange(prev, preferAnchorUid);
  }

  /** 供 view 绘制的扁平列表（唯一绘制真源；永远用 visualScroll） */
  function trayDrawList(nowMs = performance.now()) {
    const m = trayMetrics();
    const scroll = visualScrollX();
    /** @type {{ piece: any, cx: number, cy: number, slotW: number }[]} */
    const list = [];
    for (let i = 0; i < tray.length; i++) {
      const piece = tray[i];
      if (!piece) continue;
      if (drag?.pieceUid != null && piece.uid === drag.pieceUid) continue;
      const off = flipOffsetAt(piece.uid, nowMs);
      const cx = pieceScreenCenterX(m, i, scroll, off);
      if (!Number.isFinite(cx) || !Number.isFinite(m.cy)) continue;
      list.push({ piece, cx, cy: m.cy, slotW: m.slotW });
    }
    return list;
  }

  function startNextPuzzle() {
    puzzleLevel += 1;
    puzzle = createPuzzle(puzzleLevel);
    grid.load(puzzle.board);
    tray = normalizeTrayList(puzzle.tray);
    trayScrollX = 0;
    trayScrollV = 0;
    trayScrollPhase = 'idle';
    trayFlip = new Map();
    trayPointer = null;
    refreshTraySlots();
    placedPieces = [];
    boardRevealFx = { start: performance.now(), duration: 500, stagger: 54 };
    lockInput(170);
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
    return !tray.some((p) => p != null);
  }

  function updateBestScore() {
    if (scoreState.score <= bestScore) return;
    bestScore = scoreState.score;
    try {
      localStorage.setItem('bb_best', String(bestScore));
    } catch {
      /* ignore */
    }
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
      updateBestScore();
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
    updateBestScore();
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
    trayPointer = null;
    trayScrollV = 0;
    trayScrollPhase = 'idle';
    trayFlip = new Map();
    clearFx = null;
    clearQueue = [];
    boardRevealFx = null;
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
    const uid = piece.uid;
    return {
      ...piece,
      uid,
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
    sanitizeTrayScroll();
    /** @type {number[][] | null} */
    let cellOpacity = deathFx?.displayOpacity ?? null;
    /** @type {null | { piece: any, frameX: number, frameY: number, scale: number, trayIndex?: number, pieceUid?: number|string, alpha?: number }} */
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
        pieceUid: drag.pieceUid,
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
    if (!deathFx && boardRevealFx) {
      if (!cellOpacity) {
        cellOpacity = Array.from({ length: GRID }, () => Array(GRID).fill(1));
      }
      const elapsed = nowMs - boardRevealFx.start;
      const inner = (GRID - 1) / 2;
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (grid.cells[r][c] == null) continue;
          const edgeDist = Math.min(r, c, GRID - 1 - r, GRID - 1 - c);
          const delay = edgeDist * boardRevealFx.stagger;
          const local = Math.min(1, Math.max(0, (elapsed - delay) / boardRevealFx.duration));
          const ease = 1 - (1 - local) ** 3;
          cellOpacity[r][c] = Math.min(cellOpacity[r][c], ease);
        }
      }
    }

    boardView.render({
      layout,
      cells: deathFx?.displayCells ?? grid.cells,
      cellOpacity,
      tray: deathFx ? [] : tray,
      trayDraws: deathFx ? [] : trayDrawList(nowMs),
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

  function collectAllBoardCells(originCenter = null) {
    /** @type {{ row: number, col: number, color: number, delay01: number, spin: number }[]} */
    const cells = [];
    const centerRow = originCenter?.row ?? (GRID - 1) / 2;
    const centerCol = originCenter?.col ?? (GRID - 1) / 2;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const color = grid.cells[r][c];
        if (color == null) continue;
        const dist = Math.abs(r - centerRow) + Math.abs(c - centerCol);
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
        fromLeft: centerCol <= (GRID - 1) / 2,
        fromTop: centerRow <= (GRID - 1) / 2,
        epicRow: centerRow,
        epicCol: centerCol,
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
    updateBestScore();
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

  function tickBoardRevealFx() {
    if (!boardRevealFx) return;
    const maxEdge = Math.floor((GRID - 1) / 2);
    const total = boardRevealFx.duration + maxEdge * boardRevealFx.stagger;
    if (performance.now() - boardRevealFx.start >= total) {
      boardRevealFx = null;
    }
    paint();
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

  function clampTrayScrollHard(x) {
    return clampScroll(x, scrollLimits());
  }

  /** 跟手：只存逻辑位置，且钳在有限 overscroll 内 */
  function applyScrollDrag(rawX) {
    if (!Number.isFinite(rawX)) {
      trayScrollX = 0;
      return;
    }
    const b = logicScrollBounds();
    trayScrollX = Math.min(b.max, Math.max(b.min, rawX));
  }

  function tapSlop() {
    return Math.max(TRAY_TAP_SLOP_PX, layout.cell * 0.22);
  }

  function scrollSlop() {
    // 相对格宽也抬一点，真机小抖不易进横滑
    return Math.max(TRAY_SCROLL_SLOP_PX, (layout.cell || 20) * 0.38);
  }

  function scrollAxis() {
    return TRAY_SCROLL_AXIS;
  }

  function liftSwipeUp() {
    return Math.max(10, layout.cell * TRAY_LIFT_SWIPE_UP_CELLS);
  }

  /** 有明显上移（朝棋盘）时不允许从 armed 切入横滑 */
  function isArmedMovingTowardBoard(dy) {
    const up = -dy; // Y 向下为正
    if (up <= 0) return false;
    const block =
      liftSwipeUp() *
      (getTune().TRAY_SCROLL_BLOCK_UP_RATIO ?? TRAY_SCROLL_BLOCK_UP_RATIO);
    return up >= Math.max(6, block);
  }

  /** 与绘制同一套 visualScroll 命中 */
  function hitTrayIndex(fx, fy) {
    const m = trayMetrics();
    if (tray.length === 0) return -1;
    const scroll = visualScrollX();

    // 1) 槽矩形
    for (let i = 0; i < tray.length; i++) {
      if (!tray[i]) continue;
      const left = pieceScreenLeftX(m, i, scroll);
      if (
        fx >= left &&
        fx <= left + m.slotW &&
        fy >= m.viewY &&
        fy <= m.viewY + m.viewH
      ) {
        return i;
      }
    }
    // 2) 包围盒 + slop
    const tc = layout.tray.cell;
    const slop = Math.max(layout.cell * FEEL_HIT_SLOP, tc * 0.4);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < tray.length; i++) {
      const piece = tray[i];
      if (!piece) continue;
      const { rows, cols } = matrixSize(piece.matrix);
      const tw = cols * tc;
      const th = rows * tc;
      const cx = pieceScreenCenterX(m, i, scroll, flipOffsetAt(piece.uid, performance.now()));
      const cy = m.cy;
      const left = cx - tw / 2 - slop;
      const right = cx + tw / 2 + slop;
      const top = cy - th / 2 - slop;
      const bottom = cy + th / 2 + slop;
      if (fx >= left && fx <= right && fy >= top && fy <= bottom) {
        const d = (fx - cx) ** 2 + (fy - cy) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    return best;
  }

  /**
   * 从 tray 拿起：原槽留 null 占位，其它块与 scroll 不动。
   * @param {number} index
   * @param {number} pointerId
   * @param {number} fx
   * @param {number} fy
   */
  function liftPieceFromTray(index, pointerId, fx, fy) {
    const piece = tray[index];
    if (!piece) return false;
    const savedScroll = Number.isFinite(trayScrollX) ? trayScrollX : 0;
    const liftCx = screenCxAt(index);
    const liftCy = trayMetrics().cy;
    const pieceUid = piece.uid;
    // 占位洞：不 reflow、不改 scroll
    tray[index] = null;
    trayFlip = new Map();
    trayScrollX = savedScroll;
    trayScrollV = 0;
    trayScrollPhase = 'idle';
    drag = createDragSession({
      layout,
      piece,
      trayIndex: index,
      pointerId,
      fx,
      fy,
      getTune,
      slotCx: liftCx,
      slotCy: liftCy,
    });
    drag.pieceUid = pieceUid;
    drag.homeTrayIndex = index;
    drag.savedTrayScrollX = savedScroll;
    drag.tapStartFx = fx;
    drag.tapStartFy = fy;
    drag.liftedFromTray = true;
    trayPointer = null;
    hover = null;
    paint();
    return true;
  }

  /**
   * 未落盘取消：填回原洞 + 恢复 scroll（候选区看起来像没拖过）
   */
  function restoreLiftedTrayPiece(session) {
    if (!session?.piece) return;
    ensurePieceUid(session.piece);
    const home = homeIndexForDrag(session);
    if (
      home != null &&
      home >= 0 &&
      home < tray.length &&
      tray[home] == null
    ) {
      tray[home] = session.piece;
    } else if (home != null && home >= 0 && home < tray.length) {
      tray[home] = session.piece;
    } else {
      tray.push(session.piece);
    }
    trayFlip = new Map();
    if (
      session.savedTrayScrollX != null &&
      Number.isFinite(session.savedTrayScrollX)
    ) {
      trayScrollX = session.savedTrayScrollX;
    }
    trayScrollV = 0;
    trayScrollPhase = 'idle';
    trayScrollX = clampScroll(trayScrollX, scrollLimits());
    refreshTraySlots();
  }

  /** 落盘成功后去掉 null 洞并正常 reflow */
  function compactTrayAfterPlace() {
    if (!tray.some((p) => p == null)) return;
    applyTrayListChange(() => {
      tray = tray.filter((p) => p != null);
    });
  }

  /**
   * 回 tray（盘上摘下等：按原位插入，可 reflow）。
   * @param preferredIndex 有则插回原槽；无则按手指 x 插。
   */
  function insertPieceIntoTray(piece, fx, preferredIndex = null) {
    ensurePieceUid(piece);
    let idx;
    if (preferredIndex != null && Number.isFinite(Number(preferredIndex))) {
      idx = Math.max(0, Math.min(tray.length, Math.round(Number(preferredIndex))));
    } else {
      const m = trayMetrics();
      idx = insertIndexFromFx(fx, m, trayScrollX);
    }
    applyTrayListChange(() => {
      tray.splice(idx, 0, piece);
    }, piece.uid);
  }

  /** 拖回 tray 时优先用原候选位，避免乱序 */
  function homeIndexForDrag(session) {
    if (session == null) return null;
    if (session.homeTrayIndex != null && Number.isFinite(Number(session.homeTrayIndex))) {
      return Number(session.homeTrayIndex);
    }
    if (session.returningFromBoard && session.originalPlaced?.trayIndex != null) {
      return Number(session.originalPlaced.trayIndex);
    }
    if (session.trayIndex != null && session.trayIndex >= 0) {
      return Number(session.trayIndex);
    }
    return null;
  }

  /**
   * 惯性 / 回弹。
   * trayScrollV 单位：px/s（不是 px/ms）。
   * 绘制始终 visualScrollX()，逻辑位置再大也只 rubber 出一点。
   */
  function tickTrayScroll(nowMs) {
    if (trayScrollPhase !== 'gliding' && trayScrollPhase !== 'bouncing') return;
    if (!trayScrollLastT) trayScrollLastT = nowMs;
    let dt = (nowMs - trayScrollLastT) / 1000;
    trayScrollLastT = nowMs;
    if (dt <= 0) return;
    dt = Math.min(0.032, dt);
    const lim = scrollLimits();
    const b = logicScrollBounds();
    const { min, max } = lim;

    if (trayScrollPhase === 'gliding') {
      // v: px/s → 位移 px
      trayScrollX += (trayScrollV || 0) * dt;
      trayScrollV *= Math.exp(-TRAY_FLING_FRICTION * dt);
      if (!Number.isFinite(trayScrollX)) trayScrollX = 0;
      if (!Number.isFinite(trayScrollV)) trayScrollV = 0;
      // 逻辑位置封顶，避免越积越大、回弹「从天而降」
      trayScrollX = Math.min(b.max, Math.max(b.min, trayScrollX));
      if (trayScrollX <= min || trayScrollX >= max) {
        // 贴边或越界 → 回弹（带一点剩余速度）
        trayScrollPhase = 'bouncing';
      } else if (Math.abs(trayScrollV) < 30) {
        trayScrollV = 0;
        trayScrollX = clampScroll(trayScrollX, lim);
        trayScrollPhase = 'idle';
      }
      paint();
      return;
    }

    // bouncing：快弹簧 + 欠阻尼过冲（越过 min/max 再弹回定住）
    const target = trayScrollX < min ? min : trayScrollX > max ? max : trayScrollX;
    // 过冲带略收：节奏更快，过冲仍可见
    const overshootPad = Math.max(8, b.viewW * 0.09);
    const springMin = min - overshootPad;
    const springMax = max + overshootPad;

    const x = trayScrollX - target;
    // a = -k*x - c*v；k 大 → 周期短（节奏快）
    const a = -TRAY_BOUNCE_STIFFNESS * x - TRAY_BOUNCE_DAMPING * (trayScrollV || 0);
    trayScrollV = (trayScrollV || 0) + a * dt;
    trayScrollX += trayScrollV * dt;
    if (!Number.isFinite(trayScrollX)) trayScrollX = target;
    if (!Number.isFinite(trayScrollV)) trayScrollV = 0;
    trayScrollX = Math.min(springMax, Math.max(springMin, trayScrollX));

    // 更早收束，缩短总回弹时间（过冲至少完整走完半拍后再掐）
    const inside = trayScrollX >= min - 0.6 && trayScrollX <= max + 0.6;
    if (inside && Math.abs(trayScrollX - target) < 1.1 && Math.abs(trayScrollV) < 120) {
      trayScrollX = target;
      trayScrollV = 0;
      trayScrollPhase = 'idle';
    }
    paint();
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
        const { rows, cols } = matrixSize(placed.piece.matrix);
        // 盘上几何中心；createDragSession 会叠 FEEL_DRAG_OFFSET_* 抬起姿势（与 tray 一致）
        const boardCx = grabCell.x + (cols * layout.cell) / 2;
        const boardCy = grabCell.y + (rows * layout.cell) / 2;
        removePlacedPiece(placed);
        drag = createDragSession({
          layout,
          piece: placed.piece,
          trayIndex: placed.trayIndex ?? 0,
          pointerId: e.pointerId,
          fx,
          fy,
          getTune,
          slotCx: boardCx,
          slotCy: boardCy,
        });
        // 不再用 grabCell 覆盖 base/frame，保留与 tray 相同的抬起姿势
        drag.tapStartFx = fx;
        drag.tapStartFy = fy;
        drag.returningFromBoard = true;
        drag.originalPlaced = placed;
        drag.homeTrayIndex =
          placed.homeTrayIndex ?? placed.trayIndex ?? 0;
        drag.pieceUid = placed.pieceUid ?? placed.piece.uid;
        drag.liftedFromTray = false;
        hover = null;
        paint();
        return;
      }
    }

    // 打断惯性
    if (trayScrollPhase === 'gliding' || trayScrollPhase === 'bouncing') {
      trayScrollPhase = 'idle';
      trayScrollV = 0;
    }

    const idx = hitTrayIndex(fx, fy);
    const inBand = isInTrayBand(fx, fy);
    if ((idx < 0 || !tray[idx]) && !inBand) return;
    // 空白带也可横滑；无块则只 scroll
    if ((idx < 0 || !tray[idx]) && tray.length === 0 && !inBand) return;

    e.preventDefault();
    stage.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    const hasPiece = idx >= 0 && !!tray[idx];
    trayPointer = {
      pointerId: e.pointerId,
      startFx: fx,
      startFy: fy,
      startScrollX: trayScrollX,
      trayIndex: hasPiece ? idx : -1,
      pieceUid: hasPiece ? tray[idx].uid : null,
      t0: now,
      mode: hasPiece ? 'armed' : 'scroll',
      longPressFired: false,
      lastFx: fx,
      lastFy: fy,
      lastT: now,
    };
    if (!hasPiece) trayScrollPhase = 'dragging';
    hover = null;
    paint();
  }

  function onPointerMove(e) {
    e.preventDefault();
    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    const now = performance.now();

    if (trayPointer && e.pointerId === trayPointer.pointerId && !drag) {
      const dx = fx - trayPointer.startFx;
      const dy = fy - trayPointer.startFy;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const dist = Math.hypot(dx, dy);

      // 长按拿起（静止够久）
      if (
        trayPointer.mode === 'armed' &&
        trayPointer.pieceUid != null &&
        !trayPointer.longPressFired &&
        dist < tapSlop() &&
        now - trayPointer.t0 >= TRAY_LONG_PRESS_MS
      ) {
        trayPointer.longPressFired = true;
        const idx = tray.findIndex((p) => p.uid === trayPointer.pieceUid);
        if (idx >= 0) liftPieceFromTray(idx, e.pointerId, fx, fy);
        return;
      }

      if (trayPointer.mode === 'armed') {
        // 斜上/上滑拿起：放宽横向占比，方便左右边缘块拖上棋盘
        if (
          trayPointer.pieceUid != null &&
          dy < -liftSwipeUp() &&
          absDy >= absDx * 0.65
        ) {
          const idx = tray.findIndex((p) => p.uid === trayPointer.pieceUid);
          if (idx >= 0) liftPieceFromTray(idx, e.pointerId, fx, fy);
          return;
        }
        // 明确朝棋盘移动：保持 armed（等长按/继续上滑），绝不切横滑
        if (trayPointer.pieceUid != null && isArmedMovingTowardBoard(dy)) {
          trayPointer.lastFx = fx;
          trayPointer.lastFy = fy;
          trayPointer.lastT = now;
          return;
        }
        // 横滑：更严的纯横 + 更大 slop（空白带仍可直接 scroll 模式）
        if (
          absDx > scrollSlop() &&
          absDx >= absDy * scrollAxis() &&
          !isArmedMovingTowardBoard(dy)
        ) {
          trayPointer.mode = 'scroll';
          trayScrollPhase = 'dragging';
        } else {
          trayPointer.lastFx = fx;
          trayPointer.lastFy = fy;
          trayPointer.lastT = now;
          return;
        }
      }

      if (trayPointer.mode === 'scroll') {
        const raw = trayPointer.startScrollX - dx;
        applyScrollDrag(raw);
        const dtMs = Math.max(1, now - trayPointer.lastT);
        // 指右移 → 内容右移 → scroll 减小；速度用 px/s
        const fingerDx = fx - trayPointer.lastFx;
        trayScrollV = -(fingerDx / dtMs) * 1000;
        if (!Number.isFinite(trayScrollV)) trayScrollV = 0;
        const maxV = TRAY_FLING_MAX_V;
        trayScrollV = Math.max(-maxV, Math.min(maxV, trayScrollV));
        trayPointer.lastFx = fx;
        trayPointer.lastFy = fy;
        trayPointer.lastT = now;
        paint();
        return;
      }
    }

    if (!drag || e.pointerId !== drag.pointerId) return;
    updateDragFromPointer(fx, fy);
  }

  function onPointerUp(e) {
    // tray 预备态结束：点转 or 惯性/回弹
    if (trayPointer && e.pointerId === trayPointer.pointerId && !drag) {
      e.preventDefault();
      try {
        stage.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      const active = trayPointer;
      trayPointer = null;
      const upPoint = framePointFromClient(e.clientX, e.clientY);
      const tapMove = Math.hypot(upPoint.x - active.startFx, upPoint.y - active.startFy);

      if (active.mode === 'scroll') {
        const lim = scrollLimits();
        let v = trayScrollV;
        if (!Number.isFinite(v)) v = 0;
        // px/s
        v = Math.max(-TRAY_FLING_MAX_V, Math.min(TRAY_FLING_MAX_V, v));
        trayScrollV = v;
        if (!Number.isFinite(trayScrollX)) trayScrollX = 0;
        // 松手时逻辑位置先钳在有限 overscroll
        const b = logicScrollBounds();
        trayScrollX = Math.min(b.max, Math.max(b.min, trayScrollX));
        if (trayScrollX < lim.min || trayScrollX > lim.max) {
          trayScrollPhase = 'bouncing';
          // 给足回弹初速：快收回 + 自然过冲
          const toward =
            trayScrollX < lim.min ? 1 : trayScrollX > lim.max ? -1 : 0;
          const inwardBoost = toward * Math.min(1400, Math.abs(v) * 0.45 + 520);
          if (toward !== 0) {
            if (v * toward < 0) trayScrollV = inwardBoost;
            else trayScrollV = v * 0.7 + toward * 260;
          } else {
            trayScrollV = v * 0.55;
          }
        } else if (Math.abs(v) > 80) {
          trayScrollPhase = 'gliding';
        } else {
          trayScrollPhase = 'idle';
          trayScrollV = 0;
          trayScrollX = clampTrayScrollHard(trayScrollX);
        }
        trayScrollLastT = performance.now();
        paint();
        updateStatus();
        return;
      }

      // armed 抬起 → 旋转 + 瞬态震动（量级同影格）
      if (active.pieceUid != null && tapMove < tapSlop()) {
        const idx = tray.findIndex((p) => p.uid === active.pieceUid);
        if (idx >= 0 && tray[idx]) {
          const uid = active.pieceUid;
          tray[idx] = rotatePieceCW(tray[idx]);
          tray[idx].uid = uid;
          ghostHaptics.onRotate?.();
        }
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
    const upPoint = framePointFromClient(e.clientX, e.clientY);
    if (active) {
      samplePointer(active, upPoint.x, upPoint.y, layout, getTune);
      hover = ghostPolicy.resolve(
        active,
        active.frameX,
        active.frameY,
        active.piece.matrix,
      );
    }
    const h = hover;
    drag = null;

    // 回 tray：手指在候选区松手
    if (
      (active.liftedFromTray || active.returningFromBoard) &&
      isInTrayBand(upPoint.x, upPoint.y) &&
      !h?.valid
    ) {
      if (active.liftedFromTray) {
        // 未落盘取消：原洞填回 + scroll 还原
        restoreLiftedTrayPiece(active);
      } else {
        insertPieceIntoTray(active.piece, upPoint.x, homeIndexForDrag(active));
      }
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
      const home = homeIndexForDrag(active);
      // tray 拖起时原槽已是 null；落盘成功后压实
      if (active.liftedFromTray) {
        compactTrayAfterPlace();
      }
      placedPieces.push({
        id: nextPlacedId++,
        piece: active.piece,
        pieceUid: active.pieceUid ?? active.piece.uid,
        trayIndex: home ?? active.trayIndex ?? 0,
        homeTrayIndex: home ?? active.trayIndex ?? 0,
        originRow: h.originRow,
        originCol: h.originCol,
        cells: placedCells,
      });

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
        const clearOrigin = placedCells.length
          ? {
              row: placedCells.reduce((sum, cell) => sum + cell.row, 0) / placedCells.length,
              col: placedCells.reduce((sum, cell) => sum + cell.col, 0) / placedCells.length,
            }
          : { row: h.originRow, col: h.originCol };
        const lines = {
          rows: Array.from({ length: GRID }, (_, i) => i),
          cols: [],
          count: GRID,
        };
        const collected = collectAllBoardCells(clearOrigin);
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
      } else if (active.liftedFromTray) {
        // 非法落点：填回原洞 + 还原 scroll
        restoreLiftedTrayPiece(active);
      }
      placeSnap = null;
      lockInput(FEEL_REJECT_MS);
    }

    hover = null;
    paint();
    updateStatus();
  }

  function onPointerCancel(e) {
    if (trayPointer && e.pointerId === trayPointer.pointerId) {
      trayPointer = null;
      trayScrollPhase = 'idle';
      trayScrollV = 0;
      trayScrollX = clampTrayScrollHard(trayScrollX);
      paint();
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const active = drag;
    drag = null;
    hover = null;
    if (active.liftedFromTray && active.piece) {
      restoreLiftedTrayPiece(active);
    } else if (active.returningFromBoard && active.originalPlaced) {
      grid.place(
        active.originalPlaced.piece.matrix,
        active.originalPlaced.originRow,
        active.originalPlaced.originCol,
        active.originalPlaced.piece.cellColors || active.originalPlaced.piece.color,
      );
      placedPieces.push(active.originalPlaced);
    }
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
    refreshTraySlots();
    trayScrollX = clampTrayScrollHard(trayScrollX);
    boardView.rebuild(layout);
    drag = null;
    hover = null;
    trayPointer = null;
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
    tray = [];
    refreshTraySlots();
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
    const nowMs = performance.now();
    // 静止长按：无 move 时也要触发
    if (
      trayPointer &&
      !drag &&
      trayPointer.mode === 'armed' &&
      !trayPointer.longPressFired &&
      nowMs - trayPointer.t0 >= TRAY_LONG_PRESS_MS
    ) {
      const still =
        Math.hypot(
          (trayPointer.lastFx ?? trayPointer.startFx) - trayPointer.startFx,
          (trayPointer.lastFy ?? trayPointer.startFy) - trayPointer.startFy,
        ) < tapSlop();
      if (still) {
        trayPointer.longPressFired = true;
        const idx = tray.findIndex((p) => p.uid === trayPointer.pieceUid);
        if (idx >= 0) {
          liftPieceFromTray(
            idx,
            trayPointer.pointerId,
            trayPointer.lastFx,
            trayPointer.lastFy,
          );
        }
      }
    }
    if (deathFx) {
      tickDeathFx();
    } else {
      if (trayScrollPhase === 'gliding' || trayScrollPhase === 'bouncing') {
        tickTrayScroll(nowMs);
      }
      if (trayFlip.size > 0 && !drag) paint();
      // 消行 / 拖拽 / 落位吸附可并行
      if (drag) tickDragFrame();
      if (placeSnap) tickPlaceSnap();
      if (clearFx) tickClearFx();
      else if (boardRevealFx && !drag && !placeSnap) tickBoardRevealFx();
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
