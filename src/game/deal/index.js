/**
 * 发块子系统公开 API（新节奏）
 *
 * difficulty — 人控简单/中等/困难（instant 3/2/1）
 * rhythm     — 贴空 + 整齐采样
 * pipeline   — generateTray
 */
export {
  anyTrayPieceFits,
  basePhaseFromFill,
  basePhaseFromScore,
  classifyBoardState,
  clearPendingDealPlan,
  countInstantFits,
  existsPlacementOrder,
  familyMulForPhase,
  generateTray,
  lastDealMeta,
  resetDealState,
  rollDealPhase,
} from './pipeline.js';

export {
  DEAL_DIFFICULTIES,
  DEAL_DIFFICULTY_META,
  getDealDifficulty,
  instantRangeForDifficulty,
  isDealDifficulty,
  onDealDifficultyChange,
  setDealDifficulty,
} from './difficulty.js';

export {
  allPlayableForms,
  catalogBoardForms,
  fallbackRhythmTray,
  sampleRhythmTray,
  scoreFormAgainstBoard,
  scoreTrayRhythm,
} from './rhythm.js';

export { getDealPolicy } from './policy.js';
export { boardHasPayoffSetup, rankPayoffForms } from './payoff-match.js';
export {
  allowsFullClearSearch,
  allowsPayoffIntent,
  maxEmptyRect,
} from './board-state.js';
export { ROLE_FAMILIES, roleMixForPhase, roleOfFamily, rollRole } from './bag.js';
