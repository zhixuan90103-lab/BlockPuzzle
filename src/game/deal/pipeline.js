/**
 * 发块管线（新节奏）
 *
 *  难度（设置三档）→ targetInstant 3|2|1
 *  形状 → 贴合空格 + 摆后整齐（rhythm 采样）
 *
 * 下一盘 tray 生效；无阶段加压链 / 无助清剧本。
 */
import { DEAL_MAX_ATTEMPTS, FIT_GUARANTEE, TRAY_SIZE } from '../defaults.js';
import { getActiveTraySize, isDealTrueRandom } from '../debug-exp.js';
import { makePiece, pickWeightedForm } from '../forms.js';
import { getTune } from '../tune.js';
import { canPlaceOnCells, countInstantFits, fillRatio } from './board-ops.js';
import { classifyBoardState } from './board-state.js';
import {
  DEAL_DIFFICULTY_META,
  getDealDifficulty,
  instantRangeForDifficulty,
} from './difficulty.js';
import { basePhaseFromScore, rollDealPhase } from './phase.js';
import {
  fallbackRhythmTray,
  sampleRhythmTray,
} from './rhythm.js';
import { sampleWeightedTray } from './sample.js';
import { dealSession, resetDealSession, sessionOnEmit } from './session.js';

/** @typedef {import('./phase.js').DealPhase} DealPhase */
/** @typedef {import('./difficulty.js').DealDifficulty} DealDifficulty */

export let lastDealMeta = {
  fill: 0,
  score: 0,
  basePhase: /** @type {DealPhase} */ ('early'),
  phase: /** @type {DealPhase} */ ('early'),
  /** @type {DealDifficulty} */
  difficulty: 'easy',
  targetInstant: 3,
  instant: 0,
  soft: false,
  rhythmScore: 0,
  attempts: 0,
  mode: 'init',
  clearPlanLen: /** @type {number|null} */ (null),
  traysSinceAssist: 0,
  assistStreakLeft: 0,
  clearOfferPending: false,
  clearOfferRounds: 0,
  boardClass: /** @type {string} */ ('empty'),
  setupScore: 0,
  fragScore: 0,
  maxEmpty: 0,
  orderGuarantee: false,
};

export function resetDealState() {
  resetDealSession();
}

/** @deprecated */
export function clearPendingDealPlan() {
  resetDealState();
}

function signature(pieces) {
  return pieces
    .map((p) => p.matrix.map((row) => row.join('')).join('/'))
    .sort()
    .join('|');
}

/**
 * @param {(number|null)[][]} board
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {string} mode
 * @param {{ soft?: boolean, rhythmScore?: number, targetInstant?: number }} [extra]
 */
function emit(board, pieces, mode, extra = {}) {
  const n = getActiveTraySize();
  const tray = pieces.slice(0, n);
  dealSession.lastTraySig = signature(tray);
  const instant = countInstantFits(board, tray);

  // 会话：仅记签名；助清相关字段保持兼容但不再驱动逻辑
  sessionOnEmit(mode, false, 0);

  lastDealMeta.instant = instant;
  lastDealMeta.mode = mode;
  lastDealMeta.soft = !!extra.soft;
  lastDealMeta.rhythmScore = extra.rhythmScore ?? 0;
  lastDealMeta.targetInstant =
    extra.targetInstant ?? lastDealMeta.targetInstant ?? instant;
  lastDealMeta.attempts = (lastDealMeta.attempts || 0) + 1;
  lastDealMeta.clearPlanLen = null;
  lastDealMeta.traysSinceAssist = dealSession.traysSinceAssist;
  lastDealMeta.assistStreakLeft = dealSession.assistStreakLeft;
  lastDealMeta.clearOfferPending = dealSession.clearOfferPending;
  lastDealMeta.clearOfferRounds = dealSession.clearOfferRounds;
  lastDealMeta.orderGuarantee = false;
  lastDealMeta.difficulty = getDealDifficulty();

  return tray;
}

/**
 * @param {{ snapshot: () => (number|null)[][] }} grid
 * @param {{ maxAttempts?: number, rng?: () => number, score?: number }} [opts]
 */
