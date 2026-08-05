/**
 * 候选区白色底条（dock）独立调参。
 * 与 feel-panel / hud-panel 分离。
 */

/** @typedef {ReturnType<typeof createDefaultTrayDockTune>} TrayDockTuneState */

export function createDefaultTrayDockTune() {
  // 默认值来自面板调参（用户确认）
  return {
    /** 条高度 = max(cell×MIN, tray.h × FRAC) */
    DOCK_H_FRAC: 0.75,
    /** 相对 tray.cell 的最小高度倍数 */
    DOCK_H_MIN_CELLS: 1.35,
    /** 宽度 = tray.w × FRAC + cell×EXTRA */
    DOCK_W_FRAC: 1.0,
    /** 相对 cell 的额外宽度外扩 */
    DOCK_W_EXTRA_CELLS: 1.5,
    /** 圆角强度 0~0.5（相对短边） */
    DOCK_CORNER: 0.05,
    /** 不透明度 0~1 */
    DOCK_OPACITY: 0.2,
    /** 垂直偏移 px（frame，+ 下移） */
    DOCK_Y_NUDGE_PX: 0,
    /** 水平偏移 px（frame，+ 右移） */
    DOCK_X_NUDGE_PX: 0,
    /** 底板投影不透明度 */
    DOCK_SHADOW_OPACITY: 0.18,
    /** 底板投影相对外扩（× 短边） */
    DOCK_SHADOW_SPREAD: 0,
    /** 底板投影下移 px */
    DOCK_SHADOW_Y_PX: 0,
    /** 底色 RGB（黑 + 低透明） */
    DOCK_COLOR_R: 0,
    DOCK_COLOR_G: 0,
    DOCK_COLOR_B: 0,
    /** 阴影 RGB */
    DOCK_SHADOW_R: 58,
    DOCK_SHADOW_G: 85,
    DOCK_SHADOW_B: 100,
  };
}

/** @param {TrayDockTuneState} [t] */
export function trayDockFillHex(t = state) {
  const r = Math.max(0, Math.min(255, t.DOCK_COLOR_R | 0));
  const g = Math.max(0, Math.min(255, t.DOCK_COLOR_G | 0));
  const b = Math.max(0, Math.min(255, t.DOCK_COLOR_B | 0));
  return (r << 16) | (g << 8) | b;
}

/** @param {TrayDockTuneState} [t] */
export function trayDockShadowHex(t = state) {
  const r = Math.max(0, Math.min(255, t.DOCK_SHADOW_R | 0));
  const g = Math.max(0, Math.min(255, t.DOCK_SHADOW_G | 0));
  const b = Math.max(0, Math.min(255, t.DOCK_SHADOW_B | 0));
  return (r << 16) | (g << 8) | b;
}

/** @type {TrayDockTuneState} */
let state = createDefaultTrayDockTune();

/** @type {Set<(s: TrayDockTuneState, key?: string) => void>} */
const listeners = new Set();

export function getTrayDockTune() {
  return state;
}

/**
 * @param {Partial<TrayDockTuneState>} patch
 */
export function setTrayDockTune(patch) {
  if (!patch || typeof patch !== 'object') return state;
  let changed = false;
  /** @type {string | undefined} */
  let lastKey;
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in state)) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    if (state[/** @type {keyof TrayDockTuneState} */ (k)] === num) continue;
    state[/** @type {keyof TrayDockTuneState} */ (k)] = num;
    changed = true;
    lastKey = k;
  }
  if (changed) {
    for (const fn of listeners) fn(state, lastKey);
  }
  return state;
}

export function resetTrayDockTune() {
  state = createDefaultTrayDockTune();
  for (const fn of listeners) fn(state, undefined);
  return state;
}

/**
 * @param {(s: TrayDockTuneState, key?: string) => void} fn
 */
export function onTrayDockTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const TRAY_DOCK_TUNE_FIELDS = [
  {
    group: '尺寸',
    fields: [
      {
        key: 'DOCK_H_FRAC',
        label: '高度比例(相对tray区)',
        min: 0.2,
        max: 1,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_H_MIN_CELLS',
        label: '最小高度×cell',
        min: 0.6,
        max: 3,
        step: 0.05,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_W_FRAC',
        label: '宽度比例(相对tray宽)',
        min: 0.5,
        max: 1.15,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_W_EXTRA_CELLS',
        label: '宽度外扩×cell',
        min: -0.5,
        max: 1.5,
        step: 0.05,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_CORNER',
        label: '圆角',
        min: 0.05,
        max: 0.5,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
    ],
  },
  {
    group: '外观 / 位置',
    fields: [
      {
        key: 'DOCK_OPACITY',
        label: '不透明度',
        min: 0,
        max: 1,
        step: 0.02,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_Y_NUDGE_PX',
        label: '下移 px',
        min: -80,
        max: 80,
        step: 1,
        format: (v) => `${v | 0}px`,
      },
      {
        key: 'DOCK_X_NUDGE_PX',
        label: '右移 px',
        min: -40,
        max: 40,
        step: 1,
        format: (v) => `${v | 0}px`,
      },
      {
        key: 'DOCK_SHADOW_OPACITY',
        label: '底板阴影透明度',
        min: 0,
        max: 0.5,
        step: 0.01,
        format: (v) => Number(v).toFixed(2),
      },
      {
        key: 'DOCK_SHADOW_SPREAD',
        label: '底板阴影扩散',
        min: 0,
        max: 0.15,
        step: 0.005,
        format: (v) => Number(v).toFixed(3),
      },
      {
        key: 'DOCK_SHADOW_Y_PX',
        label: '底板阴影下移',
        min: 0,
        max: 16,
        step: 1,
        format: (v) => `${v | 0}px`,
      },
    ],
  },
  {
    group: '颜色',
    fields: [
      {
        key: 'DOCK_COLOR_R',
        label: '底色 R',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'DOCK_COLOR_G',
        label: '底色 G',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'DOCK_COLOR_B',
        label: '底色 B',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'DOCK_SHADOW_R',
        label: '阴影 R',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'DOCK_SHADOW_G',
        label: '阴影 G',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'DOCK_SHADOW_B',
        label: '阴影 B',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
    ],
  },
];
