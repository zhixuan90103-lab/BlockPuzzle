/**
 * 棋盘视觉/几何独立调参（与 feel / hud / tray-dock 分离）。
 */

/** @typedef {ReturnType<typeof createDefaultBoardTune>} BoardTuneState */

export function createDefaultBoardTune() {
  // 默认值来自面板调参（用户确认）
  return {
    /** 棋盘整体缩放（叠在 LAYOUT_BOARD_SCALE 上） */
    BOARD_SCALE: 1,
    /** 垂直偏移 / frame 高（+ 下移，叠在 LAYOUT_BOARD_SHIFT_Y） */
    BOARD_SHIFT_Y: 0,
    /** 左右边距 / frame 宽 */
    BOARD_MARGIN_X: 0.05,
    /** 格缝 inset（单侧 / pitch） */
    BOARD_CELL_INSET: 0.02,
    /** 白框外扩（× cell） */
    BOARD_FRAME_PAD_CELLS: 0.2,
    /** 盘面内底相对 8×8 再外扩（× cell） */
    BOARD_INNER_PAD_CELLS: 0.02,
    /** 空格：深蓝紫井 */
    BOARD_EMPTY_DARK: 0.42,
    /** 空格不透明度 */
    BOARD_EMPTY_OPACITY: 0.7,
    /** 棋盘底板阴影透明度 */
    BOARD_SHADOW_OPACITY: 0.3,
    /** 阴影扩散（× 盘边长） */
    BOARD_SHADOW_SPREAD: 0.012,
    /** 阴影下移 px */
    BOARD_SHADOW_Y_PX: 6,
    /** 圆角相对格边 */
    BOARD_CELL_CORNER: 0.12,
    /** 盘框 RGB — 深蓝紫边 */
    BOARD_FRAME_R: 55,
    BOARD_FRAME_G: 67,
    BOARD_FRAME_B: 95,
    /** 内底 RGB — 深海军蓝盘 */
    BOARD_FILL_R: 31,
    BOARD_FILL_G: 38,
    BOARD_FILL_B: 61,
    /** 棋盘阴影 RGB */
    BOARD_SHADOW_R: 24,
    BOARD_SHADOW_G: 30,
    BOARD_SHADOW_B: 48,
  };
}

function clampByte(n) {
  return Math.max(0, Math.min(255, n | 0));
}

/** @param {BoardTuneState} [t] */
export function boardFrameHex(t = state) {
  return (clampByte(t.BOARD_FRAME_R) << 16) | (clampByte(t.BOARD_FRAME_G) << 8) | clampByte(t.BOARD_FRAME_B);
}

/** @param {BoardTuneState} [t] */
export function boardFillHex(t = state) {
  return (clampByte(t.BOARD_FILL_R) << 16) | (clampByte(t.BOARD_FILL_G) << 8) | clampByte(t.BOARD_FILL_B);
}

/** @param {BoardTuneState} [t] */
export function boardShadowHex(t = state) {
  return (clampByte(t.BOARD_SHADOW_R) << 16) | (clampByte(t.BOARD_SHADOW_G) << 8) | clampByte(t.BOARD_SHADOW_B);
}

/** @type {BoardTuneState} */
let state = createDefaultBoardTune();

/** @type {Set<(s: BoardTuneState, key?: string) => void>} */
const listeners = new Set();

export function getBoardTune() {
  return state;
}

/**
 * @param {Partial<BoardTuneState>} patch
 */
export function setBoardTune(patch) {
  if (!patch || typeof patch !== 'object') return state;
  let changed = false;
  /** @type {string | undefined} */
  let lastKey;
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in state)) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    if (state[/** @type {keyof BoardTuneState} */ (k)] === num) continue;
    state[/** @type {keyof BoardTuneState} */ (k)] = num;
    changed = true;
    lastKey = k;
  }
  if (changed) {
    for (const fn of listeners) fn(state, lastKey);
  }
  return state;
}

