export function createScoreState() {
  let score = 0;

  function reset() {
    score = 0;
  }

  /**
   * @param {{ cellsPlaced: number, linesCleared: number, boardEmpty: boolean }} e
   */
  function onPlace(e) {
    if (e.linesCleared > 0 && e.boardEmpty) score += 1;
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
