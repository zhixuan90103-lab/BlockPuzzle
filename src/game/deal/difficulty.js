/**
 * 推送难度（人控）：简单 / 中等 / 困难
 *
 * 定义（tray=3，当前盘 G2 instant）：
 *   easy   → instant = 3（三块当下均可放）
 *   medium → instant = 2（两块当下可放）
 *   hard   → instant = 1（一块当下可放）
 *
 * 局中可随时切换，下一盘 tray 生效。
 */

/** @typedef {'easy' | 'medium' | 'hard'} DealDifficulty */

const STORAGE_KEY = 'blockblast.dealDifficulty';

/** @type {DealDifficulty[]} */
export const DEAL_DIFFICULTIES = ['easy', 'medium', 'hard'];

/** @type {Record<DealDifficulty, { label: string, instant: number }>} */
export const DEAL_DIFFICULTY_META = {
  easy: { label: '简单', instant: 3 },
  medium: { label: '中等', instant: 2 },
  hard: { label: '困难', instant: 1 },
};

/** @type {DealDifficulty} */
let current = loadInitial();

/** @type {Set<(d: DealDifficulty) => void>} */
const listeners = new Set();

/** @returns {DealDifficulty} */
function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  } catch {
    /* ignore */
  }
  return 'easy';
}

/** @param {unknown} v @returns {v is DealDifficulty} */
export function isDealDifficulty(v) {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

/** @returns {DealDifficulty} */
export function getDealDifficulty() {
  return current;
}

/**
 * @param {DealDifficulty} d
 * @param {{ persist?: boolean, silent?: boolean }} [opts]
 */
export function setDealDifficulty(d, opts = {}) {
  if (!isDealDifficulty(d) || d === current) {
    if (isDealDifficulty(d) && d === current && !opts.silent) {
      // 仍刷新 UI 高亮
      for (const fn of listeners) fn(current);
    }
    return current;
  }
  current = d;
  if (opts.persist !== false) {
    try {
      localStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  }
  if (!opts.silent) {
    for (const fn of listeners) fn(current);
  }
  return current;
}

/**
 * 目标 instant 窗（min=max，严格三档）
 * @param {DealDifficulty} [d]
 * @returns {{ min: number, max: number }}
 */
export function instantRangeForDifficulty(d = current) {
  const n = DEAL_DIFFICULTY_META[d]?.instant ?? 3;
  return { min: n, max: n };
}

/**
 * @param {(d: DealDifficulty) => void} fn
 * @returns {() => void}
 */
export function onDealDifficultyChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
