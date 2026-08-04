/**
 * 新节奏发块（核心采样）
 *
 * 主轴：
 *  1) 难度 → 目标 instant（3 / 2 / 1）
 *  2) 形状 → 贴合空格 + 摆后更整齐
 *
 * 不做阶段加压、payoff/助清意图链；只做读盘 + 难度窗。
 */
import { TRAY_SIZE } from '../defaults.js';
import {
  FORM_1X1,
  FORM_FAMILIES,
  countCells,
  makePiece,
  matrixKey,
} from '../forms.js';
import {
  canPlaceOnCells,
  countInstantFits,
  findAnyPlacement,
  simulatePlace,
} from './board-ops.js';
import { boardMessScore, trayMessDelta } from './board-neat.js';
import { scoreCavityPlacement } from './cavity-match.js';
import { bestFitForMatrix, traySnugScore } from './fit-score.js';
import { shapeClassOf } from './shape-class.js';

/** @typedef {import('../forms.js').FormDef} FormDef */
/** @typedef {import('../forms.js').PieceDef} PieceDef */

/**
 * 全部常规 form（禁微块 ≤2 格）
 * @returns {FormDef[]}
 */
export function allPlayableForms() {
  /** @type {FormDef[]} */
  const out = [];
  for (const fam of FORM_FAMILIES) {
    for (const f of fam) {
      if (countCells(f.matrix) <= 2) continue;
      out.push(f);
    }
  }
  return out;
}

/**
 * 单 form 在当前盘的读盘分（贴空 + 整齐）
 * @param {(number|null)[][]} board
 * @param {FormDef} form
 * @returns {{
 *   form: FormDef,
 *   fits: boolean,
 *   score: number,
 *   fitScore: number,
 *   cavity: number,
 *   neatDelta: number,
 *   r: number,
 *   c: number,
 * } | null}
 */
export function scoreFormAgainstBoard(board, form) {
  const best = bestFitForMatrix(board, form.matrix, 36);
  if (!best) {
    return {
      form,
      fits: false,
      score: -1,
      fitScore: -Infinity,
      cavity: 0,
      neatDelta: 0,
      r: -1,
      c: -1,
    };
  }
  const cavity = scoreCavityPlacement(board, form.matrix, best.r, best.c);
  const cav = Number.isFinite(cavity) ? cavity : 0;
  const mess0 = boardMessScore(board);
  const next = simulatePlace(board, form.matrix, best.r, best.c);
  const mess1 = boardMessScore(next);
  const neatDelta = mess0 - mess1; // 正 = 更整齐
  // 贴合 + 空腔 + 整齐（整齐权重大于单纯面积）
  const score =
    best.score * 1.0 +
    Math.max(0, cav) * 0.55 +
    neatDelta * 9.5 +
    (best.lines > 0 ? best.lines * 6 : 0);
  return {
    form,
    fits: true,
    score,
    fitScore: best.score,
    cavity: cav,
    neatDelta,
    r: best.r,
    c: best.c,
  };
}

/**
 * @param {(number|null)[][]} board
 * @param {FormDef[]} forms
 */
