/**
 * 候选区几何 SSOT（单一坐标系）
 *
 * 设计：
 * - 视口：tray 带 [viewX, viewX+viewW] × 垂直 cy
 * - 内容：n 个槽，基准宽 base = viewW / VISIBLE(3.5)
 * - 槽中心距 stride = base * (1 + GAP_FRAC)，拉开大块之间的空隙
 * - 命中/占位宽 slotW = stride（整格可点）
 * - 内容窄于视口时 pad 居中；宽于视口时 pad=0，靠 scroll 浏览
 * - 屏幕中心 X = viewX + pad + (i+0.5)*stride - scrollX
 * - FLIP 只用附加偏移；跟手 rubber；松手弹回
 */
import {
  TRAY_RUBBER_C,
  TRAY_SLOT_GAP_FRAC,
  TRAY_VISIBLE_SLOTS,
} from './defaults.js';

/**
 * @param {{ x: number, y: number, w: number, h: number, cy?: number }} trayBand
 * @param {number} n
 * @param {number} [visibleSlots]
 */
export function createTrayMetrics(trayBand, n, visibleSlots = TRAY_VISIBLE_SLOTS) {
  const viewX = Number.isFinite(trayBand?.x) ? trayBand.x : 0;
  const viewY = Number.isFinite(trayBand?.y) ? trayBand.y : 0;
  const viewW = Number.isFinite(trayBand?.w) && trayBand.w > 0 ? trayBand.w : 1;
  const viewH = Number.isFinite(trayBand?.h) && trayBand.h > 0 ? trayBand.h : 1;
  const cy = Number.isFinite(trayBand?.cy) ? trayBand.cy : viewY + viewH / 2;
  const count = Math.max(0, n | 0);
  const vis = Math.max(1, visibleSlots || TRAY_VISIBLE_SLOTS);
  const base = viewW / vis;
  const gapFrac = Math.max(0, Number(TRAY_SLOT_GAP_FRAC) || 0);
  // 中心距：在 3.5 基准上再加空隙，横条/T 不会贴死
  const stride = base * (1 + gapFrac);
  const slotW = stride;
  const contentW = count * stride;
  const pad = Math.max(0, (viewW - contentW) / 2);
  const fits = contentW <= viewW + 0.5;

  return {
    viewX,
    viewY,
    viewW,
    viewH,
    cy,
    n: count,
    /** 命中槽宽 / 布局步长 */
    slotW,
    /** 块中心间距（与 slotW 相同） */
    stride,
    base,
    contentW,
    pad,
    fits,
    visibleSlots: vis,
  };
}

/**
 * @param {ReturnType<typeof createTrayMetrics>} m
 * @returns {{ min: number, max: number }}
 */
export function trayScrollLimits(m) {
  if (!m || m.fits || m.n <= 0) {
    // 少块：逻辑中心 scroll=0；跟手时可 transient overscroll（由 rubber 处理）
    return { min: 0, max: 0 };
  }
  return { min: 0, max: Math.max(0, m.contentW - m.viewW) };
}

/**
 * 内容坐标下第 i 个槽中心 X（相对内容左缘 0，已含 pad）
 * @param {ReturnType<typeof createTrayMetrics>} m
 * @param {number} index
 */
export function pieceContentCenterX(m, index) {
  const step = m.stride > 0 ? m.stride : m.slotW;
  return m.pad + (index + 0.5) * step;
}

/**
 * 屏幕（frame）坐标下块中心 X
 * @param {ReturnType<typeof createTrayMetrics>} m
 * @param {number} index
 * @param {number} scrollX
 * @param {number} [offsetX] FLIP 附加偏移（屏幕像素）
 */
export function pieceScreenCenterX(m, index, scrollX, offsetX = 0) {
  const s = Number.isFinite(scrollX) ? scrollX : 0;
  const o = Number.isFinite(offsetX) ? offsetX : 0;
  return m.viewX + pieceContentCenterX(m, index) - s + o;
}

/**
 * 槽左缘屏幕 X（命中用）
 * @param {ReturnType<typeof createTrayMetrics>} m
 * @param {number} index
 * @param {number} scrollX
 */
export function pieceScreenLeftX(m, index, scrollX) {
  const s = Number.isFinite(scrollX) ? scrollX : 0;
  const step = m.stride > 0 ? m.stride : m.slotW;
  return m.viewX + m.pad + index * step - s;
}

