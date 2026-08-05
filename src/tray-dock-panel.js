/**
 * 候选区白底 dock 调参面板（独立于 feel / hud）
 * 入口：左下角「Tray」
 */
import {
  getTrayDockTune,
  onTrayDockTuneChange,
  resetTrayDockTune,
  setTrayDockTune,
  TRAY_DOCK_TUNE_FIELDS,
} from './game/tray-dock-tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: () => void,
 * }} opts
 */
export function createTrayDockPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'tray-dock-panel';
  root.className = 'tray-dock-panel is-collapsed';
  root.setAttribute('aria-label', '候选区白底调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'tray-dock-panel-fab';
  fab.setAttribute('aria-label', '候选区白底调参');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = '候选区白色底条';
  fab.textContent = 'Tray';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'tray-dock-panel-scrim';
  scrim.setAttribute('aria-label', '关闭 Tray 调参');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'tray-dock-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'tray-dock-panel-head';
  head.innerHTML = `
    <span class="tray-dock-panel-title">候选区白底</span>
    <div class="tray-dock-panel-head-actions">
      <button type="button" class="tray-dock-panel-btn" data-tray-reset>重置</button>
      <button type="button" class="tray-dock-panel-btn tray-dock-panel-btn-primary" data-tray-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'tray-dock-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, valueEl: HTMLElement, format: (v: number) => string }>} */
  const controls = new Map();

  for (const group of TRAY_DOCK_TUNE_FIELDS) {
    const g = document.createElement('div');
    g.className = 'tray-dock-panel-group';
    const title = document.createElement('div');
    title.className = 'tray-dock-panel-group-title';
    title.textContent = group.group;
    g.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'tray-dock-panel-row';

      const top = document.createElement('div');
      top.className = 'tray-dock-panel-row-top';
      const label = document.createElement('span');
      label.className = 'tray-dock-panel-label';
      label.textContent = field.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'tray-dock-panel-value';
      top.appendChild(label);
      top.appendChild(valueEl);

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'tray-dock-panel-range';
      range.min = String(field.min);
      range.max = String(field.max);
      range.step = String(field.step);
      range.setAttribute('aria-label', field.label);

      const format = field.format || ((v) => String(v));
      controls.set(field.key, { range, valueEl, format });

      range.addEventListener('input', () => {
        const v = Number(range.value);
        setTrayDockTune({ [field.key]: v });
        valueEl.textContent = format(v);
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
    const t = getTrayDockTune();
    for (const [key, ctl] of controls) {
      const v = Number(t[/** @type {keyof typeof t} */ (key)]);
      if (!Number.isFinite(v)) continue;
      ctl.range.value = String(v);
      ctl.valueEl.textContent = ctl.format(v);
    }
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
  head.querySelector('[data-tray-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-tray-reset]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTrayDockTune();
    syncFromState();
    onChange();
  });

  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

  onTrayDockTuneChange(() => {});

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
