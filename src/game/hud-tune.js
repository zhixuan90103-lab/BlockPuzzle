/**
 * HUD（BEST / SCORE）独立调参状态。
 * 与 feel-panel / tune.js 分离，仅驱动顶栏 CSS 变量。
 */

/** @typedef {ReturnType<typeof createDefaultHudTune>} HudTuneState */

export function createDefaultHudTune() {
  // 默认值来自真机/面板调参（用户确认 2026-08）
  return {
    /** 数字字号 px */
    HUD_VALUE_FONT_PX: 42,
    /** 标签字号 px */
    HUD_LABEL_FONT_PX: 20,
    /** label ↔ 数字间距 px */
    HUD_GAP_PX: 9,
    /** 顶栏额外上内边距 px（在 safe-top 之下） */
    HUD_PAD_TOP_PX: 40,
    /** 左右缩进 %（相对顶栏宽） */
    HUD_INSET_X_PCT: 9,
    /** 整行垂直偏移 px（+ 下移） */
    HUD_OFFSET_Y_PX: 34,
    /** 整行水平偏移 px（+ 右移） */
    HUD_OFFSET_X_PX: 0,
    /** BEST 列额外水平偏移 px（+ 右） */
    HUD_BEST_NUDGE_X_PX: 0,
    /** SCORE 列额外水平偏移 px（+ 右） */
    HUD_SCORE_NUDGE_X_PX: 0,
    /** 设置齿轮：相对 safe-top + pad-top 再下移 px */
    HUD_GEAR_TOP_EXTRA_PX: 20,
    /** 设置齿轮右边距 px */
    HUD_GEAR_RIGHT_PX: 25,
  };
}

/** @type {HudTuneState} */
let state = createDefaultHudTune();

/** @type {Set<(s: HudTuneState, key?: string) => void>} */
const listeners = new Set();

export function getHudTune() {
  return state;
}

/**
 * @param {Partial<HudTuneState>} patch
 */
export function setHudTune(patch) {
  if (!patch || typeof patch !== 'object') return state;
  let changed = false;
  /** @type {string | undefined} */
  let lastKey;
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in state)) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    if (state[/** @type {keyof HudTuneState} */ (k)] === num) continue;
    state[/** @type {keyof HudTuneState} */ (k)] = num;
    changed = true;
    lastKey = k;
  }
  if (changed) {
    for (const fn of listeners) fn(state, lastKey);
  }
  return state;
}

export function resetHudTune() {
  state = createDefaultHudTune();
  for (const fn of listeners) fn(state, undefined);
  return state;
}

/**
 * @param {(s: HudTuneState, key?: string) => void} fn
 */
export function onHudTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 把当前 HUD 参数写到 CSS 变量。
 * - #hud：顶栏 BEST/SCORE
 * - #phone-frame / :root：设置齿轮（与 feel-panel 同级）
 * @param {HTMLElement | null | undefined} el
 */
export function applyHudTuneCss(el) {
  const hudRoot = el || document.getElementById('hud') || document.documentElement;
  const shell =
    document.getElementById('phone-frame') || document.documentElement;
  const t = state;
  const pairs = [
    ['--hud-value-font', `${Math.max(10, t.HUD_VALUE_FONT_PX)}px`],
    ['--hud-label-font', `${Math.max(8, t.HUD_LABEL_FONT_PX)}px`],
    ['--hud-gap', `${Math.max(0, t.HUD_GAP_PX)}px`],
    ['--hud-pad-top', `${Math.max(0, t.HUD_PAD_TOP_PX)}px`],
    ['--hud-inset-x', `${Math.max(0, t.HUD_INSET_X_PCT)}%`],
    ['--hud-offset-y', `${t.HUD_OFFSET_Y_PX}px`],
    ['--hud-offset-x', `${t.HUD_OFFSET_X_PX}px`],
    ['--hud-best-nudge-x', `${t.HUD_BEST_NUDGE_X_PX}px`],
    ['--hud-score-nudge-x', `${t.HUD_SCORE_NUDGE_X_PX}px`],
    ['--hud-gear-top-extra', `${Math.max(0, t.HUD_GEAR_TOP_EXTRA_PX)}px`],
    ['--hud-gear-right', `${Math.max(0, t.HUD_GEAR_RIGHT_PX)}px`],
    ['--ui-score-font', `${Math.max(10, t.HUD_VALUE_FONT_PX)}px`],
  ];
  for (const node of [hudRoot, shell]) {
    if (!node?.style) continue;
    for (const [k, v] of pairs) node.style.setProperty(k, v);
  }
}

/** 调参面板滑条定义 */
export const HUD_TUNE_FIELDS = [
  {
    group: '字号',
    fields: [
      { key: 'HUD_VALUE_FONT_PX', label: '数字字号', min: 14, max: 56, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_LABEL_FONT_PX', label: '标签字号', min: 8, max: 20, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_GAP_PX', label: '标签–数字间距', min: 0, max: 16, step: 1, format: (v) => `${v | 0}px` },
    ],
  },
  {
    group: '位置',
    fields: [
      { key: 'HUD_PAD_TOP_PX', label: '顶栏上内边距', min: 0, max: 40, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_INSET_X_PCT', label: '左右缩进 %', min: 0, max: 22, step: 0.5, format: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'HUD_OFFSET_Y_PX', label: '整行下移', min: -40, max: 80, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_OFFSET_X_PX', label: '整行右移', min: -40, max: 40, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_BEST_NUDGE_X_PX', label: 'BEST 右移', min: -60, max: 60, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_SCORE_NUDGE_X_PX', label: 'SCORE 右移', min: -60, max: 60, step: 1, format: (v) => `${v | 0}px` },
    ],
  },
  {
    group: '设置齿轮',
    fields: [
      { key: 'HUD_GEAR_TOP_EXTRA_PX', label: '齿轮下移(相对岛下)', min: 0, max: 120, step: 1, format: (v) => `${v | 0}px` },
      { key: 'HUD_GEAR_RIGHT_PX', label: '齿轮右边距', min: 0, max: 40, step: 1, format: (v) => `${v | 0}px` },
    ],
  },
];
