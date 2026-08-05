/**
 * 关掉 Web / WKWebView 干扰手感的默认行为：
 * - 双指捏合 / 多指
 * - 双击放大
 * - 长按放大镜 / 文本选择 / callout 菜单
 * - 拖拽图片 / 系统上下文菜单
 * - Ctrl+滚轮缩放
 *
 * 调参面板（input / .feel-panel 等）保留可点、可竖滑。
 */

function isUiChrome(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    [
      'input',
      'textarea',
      'button',
      'select',
      'label',
      'a',
      '.feel-panel',
      '#feel-panel',
      '.hud-panel',
      '#hud-panel',
      '.tray-dock-panel',
      '#tray-dock-panel',
      '.board-panel',
      '#board-panel',
      '.piece-panel',
      '#piece-panel',
      '.bg-panel',
      '#bg-panel',
      '[data-level-editor]',
      '[data-restart]',
    ].join(', '),
  );
}

export function installTouchHygiene() {
  const root = document.documentElement;
  root.style.touchAction = 'none';
  root.style.setProperty('-webkit-user-select', 'none');
  root.style.userSelect = 'none';
  root.style.setProperty('-webkit-touch-callout', 'none');
  root.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  // 全局锁选择 / 拖拽 / 菜单（放大镜前置）
  document.addEventListener('selectstart', (e) => e.preventDefault(), {
    capture: true,
  });
  document.addEventListener('dragstart', (e) => e.preventDefault(), {
    capture: true,
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault(), {
    capture: true,
  });
  document.addEventListener('dblclick', (e) => e.preventDefault(), {
    capture: true,
  });
  document.addEventListener(
    'gesturestart',
    (e) => e.preventDefault(),
    { passive: false, capture: true },
  );
  document.addEventListener(
    'gesturechange',
    (e) => e.preventDefault(),
    { passive: false, capture: true },
  );
  document.addEventListener(
    'gestureend',
    (e) => e.preventDefault(),
    { passive: false, capture: true },
  );

  /**
   * iOS 放大镜：必须在 touchstart 上 preventDefault（对非 UI 控件）。
   * pointer 事件仍可正常用于游戏拖放。
   */
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (!isUiChrome(e.target)) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true },
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      // 非面板区域禁止页面滚动 / 下拉刷新感
      if (!isUiChrome(e.target)) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true },
  );

  // 双击放大：短时间第二次 touchend
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = performance.now();
      if (now - lastTouchEnd < 350 && !isUiChrome(e.target)) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false, capture: true },
  );

  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false, capture: true },
  );

  // 非主指针一律吞掉
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.isPrimary === false) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );

  // 保险：selection 被系统建起来就立刻清掉
  document.addEventListener(
    'selectionchange',
    () => {
      const sel = window.getSelection?.();
      if (sel && sel.rangeCount > 0) sel.removeAllRanges();
    },
    { capture: true },
  );
}