export function catalogBoardForms(board, forms = allPlayableForms()) {
  /** @type {NonNullable<ReturnType<typeof scoreFormAgainstBoard>>[]} */
  const rows = [];
  for (const f of forms) {
    const row = scoreFormAgainstBoard(board, f);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * 整 tray 读盘分：依次最佳落点，看贴合与整齐
 * @param {(number|null)[][]} board
 * @param {PieceDef[]} pieces
 */
export function scoreTrayRhythm(board, pieces) {
  let sim = board.map((r) => r.slice());
  let fitSum = 0;
  let cavSum = 0;
  let neatSum = 0;
  let placed = 0;
  const messStart = boardMessScore(board);

  for (const p of pieces) {
    const best = bestFitForMatrix(sim, p.matrix, 28);
    if (!best) continue;
    const cavity = scoreCavityPlacement(sim, p.matrix, best.r, best.c);
    fitSum += best.score;
    cavSum += Number.isFinite(cavity) ? Math.max(0, cavity) : 0;
    const before = boardMessScore(sim);
    sim = simulatePlace(sim, p.matrix, best.r, best.c);
    neatSum += before - boardMessScore(sim);
    placed += 1;
  }

  const messEnd = boardMessScore(sim);
  const messDrop = messStart - messEnd;
  const snug = traySnugScore(board, pieces);
  const dMessGreedy = trayMessDelta(board, pieces);

  // 形状多元
  const classes = new Set(pieces.map((p) => shapeClassOf(p)));
  const diversity = classes.size;

  let score =
    fitSum * 0.9 +
    cavSum * 0.45 +
    neatSum * 8.5 +
    messDrop * 6 +
    snug * 0.7 +
    diversity * 4.5 -
    Math.max(0, dMessGreedy) * 3.2;

  // 惩罚全同类 / 过碎
  if (diversity <= 1) score -= 8;
  if (pieces.every((p) => countCells(p.matrix) <= 3)) score -= 5;
  if (placed < pieces.length) score -= (pieces.length - placed) * 4;

  return {
    score,
    fitSum,
    cavSum,
    neatSum,
    messDrop,
    diversity,
    placed,
  };
}

/**
 * 加权随机抽一条 catalog 行
 * @template {{ score: number }} T
 * @param {T[]} rows
 * @param {() => number} rng
 * @param {number} [temp]
 */
function pickWeightedRow(rows, rng, temp = 6) {
  if (!rows.length) return null;
  let total = 0;
  const weights = rows.map((r) => {
    const w = Math.exp(Math.min(12, Math.max(-4, r.score) / temp));
    total += w;
    return w;
  });
  if (total <= 0) return rows[Math.floor(rng() * rows.length)];
  let x = rng() * total;
  for (let i = 0; i < rows.length; i++) {
    x -= weights[i];
    if (x <= 0) return rows[i];
  }
  return rows[rows.length - 1];
}

/**
 * 从池中抽 n 个不重复 form
 * @param {NonNullable<ReturnType<typeof scoreFormAgainstBoard>>[]} pool
 * @param {number} n
 * @param {() => number} rng
 * @param {Set<string>} [avoidKeys]
 */
function pickDistinct(pool, n, rng, avoidKeys = new Set()) {
  /** @type {NonNullable<ReturnType<typeof scoreFormAgainstBoard>>[]} */
  const picked = [];
  const used = new Set(avoidKeys);
  const bag = pool.slice().sort((a, b) => b.score - a.score);
  // 前半偏优 + 随机
  for (let guard = 0; guard < 80 && picked.length < n; guard++) {
    const slice = bag.filter((r) => !used.has(matrixKey(r.form.matrix)));
    if (!slice.length) break;
    const top = slice.slice(0, Math.max(4, Math.ceil(slice.length * 0.45)));
    const row = pickWeightedRow(top, rng) || top[0];
    const key = matrixKey(row.form.matrix);
    used.add(key);
    picked.push(row);
  }
  return picked;
}

/**
 * 构造一盘候选（尽量命中 targetInstant）
 * @param {(number|null)[][]} board
 * @param {number} targetInstant
 * @param {NonNullable<ReturnType<typeof scoreFormAgainstBoard>>[]} catalog
 * @param {() => number} rng
 * @returns {FormDef[] | null}
 */
function buildCombo(board, targetInstant, catalog, rng) {
  const now = catalog.filter((r) => r.fits).sort((a, b) => b.score - a.score);
  const later = catalog.filter((r) => !r.fits);
  // later 无分：给一个弱随机权重（偏好中等格数）
  for (const r of later) {
    const cells = countCells(r.form.matrix);
    r.score = 2 + Math.min(cells, 6) * 0.4 + rng() * 2;
  }

  /** @type {FormDef[]} */
  let forms = [];

  if (targetInstant >= 3) {
    if (now.length < 3) return null;
    forms = pickDistinct(now, 3, rng).map((r) => r.form);
  } else if (targetInstant === 2) {
    if (now.length < 2) return null;
    const a = pickDistinct(now, 2, rng);
    let b;
    if (later.length) {
      b = pickDistinct(later, 1, rng);
    } else {
      // 开阔盘几乎都可放：从 now 里挑「贴合最差」的充当「更难塞」的第三块
      const weak = now.slice().sort((x, y) => x.score - y.score);
      b = pickDistinct(weak.slice(0, Math.max(3, Math.ceil(weak.length * 0.35))), 1, rng);
    }
    if (a.length < 2 || !b.length) return null;
    forms = [...a, ...b].map((r) => r.form);
  } else {
    // hard: 1 now + 2 later
    if (now.length < 1) return null;
    const a = pickDistinct(now, 1, rng);
    let b;
    if (later.length >= 2) {
      b = pickDistinct(later, 2, rng);
    } else if (later.length === 1) {
      const weak = now
        .filter((r) => matrixKey(r.form.matrix) !== matrixKey(a[0].form.matrix))
        .sort((x, y) => x.score - y.score);
      b = [...pickDistinct(later, 1, rng), ...pickDistinct(weak, 1, rng)];
    } else {
      const weak = now
        .filter((r) => matrixKey(r.form.matrix) !== matrixKey(a[0].form.matrix))
        .sort((x, y) => x.score - y.score);
      b = pickDistinct(weak, 2, rng);
    }
    if (!a.length || b.length < 2) return null;
    forms = [...a, ...b].map((r) => r.form);
  }

  // 打乱槽位，避免可放块永远在固定位置
  for (let i = forms.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = forms[i];
    forms[i] = forms[j];
    forms[j] = t;
  }
  return forms;
}

/**
 * 主采样：难度 instant + 贴空/整齐
 * @param {(number|null)[][]} board
 * @param {{
 *   targetInstant: number,
 *   attempts?: number,
 *   rng?: () => number,
 *   avoidSig?: string,
 *   signatureOf?: (pieces: PieceDef[]) => string,
 * }} opts
 * @returns {{
 *   pieces: PieceDef[],
 *   instant: number,
 *   targetInstant: number,
 *   soft: boolean,
 *   score: number,
 *   mode: string,
 * } | null}
 */
export function sampleRhythmTray(board, opts) {
  const targetInstant = Math.max(1, Math.min(3, Math.round(opts.targetInstant) || 3));
  const attempts = opts.attempts ?? 48;
  const rng = opts.rng || Math.random;
  const catalog = catalogBoardForms(board);
  const nowCount = catalog.filter((r) => r.fits).length;

  if (nowCount < 1) {
    return null;
  }

  /** @type {{ pieces: PieceDef[], instant: number, score: number, soft: boolean }[]} */
  const pool = [];

  for (let i = 0; i < attempts; i++) {
    // 前几轮严格目标；后半允许 soft（最接近目标）
    const strict = i < attempts * 0.72;
    const forms = buildCombo(board, targetInstant, catalog, rng);
    if (!forms || forms.length < TRAY_SIZE) continue;

    const pieces = forms.slice(0, TRAY_SIZE).map((f) => makePiece(f));
    // 禁微块
    if (pieces.some((p) => countCells(p.matrix) <= 2)) continue;

    const instant = countInstantFits(board, pieces);
    if (instant < 1) continue;
    if (strict && instant !== targetInstant) continue;
    // soft：允许偏差 1，且不要全 0
    if (!strict && Math.abs(instant - targetInstant) > 1) continue;

    if (opts.avoidSig && opts.signatureOf && opts.signatureOf(pieces) === opts.avoidSig) {
      continue;
    }

    // 形状别三件完全同 matrix
    const keys = new Set(pieces.map((p) => matrixKey(p.matrix)));
    if (keys.size < 2) continue;

    const rhythm = scoreTrayRhythm(board, pieces);
    // 严格命中加分
    let score = rhythm.score;
    if (instant === targetInstant) score += 14;
    else score -= Math.abs(instant - targetInstant) * 7;

    pool.push({
      pieces,
      instant,
      score,
      soft: instant !== targetInstant,
    });
    if (pool.length >= 16) break;
  }

  // 严格池优先
  const exact = pool.filter((p) => !p.soft);
  const use = exact.length ? exact : pool;
  if (!use.length) {
    return softFillTray(board, targetInstant, catalog, rng, opts);
  }

  use.sort((a, b) => b.score - a.score);
  const top = use.slice(0, Math.min(4, use.length));
  const pick = top[Math.floor(rng() * top.length)];
  return {
    pieces: pick.pieces,
    instant: pick.instant,
    targetInstant,
    soft: pick.soft,
    score: pick.score,
    mode: pick.soft ? 'rhythm-soft' : 'rhythm',
  };
}

/**
 * 严格采样失败时的补齐：尽量靠近目标 instant，形状仍读盘
 */
function softFillTray(board, targetInstant, catalog, rng, opts) {
  const now = catalog.filter((r) => r.fits).sort((a, b) => b.score - a.score);
  if (!now.length) return null;

  /** @type {PieceDef[] | null} */
  let bestPieces = null;
  let bestScore = -Infinity;
  let bestInstant = 0;

  for (let t = 0; t < 24; t++) {
    const n = Math.min(TRAY_SIZE, now.length);
    const picked = pickDistinct(now, n, rng);
    while (picked.length < TRAY_SIZE) {
      // 用 later 或弱 now
      const later = catalog.filter((r) => !r.fits);
      if (later.length) {
        const x = later[Math.floor(rng() * later.length)];
        if (!picked.some((p) => matrixKey(p.form.matrix) === matrixKey(x.form.matrix))) {
          picked.push(x);
          continue;
        }
      }
      const w = now[Math.floor(rng() * now.length)];
      if (!picked.some((p) => matrixKey(p.form.matrix) === matrixKey(w.form.matrix))) {
        picked.push(w);
      } else break;
    }
    const pieces = picked.slice(0, TRAY_SIZE).map((r) => makePiece(r.form));
    if (pieces.some((p) => countCells(p.matrix) <= 2)) continue;
    const instant = countInstantFits(board, pieces);
    if (instant < 1) continue;
    if (opts.avoidSig && opts.signatureOf && opts.signatureOf(pieces) === opts.avoidSig) {
      continue;
    }
    const rhythm = scoreTrayRhythm(board, pieces);
    const score = rhythm.score - Math.abs(instant - targetInstant) * 9;
    if (score > bestScore) {
      bestScore = score;
      bestPieces = pieces;
      bestInstant = instant;
    }
  }

  if (!bestPieces) {
    // 最后：当前盘 top 贴合块 + 保证可放
    const pieces = [];
    const used = new Set();
    for (const row of now) {
      if (pieces.length >= TRAY_SIZE) break;
      const k = matrixKey(row.form.matrix);
      if (used.has(k)) continue;
      used.add(k);
      pieces.push(makePiece(row.form));
    }
    while (pieces.length < TRAY_SIZE) {
      const pos = findAnyPlacement(board, FORM_1X1.matrix);
      if (!pos) break;
      pieces.push(makePiece(FORM_1X1));
    }
    if (pieces.length < TRAY_SIZE) return null;
    bestPieces = pieces;
    bestInstant = countInstantFits(board, pieces);
    bestScore = scoreTrayRhythm(board, pieces).score;
  }

  return {
    pieces: bestPieces,
    instant: bestInstant,
    targetInstant,
    soft: bestInstant !== targetInstant,
    score: bestScore,
    mode: 'rhythm-fill',
  };
}

/**
 * 兜底：至少 1 块可放，尽量 3 块可放
 * @param {(number|null)[][]} board
 * @param {() => number} [rng]
 */
export function fallbackRhythmTray(board, rng = Math.random) {
  const catalog = catalogBoardForms(board);
  const now = catalog.filter((r) => r.fits).sort((a, b) => b.score - a.score);
  /** @type {PieceDef[]} */
  const pieces = [];
  const used = new Set();
  for (const row of now) {
    if (pieces.length >= TRAY_SIZE) break;
    const k = matrixKey(row.form.matrix);
    if (used.has(k)) continue;
    used.add(k);
    pieces.push(makePiece(row.form));
  }
  while (pieces.length < TRAY_SIZE) {
    if (canPlaceOnCells(board, FORM_1X1.matrix)) {
      pieces.push(makePiece(FORM_1X1));
    } else {
      // 盘上连 1×1 都不能放：仍给块（game over 检测另走）
      pieces.push(makePiece(FORM_1X1));
    }
  }
  return {
    pieces,
    instant: countInstantFits(board, pieces),
    targetInstant: pieces.length,
    soft: true,
    score: 0,
    mode: 'fallback',
  };
}
