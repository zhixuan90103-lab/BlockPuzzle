/**
 * 摆放物（落子 / tray / 拖拽块）样式独立调参。
 */

/** @typedef {ReturnType<typeof createDefaultPieceTune>} PieceTuneState */

export function createDefaultPieceTune() {
  // 默认值来自面板调参（用户确认）
  return {
    /** 圆角相对短边 */
    PIECE_CORNER: 0.14,
    /** 主体相对外 rim 缩放 */
    PIECE_BODY_SCALE: 0.96,
    /** rim 加深系数（越大越浅/越接近本色） */
    PIECE_RIM_SHADE: 0.76,
    /** 顶高光 shade */
    PIECE_TOP_SHADE: 1.24,
    /** 顶高光透明度 */
    PIECE_TOP_OP: 0.28,
    /** 顶高光带高度占比 */
    PIECE_TOP_BAND: 0.05,
    /** 底暗带 shade */
    PIECE_BOT_SHADE: 0.72,
    /** 底暗带透明度 */
    PIECE_BOT_OP: 0.24,
    /** 底暗带高度占比 */
    PIECE_BOT_BAND: 0.06,
    /** 高光点透明度（0=关闭圆点） */
    PIECE_GLINT_OP: 0,
    /** 高光点尺寸占比 */
    PIECE_GLINT_SIZE: 0,
    /** tray 块阴影透明度 */
    PIECE_SHADOW_OP: 0.18,
    /** 阴影颜色 R/G/B */
    PIECE_SHADOW_R: 118,
    PIECE_SHADOW_G: 56,
    PIECE_SHADOW_B: 84,
    /** 阴影偏移 × cellPitch */
    PIECE_SHADOW_OX: 0.1,
    PIECE_SHADOW_OY: 0.1,
  };
}

/** @type {PieceTuneState} */
let state = createDefaultPieceTune();

/** @type {Set<(s: PieceTuneState, key?: string) => void>} */
const listeners = new Set();

export function getPieceTune() {
  return state;
}

/**
 * @param {Partial<PieceTuneState>} patch
 */
export function setPieceTune(patch) {
  if (!patch || typeof patch !== 'object') return state;
  let changed = false;
  /** @type {string | undefined} */
  let lastKey;
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in state)) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    if (state[/** @type {keyof PieceTuneState} */ (k)] === num) continue;
    state[/** @type {keyof PieceTuneState} */ (k)] = num;
    changed = true;
    lastKey = k;
  }
  if (changed) {
    for (const fn of listeners) fn(state, lastKey);
  }
  return state;
}

export function resetPieceTune() {
  state = createDefaultPieceTune();
  for (const fn of listeners) fn(state, undefined);
  return state;
}

/**
 * @param {(s: PieceTuneState, key?: string) => void} fn
 */
export function onPieceTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @param {PieceTuneState} [t] */
export function pieceShadowHex(t = state) {
  const r = Math.max(0, Math.min(255, t.PIECE_SHADOW_R | 0));
  const g = Math.max(0, Math.min(255, t.PIECE_SHADOW_G | 0));
  const b = Math.max(0, Math.min(255, t.PIECE_SHADOW_B | 0));
  return (r << 16) | (g << 8) | b;
}

export const PIECE_TUNE_FIELDS = [
  {
    group: '外形',
    fields: [
      {
        key: 'PIECE_CORNER',
        label: '圆角',
        min: 0.04,
        max: 0.32,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_BODY_SCALE',
        label: '主体缩放',
        min: 0.88,
        max: 1,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
    ],
  },
  {
    group: '体积感',
    fields: [
      {
        key: 'PIECE_RIM_SHADE',
        label: '外圈加深',
        min: 0.45,
        max: 0.95,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_TOP_SHADE',
        label: '顶高光亮度',
        min: 1,
        max: 1.4,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_TOP_OP',
        label: '顶高光透明',
        min: 0,
        max: 0.8,
        step: 0.02,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_TOP_BAND',
        label: '顶高光带高度',
        min: 0,
        max: 0.4,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_BOT_SHADE',
        label: '底暗加深',
        min: 0.5,
        max: 0.95,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_BOT_OP',
        label: '底暗透明',
        min: 0,
        max: 0.7,
        step: 0.02,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_BOT_BAND',
        label: '底暗带高度',
        min: 0,
        max: 0.35,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_GLINT_OP',
        label: '高光点透明',
        min: 0,
        max: 0.5,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_GLINT_SIZE',
        label: '高光点大小',
        min: 0,
        max: 0.25,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
    ],
  },
  {
    group: '块阴影',
    fields: [
      {
        key: 'PIECE_SHADOW_OP',
        label: '阴影透明',
        min: 0,
        max: 0.45,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_SHADOW_OX',
        label: '阴影 X 偏移×cell',
        min: 0,
        max: 0.35,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_SHADOW_OY',
        label: '阴影 Y 偏移×cell',
        min: 0,
        max: 0.4,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'PIECE_SHADOW_R',
        label: '阴影 R',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'PIECE_SHADOW_G',
        label: '阴影 G',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'PIECE_SHADOW_B',
        label: '阴影 B',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
    ],
  },
];