/**
 * iOS-like rubber：跟手时逻辑 scroll 映射到视觉 scroll
 * f(over) = d * (1 - 1/(over*c/d + 1))
 * @param {number} x
 * @param {number} min
 * @param {number} max
 * @param {number} viewW
 * @param {number} [c]
 */
export function rubberScrollX(x, min, max, viewW, c = TRAY_RUBBER_C) {
  if (!Number.isFinite(x)) return Number.isFinite(min) ? min : 0;
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : 0;
  // 用较小特征长度，越界视觉位移最多约 0.45 屏，不会整排甩没
  const d = Math.max(1, (Number.isFinite(viewW) ? viewW : 1) * 0.45);
  if (x >= lo && x <= hi) return x;
  if (x < lo) {
    const over = lo - x;
    return lo - d * (1 - 1 / ((over * c) / d + 1));
  }
  const over = x - hi;
  return hi + d * (1 - 1 / ((over * c) / d + 1));
}

/**
 * 硬夹到合法逻辑区间（松手/空闲）
 * @param {number} x
 * @param {{ min: number, max: number }} lim
 */
export function clampScroll(x, lim) {
  if (!Number.isFinite(x)) return 0;
  const lo = Number.isFinite(lim.min) ? lim.min : 0;
  const hi = Number.isFinite(lim.max) ? lim.max : 0;
  return Math.min(hi, Math.max(lo, x));
}

/**
 * 松手 x → 插入下标 0..n
 * @param {number} fx frame x
 * @param {ReturnType<typeof createTrayMetrics>} m 插入前 metrics
 * @param {number} scrollX
 */
export function insertIndexFromFx(fx, m, scrollX) {
  if (!m || m.n <= 0) return 0;
  if (!Number.isFinite(fx)) return m.n;
  const s = Number.isFinite(scrollX) ? scrollX : 0;
  const step = m.stride > 0 ? m.stride : m.slotW;
  // 内容坐标
  const contentX = fx - m.viewX + s;
  const idx = Math.round((contentX - m.pad) / step - 0.5);
  return Math.max(0, Math.min(m.n, idx));
}

/**
 * 兼容旧 slots 数组（调试区框）
 * @param {ReturnType<typeof createTrayMetrics>} m
 * @param {number} scrollX
 */
export function buildScreenSlots(m, scrollX = 0) {
  /** @type {{ index: number, x: number, y: number, w: number, h: number, cx: number, cy: number }[]} */
  const slots = [];
  for (let i = 0; i < m.n; i++) {
    const x = pieceScreenLeftX(m, i, scrollX);
    slots.push({
      index: i,
      x,
      y: m.viewY,
      w: m.slotW,
      h: m.viewH,
      cx: pieceScreenCenterX(m, i, scrollX),
      cy: m.cy,
    });
  }
  return slots;
}

export function easeOutCubic(t01) {
  const t = Math.min(1, Math.max(0, t01));
  return 1 - (1 - t) ** 3;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// —— 旧 API 名兼容（若外部仍引用）——
export function traySlotW(tray, visibleSlots = TRAY_VISIBLE_SLOTS) {
  const w = Number.isFinite(tray?.w) && tray.w > 0 ? tray.w : 1;
  return w / Math.max(1, visibleSlots);
}

export function trayScrollRange(tray, n, slotW) {
  const m = createTrayMetrics(tray, n);
  // 若传入 slotW 不一致，以 metrics 为准
  void slotW;
  const lim = trayScrollLimits(m);
  return { min: lim.min, max: lim.max, contentW: m.contentW, originX: m.viewX + m.pad };
}

export function buildTraySlots(tray, n, slotW) {
  const m = createTrayMetrics(tray, n);
  void slotW;
  // 内容坐标 slots（未减 scroll）— 仅兼容；新代码请用 buildScreenSlots
  /** @type {{ index: number, x: number, y: number, w: number, h: number, cx: number, cy: number }[]} */
  const slots = [];
  for (let i = 0; i < m.n; i++) {
    const cx = m.viewX + pieceContentCenterX(m, i);
    const x = cx - m.slotW / 2;
    slots.push({
      index: i,
      x,
      y: m.viewY,
      w: m.slotW,
      h: m.viewH,
      cx,
      cy: m.cy,
    });
  }
  return slots;
}