export function generateTray(grid, opts = {}) {
  const t = getTune();
  const maxAttempts =
    opts.maxAttempts ?? t.DEAL_MAX_ATTEMPTS ?? DEAL_MAX_ATTEMPTS;
  const board = grid.snapshot();
  const fill = fillRatio(board);
  const score = Number.isFinite(opts.score) ? Math.max(0, Number(opts.score)) : 0;
  const basePhase = basePhaseFromScore(score, t);
  const boardState = classifyBoardState(board);
  const trayN = getActiveTraySize();
  const trueRandom = isDealTrueRandom();
  const difficulty = getDealDifficulty();
  const { min: targetInstant } = instantRangeForDifficulty(difficulty);

  lastDealMeta = {
    fill,
    score,
    basePhase,
    phase: basePhase,
    difficulty,
    targetInstant,
    instant: 0,
    soft: false,
    rhythmScore: 0,
    attempts: 0,
    mode: 'init',
    clearPlanLen: null,
    traysSinceAssist: dealSession.traysSinceAssist,
    assistStreakLeft: dealSession.assistStreakLeft,
    clearOfferPending: dealSession.clearOfferPending,
    clearOfferRounds: dealSession.clearOfferRounds,
    boardClass: boardState.class,
    setupScore: boardState.setupScore,
    fragScore: boardState.fragScore,
    maxEmpty: boardState.maxEmpty,
    orderGuarantee: false,
  };

  const rng = opts.rng || Math.random;

  // —— 实验短路：真随机 / 单块 tray ——
  if (trueRandom || trayN === 1) {
    const pieces = [];
    for (let i = 0; i < trayN; i++) {
      pieces.push(makePiece(pickWeightedForm(rng)));
    }
    const mode = trueRandom
      ? trayN === 1
        ? 'debug-e2e3-random1'
        : 'debug-e3-random'
      : 'debug-e2-tray1';
    if (!trueRandom && trayN === 1) {
      let form = null;
      for (let a = 0; a < 80; a++) {
        const f = pickWeightedForm(rng);
        if (canPlaceOnCells(board, f.matrix)) {
          form = f;
          break;
        }
      }
      pieces[0] = makePiece(form || pickWeightedForm(rng));
    }
    return emit(board, pieces, mode, { targetInstant, soft: true });
  }

  if (!FIT_GUARANTEE) {
    const tray = sampleWeightedTray(rng);
    return emit(board, tray, 'simple', { targetInstant, soft: true });
  }

  // 记录 roll 后的 phase 仅作 meta（不再驱动 instant）
  lastDealMeta.phase = rollDealPhase(basePhase, rng, t);

  const attempts = Math.min(maxAttempts, Math.max(36, Math.floor(maxAttempts * 0.4)));
  const result = sampleRhythmTray(board, {
    targetInstant,
    attempts,
    rng,
    avoidSig: dealSession.lastTraySig,
    signatureOf: signature,
  });

  if (result?.pieces?.length) {
    // tray 尺寸不是 3 时裁剪/补齐
    let pieces = result.pieces.slice(0, trayN);
    while (pieces.length < trayN) {
      pieces.push(makePiece(pickWeightedForm(rng)));
    }
    return emit(board, pieces, result.mode, {
      soft: result.soft,
      rhythmScore: result.score,
      targetInstant: result.targetInstant,
    });
  }

  const fb = fallbackRhythmTray(board, rng);
  return emit(board, fb.pieces.slice(0, trayN), fb.mode, {
    soft: true,
    rhythmScore: 0,
    targetInstant,
  });
}

export function anyTrayPieceFits(grid, tray) {
  for (const p of tray) {
    if (p && grid.canPlaceAnywhere(p.matrix)) return true;
  }
  if (tray.every((p) => p == null)) return true;
  return false;
}

export { existsPlacementOrder, countInstantFits } from './board-ops.js';
export {
  basePhaseFromFill,
  basePhaseFromScore,
  rollDealPhase,
  familyMulForPhase,
} from './phase.js';
export { classifyBoardState } from './board-state.js';

// 便于调试展示
export { DEAL_DIFFICULTY_META };
