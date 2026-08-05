import { SCORE_ALL_CLEAR, SCORE_PER_CELL } from './defaults.js';

export function createScoreState() {
  let score = 0;

  function reset() {
    score = 0;
  }

  /**
   * @param {{
   *   cellsPlaced: number,
   *   placementScored?: boolean,
   *   puzzleComplete?: boolean,
   * }} e
   */
  function onPlace(e) {
    if (e.placementScored) {
      score += Math.max(0, e.cellsPlaced | 0) * SCORE_PER_CELL;
    }
    if (e.puzzleComplete) {
      score += SCORE_ALL_CLEAR;
    }
  }

  /** tray 用尽刷新时调用（tray 模式） */
  function onTrayRefill() {}

  return {
    reset,
    onPlace,
    onTrayRefill,
    get score() {
      return score;
    },
    get combo() {
      return 0;
    },
  };
}
