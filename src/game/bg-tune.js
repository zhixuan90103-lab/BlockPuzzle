/**
 * 背景色独立调参（场景 background + 壳 CSS）。
 */

/** @typedef {ReturnType<typeof createDefaultBgTune>} BgTuneState */

export function createDefaultBgTune() {
  // 参考：中紫壳 #7B6BC4
  return {
    BG_R: 123,
    BG_G: 107,
    BG_B: 196,
    LETTERBOX_R: 88,
    LETTERBOX_G: 74,
    LETTERBOX_B: 150,
  };
}

/** @type {BgTuneState} */
let state = createDefaultBgTune();

/** @type {Set<(s: BgTuneState, key?: string) => void>} */
const listeners = new Set();

export function getBgTune() {
  return state;
}

/**
 * @param {Partial<BgTuneState>} patch
 */
export function setBgTune(patch) {
  if (!patch || typeof patch !== 'object') return state;
  let changed = false;
  /** @type {string | undefined} */
  let lastKey;
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in state)) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    const byte = Math.max(0, Math.min(255, Math.round(num)));
    if (state[/** @type {keyof BgTuneState} */ (k)] === byte) continue;
    state[/** @type {keyof BgTuneState} */ (k)] = byte;
    changed = true;
    lastKey = k;
  }
  if (changed) {
    for (const fn of listeners) fn(state, lastKey);
  }
  return state;
}

export function resetBgTune() {
  state = createDefaultBgTune();
  for (const fn of listeners) fn(state, undefined);
  return state;
}

/**
 * @param {(s: BgTuneState, key?: string) => void} fn
 */
export function onBgTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function byte(n) {
  return Math.max(0, Math.min(255, n | 0));
}

/** @param {BgTuneState} [t] */
export function bgHex(t = state) {
  return (byte(t.BG_R) << 16) | (byte(t.BG_G) << 8) | byte(t.BG_B);
}

/** @param {BgTuneState} [t] */
export function bgCss(t = state) {
  return `rgb(${byte(t.BG_R)}, ${byte(t.BG_G)}, ${byte(t.BG_B)})`;
}

/** @param {BgTuneState} [t] */
export function letterboxCss(t = state) {
  return `rgb(${byte(t.LETTERBOX_R)}, ${byte(t.LETTERBOX_G)}, ${byte(t.LETTERBOX_B)})`;
}

/**
 * 写入 CSS 变量（#phone-frame / :root）
 * @param {HTMLElement | null} [el]
 */
export function applyBgTuneCss(el) {
  const t = state;
  const root = el || document.getElementById('phone-frame') || document.documentElement;
  const frame = bgCss(t);
  const letter = letterboxCss(t);
  root.style.setProperty('--frame-bg', frame);
  document.documentElement.style.setProperty('--frame-bg', frame);
  document.documentElement.style.setProperty('--letterbox-bg', letter);
  const letterbox = document.getElementById('letterbox');
  if (letterbox) letterbox.style.background = letter;
  const phone = document.getElementById('phone-frame');
  if (phone) phone.style.background = frame;
  if (document.body) {
    // native 全屏时 body 跟壳色
    if (document.body.classList.contains('native-app')) {
      document.body.style.background = frame;
    }
  }
}

export const BG_TUNE_FIELDS = [
  {
    group: '游戏背景',
    fields: [
      { key: 'BG_R', label: '背景 R', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BG_G', label: '背景 G', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
      { key: 'BG_B', label: '背景 B', min: 0, max: 255, step: 1, format: (v) => `${v | 0}` },
    ],
  },
  {
    group: '外边 letterbox',
    fields: [
      {
        key: 'LETTERBOX_R',
        label: '外边 R',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'LETTERBOX_G',
        label: '外边 G',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
      {
        key: 'LETTERBOX_B',
        label: '外边 B',
        min: 0,
        max: 255,
        step: 1,
        format: (v) => `${v | 0}`,
      },
    ],
  },
];