export function resetBoardTune() {
  state = createDefaultBoardTune();
  for (const fn of listeners) fn(state, undefined);
  return state;
}

/**
 * @param {(s: BoardTuneState, key?: string) => void} fn
 */
export function onBoardTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 空格：深蓝紫井（低亮度蓝紫，突出中明度彩色块） */
export function boardEmptyColors() {
  const d = Math.max(0, Math.min(1, state.BOARD_EMPTY_DARK));
  // 浅 ~ #252d46  深 ~ #1b2236
  const light = { r: 0x25, g: 0x2d, b: 0x46 };
  const dark = { r: 0x1b, g: 0x22, b: 0x36 };
  const mix = (a, b) => Math.round(a + (b - a) * d);
  const r = mix(light.r, dark.r);
  const g = mix(light.g, dark.g);
  const b = mix(light.b, dark.b);
  const fill = (r << 16) | (g << 8) | b;
  const strokeR = Math.max(0, r - 10);
  const strokeG = Math.max(0, g - 8);
  const strokeB = Math.max(0, b - 12);
  const stroke = (strokeR << 16) | (strokeG << 8) | strokeB;
  const innerR = Math.min(255, r + 8);
  const innerG = Math.min(255, g + 8);
  const innerB = Math.min(255, b + 12);
  const inner = (innerR << 16) | (innerG << 8) | innerB;
  return { stroke, fill, inner };
}

export const BOARD_TUNE_FIELDS = [
  {
    group: '尺寸 / 位置',
    fields: [
      {
        key: 'BOARD_SCALE',
        label: '棋盘缩放',
        min: 0.7,
        max: 1.15,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'BOARD_SHIFT_Y',
        label: '垂直下移(frame高)',
        min: -0.08,
        max: 0.12,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'BOARD_MARGIN_X',
        label: '左右边距(frame宽)',
        min: 0.02,
        max: 0.14,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'BOARD_CELL_INSET',
        label: '格缝 inset',
        min: 0.002,
        max: 0.06,
        step: 0.001,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'BOARD_CELL_CORNER',
        label: '格圆角',
        min: 0.06,
        max: 0.28,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
    ],
  },
  {
    group: '白框 / 空格',
    fields: [
      {
        key: 'BOARD_FRAME_PAD_CELLS',
        label: '白框外扩×cell',
        min: 0.02,
        max: 0.35,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'BOARD_INNER_PAD_CELLS',
        label: '内底外扩×cell',
        min: 0,
        max: 0.12,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'BOARD_EMPTY_DARK',
        label: '空格深浅',
        min: 0,
        max: 1,
        step: 0.02,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'BOARD_EMPTY_OPACITY',
        label: '空格不透明度',
        min: 0.4,
        max: 1,
        step: 0.02,
        format: (v) => Number(v).toFixed(2),
      },
    ],
  },
  {
    group: '阴影',
    fields: [
      {
        key: 'BOARD_SHADOW_OPACITY',
        label: '棋盘阴影透明度',
        min: 0,
        max: 0.45,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'BOARD_SHADOW_SPREAD',
        label: '阴影扩散',
        min: 0,
        max: 0.08,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'BOARD_SHADOW_Y_PX',
        label: '阴影下移 px',
        min: 0,
        max: 20,
        step: 1,
        format: (v) => `${v | 0}px`,
      },
    ],
  },
  {
    group: '颜色',
    fields: [
      { key: 'BOARD_FRAME_R', label: '白框 R', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_FRAME_G', label: '白框 G', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_FRAME_B', label: '白框 B', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_FILL_R', label: '内底 R', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_FILL_G', label: '内底 G', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_FILL_B', label: '内底 B', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_SHADOW_R', label: '阴影 R', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_SHADOW_G', label: '阴影 G', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BOARD_SHADOW_B', label: '阴影 B', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
    ],
  },
];
