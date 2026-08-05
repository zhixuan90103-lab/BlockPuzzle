/**
 * 棋盘 / tray 几何（参数来自 tune，默认对齐正版竖屏）。
 *
 * 摆放区高度滑条：只改区外框 h，不改棋盘尺寸、不改区中心位置。
 */
import {
  GRID,
  LAYOUT_TRAY_BAND_CELLS as DEFAULT_TRAY_BAND_CELLS,
  TRAY_VISIBLE_SLOTS,
} from './defaults.js';
import { getBoardTune } from './board-tune.js';
import { getHudTune } from './hud-tune.js';
import { getTune } from './tune.js';
import { buildTraySlots } from './tray-layout.js';

/**
 * @param {{ width: number, height: number }} frame
 * @param {{ top: number, right: number, bottom: number, left: number }} safe
 */
export function computeLayout(frame, safe) {
  const t = getTune();
  const bt = getBoardTune();
  const fw = frame.width;
  const fh = frame.height;
  if (fw < 2 || fh < 2) {
    return emptyLayout(fw, fh);
  }

  const ht = getHudTune();
  const hudBottomPx =
    Math.max(0, ht.HUD_PAD_TOP_PX) +
    Math.max(0, ht.HUD_OFFSET_Y_PX) +
    Math.max(8, ht.HUD_LABEL_FONT_PX) * 1.15 +
    Math.max(0, ht.HUD_GAP_PX) +
    Math.max(10, ht.HUD_VALUE_FONT_PX) * 1.05;
  const hudTopReserve = Math.max(fh * t.LAYOUT_HUD_SCORE_H, hudBottomPx + fh * 0.018);
  const marginX = Number.isFinite(bt.BOARD_MARGIN_X) ? bt.BOARD_MARGIN_X : t.LAYOUT_GRID_MARGIN_X;
  const padL = safe.left + fw * marginX;
  const padR = safe.right + fw * marginX;
  const padT = safe.top + hudTopReserve + fh * t.LAYOUT_GRID_TOP_GAP;
  const padB = safe.bottom + fh * t.LAYOUT_PAD_BOTTOM_EXTRA;

  const usableW = Math.max(1, fw - padL - padR);
  const usableH = Math.max(1, fh - padT - padB);

  const scale = t.FEEL_TRAY_SCALE;
  const gapCells = t.LAYOUT_GAP_GRID_TRAY_CELLS;
  /**
   * 棋盘占位只用「出厂」区高，与滑条解耦——
   * 否则调高度会连带缩放棋盘，整块布局上下跳。
   */
  const packBandCells = Math.max(0.8, DEFAULT_TRAY_BAND_CELLS);
  const trayStackCells = gapCells + packBandCells * scale;

  const maxByW = usableW;
  const maxByH = usableH / (1 + trayStackCells / GRID);
  const boardSideMax = Math.min(maxByW, maxByH);
  const boardScale = t.LAYOUT_BOARD_SCALE * (Number.isFinite(bt.BOARD_SCALE) ? bt.BOARD_SCALE : 1);
  const boardSide = boardSideMax * boardScale;
  const cell = boardSide / GRID;

  const gap = cell * gapCells;
  const trayCell = cell * scale;

  const gridX = padL + (usableW - boardSide) / 2;
  const gridY = padT + fh * (t.LAYOUT_BOARD_SHIFT_Y + (bt.BOARD_SHIFT_Y || 0));

  const trayX = padL;
  const trayW = usableW;
  // 一屏约 3.5 槽；实际 slots 随 tray 块数在 game 侧 refresh。
  const visibleTraySlots = TRAY_VISIBLE_SLOTS;
  const slotW = trayW / visibleTraySlots;
  /** 视觉/点击高度（滑条） */
  const bandCells = Math.max(0.8, t.LAYOUT_TRAY_BAND_CELLS);
  const zoneH = Math.max(trayCell * 1.2, trayCell * bandCells);
  const trayH = zoneH;

  /**
   * 锚点 = 盘底 + 间距 + 出厂半高 + 偏移。
   * 滑条改 zoneH 时绕该中心上下对称伸缩，块中心 (cx,cy) 不动。
   */
  const packBandH = trayCell * packBandCells;
  const trayAnchorCy =
    gridY + boardSide + gap + fh * t.LAYOUT_TRAY_SHIFT_Y + packBandH * 0.5;
  const trayY = trayAnchorCy - zoneH * 0.5;

  const boardCellInset = Number.isFinite(bt.BOARD_CELL_INSET)
    ? bt.BOARD_CELL_INSET
    : t.BOARD_CELL_INSET;
  const trayCellInset = t.TRAY_CELL_INSET;
  const cellFill = cell * (1 - 2 * boardCellInset);
  const cellGapPx = cell * 2 * boardCellInset;
  const trayCellFill = trayCell * (1 - 2 * trayCellInset);
  const trayCellGapPx = trayCell * 2 * trayCellInset;

  // 占位 slots（0 块）；game 按压缩列表长度 rebuild
  const traySlots = buildTraySlots(
    { x: trayX, w: trayW, y: trayY, h: trayH, cy: trayAnchorCy },
    0,
    slotW,
  );

  return {
    frameW: fw,
    frameH: fh,
    cell,
    cellFill,
    cellGapPx,
    boardCellInset,
    boardSide,
    grid: {
      x: gridX,
      y: gridY,
      w: boardSide,
      h: boardSide,
    },
    tray: {
      x: trayX,
      y: trayY,
      w: trayW,
      h: trayH,
      cell: trayCell,
      cellFill: trayCellFill,
      cellGapPx: trayCellGapPx,
      cellInset: trayCellInset,
      scale,
      visibleSlots: visibleTraySlots,
      slotW,
      cy: trayAnchorCy,
      slots: traySlots,
      gapAbove: gap,
    },
    cellRect(col, row) {
      return {
        x: gridX + col * cell,
        y: gridY + row * cell,
        w: cell,
        h: cell,
      };
    },
  };
}

function emptyLayout(fw, fh) {
  const t = getTune();
  return {
    frameW: fw,
    frameH: fh,
    cell: 1,
    cellFill: 1,
    cellGapPx: 0,
    boardCellInset: t.BOARD_CELL_INSET,
    boardSide: 0,
    grid: { x: 0, y: 0, w: 0, h: 0 },
    tray: {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      cell: 1,
      cellFill: 1,
      cellGapPx: 0,
      cellInset: t.TRAY_CELL_INSET,
      scale: t.FEEL_TRAY_SCALE,
      visibleSlots: TRAY_VISIBLE_SLOTS,
      slotW: 1,
      cy: 0,
      slots: [],
      gapAbove: 0,
    },
    cellRect() {
      return { x: 0, y: 0, w: 1, h: 1 };
    },
  };
}

export function frameToThree(x, y, frameW, frameH) {
  return {
    x: x - frameW / 2,
    y: frameH / 2 - y,
  };
}
