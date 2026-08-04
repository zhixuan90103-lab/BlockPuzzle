/**
 * 发块入口（薄封装）— 实现见 pipeline.js / rhythm.js
 *
 * 新节奏：人控难度(instant) + 贴空/整齐形状
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
