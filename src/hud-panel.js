/**
 * HUD 调参面板（独立于 feel-panel）
 * 入口：左下角「HUD」按钮
 */
import {
  applyHudTuneCss,
  getHudTune,
  HUD_TUNE_FIELDS,
  onHudTuneChange,
  resetHudTune,
  setHudTune,
} from './game/hud-tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   hud?: HTMLElement | null,
 *   onChange?: () => void,
 * }} opts
 */
export function createHudPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const hudEl = opts.hud || document.getElementById('hud');
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'hud-panel';
  root.className = 'hud-panel is-collapsed';
  root.setAttribute('aria-label', 'HUD 调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'hud-panel-fab';
  fab.setAttribute('aria-label', 'HUD 布局调参');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = 'BEST / SCORE 位置与字号';
  fab.textContent = 'HUD';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'hud-panel-scrim';
  scrim.setAttribute('aria-label', '关闭 HUD 调参');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'hud-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'hud-panel-head';
  head.innerHTML = `
    <span class="hud-panel-title">HUD 布局</span>
    <div class="hud-panel-head-actions">
      <button type="button" class="hud-panel-btn" data-hud-reset>重置</button>
      <button type="button" class="hud-panel-btn hud-panel-btn-primary" data-hud-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'hud-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, valueEl: HTMLElement, format: (v: number) => string }>} */
  const controls = new Map();

  for (const group of HUD_TUNE_FIELDS) {
    const g = document.createElement('div');
    g.className = 'hud-panel-group';
    const title = document.createElement('div');
    title.className = 'hud-panel-group-title';
    title.textContent = group.group;
    g.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'hud-panel-row';
      row.dataset.key = field.key;

      const top = document.createElement('div');
      top.className = 'hud-panel-row-top';
      const label = document.createElement('span');
      label.className = 'hud-panel-label';
      label.textContent = field.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'hud-panel-value';
      top.appendChild(label);
      top.appendChild(valueEl);

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'hud-panel-range';
      range.min = String(field.min);
      range.max = String(field.max);
      range.step = String(field.step);
      range.setAttribute('aria-label', field.label);

      const format = field.format || ((v) => String(v));
      controls.set(field.key, { range, valueEl, format });

      range.addEventListener('input', () => {
        const v = Number(range.value);
        setHudTune({ [field.key]: v });
        valueEl.textContent = format(v);
        applyHudTuneCss(hudEl);
        onChange();
      });

      row.appendChild(top);
      row.appendChild(range);
      g.appendChild(row);
    }
    body.appendChild(g);
  }

  sheet.appendChild(head);
  sheet.appendChild(body);
  root.appendChild(fab);
  root.appendChild(scrim);
  root.appendChild(sheet);
  mount.appendChild(root);

  function syncFromState() {
    const t = getHudTune();
    for (const [key, ctl] of controls) {
      const v = Number(t[/** @type {keyof typeof t} */ (key)]);
      if (!Number.isFinite(v)) continue;
      ctl.range.value = String(v);
      ctl.valueEl.textContent = ctl.format(v);
    }
    applyHudTuneCss(hudEl);
  }

  function setOpen(open) {
    root.classList.toggle('is-collapsed', !open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    sheet.hidden = !open;
  }

  // 与 feel-panel 一致：阻断冒泡，否则 game 在 #phone-frame 上抢 pointer
  for (const el of [fab, scrim, sheet, head, body]) {
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
      el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    }
  }

  fab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(root.classList.contains('is-collapsed'));
  });
  scrim.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-hud-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-hud-reset]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetHudTune();
    syncFromState();
    onChange();
  });

  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

  onHudTuneChange(() => {
    /* 外部改参时同步 UI（少见） */
  });

  syncFromState();

  return {
    root,
    open: () => setOpen(true),
    close: () => setOpen(false),
    sync: syncFromState,
    dispose() {
      root.remove();
    },
  };
}
