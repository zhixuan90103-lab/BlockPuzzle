/**
 * 背景色调参（独立入口「Bg」）
 */
import {
  applyBgTuneCss,
  BG_TUNE_FIELDS,
  getBgTune,
  onBgTuneChange,
  resetBgTune,
  setBgTune,
} from './game/bg-tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: () => void,
 * }} opts
 */
export function createBgPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'bg-panel';
  root.className = 'bg-panel is-collapsed';
  root.setAttribute('aria-label', '背景色调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'bg-panel-fab';
  fab.setAttribute('aria-label', '背景色');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = '背景 RGB';
  fab.textContent = 'Bg';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'bg-panel-scrim';
  scrim.setAttribute('aria-label', '关闭背景调参');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'bg-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'bg-panel-head';
  head.innerHTML = `
    <span class="bg-panel-title">背景色</span>
    <div class="bg-panel-head-actions">
      <button type="button" class="bg-panel-btn" data-bg-reset>重置</button>
      <button type="button" class="bg-panel-btn bg-panel-btn-primary" data-bg-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'bg-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, valueEl: HTMLElement, format: (v: number) => string }>} */
  const controls = new Map();

  for (const group of BG_TUNE_FIELDS) {
    const g = document.createElement('div');
    g.className = 'bg-panel-group';
    const title = document.createElement('div');
    title.className = 'bg-panel-group-title';
    title.textContent = group.group;
    g.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'bg-panel-row';

      const top = document.createElement('div');
      top.className = 'bg-panel-row-top';
      const label = document.createElement('span');
      label.className = 'bg-panel-label';
      label.textContent = field.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'bg-panel-value';
      top.appendChild(label);
      top.appendChild(valueEl);

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'bg-panel-range';
      range.min = String(field.min);
      range.max = String(field.max);
      range.step = String(field.step);
      range.setAttribute('aria-label', field.label);

      const format = field.format || ((v) => String(v));
      controls.set(field.key, { range, valueEl, format });

      range.addEventListener('input', () => {
        const v = Number(range.value);
        setBgTune({ [field.key]: v });
        valueEl.textContent = format(v);
        applyBgTuneCss();
        onChange();
      });

      row.appendChild(top);
      row.appendChild(range);
      g.appendChild(row);
    }
    body.appendChild(g);
  }

  // 色预览条
  const preview = document.createElement('div');
  preview.className = 'bg-panel-preview';
  preview.setAttribute('aria-hidden', 'true');
  body.appendChild(preview);

  function refreshPreview() {
    const t = getBgTune();
    preview.style.background = `linear-gradient(90deg, rgb(${t.LETTERBOX_R},${t.LETTERBOX_G},${t.LETTERBOX_B}) 0 28%, rgb(${t.BG_R},${t.BG_G},${t.BG_B}) 28% 100%)`;
  }

  sheet.appendChild(head);
  sheet.appendChild(body);
  root.appendChild(fab);
  root.appendChild(scrim);
  root.appendChild(sheet);
  mount.appendChild(root);

  function syncFromState() {
    const t = getBgTune();
    for (const [key, ctl] of controls) {
      const v = Number(t[/** @type {keyof typeof t} */ (key)]);
      if (!Number.isFinite(v)) continue;
      ctl.range.value = String(v);
      ctl.valueEl.textContent = ctl.format(v);
    }
    applyBgTuneCss();
    refreshPreview();
  }

  function setOpen(open) {
    root.classList.toggle('is-collapsed', !open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    sheet.hidden = !open;
  }

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
  head.querySelector('[data-bg-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-bg-reset]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetBgTune();
    syncFromState();
    onChange();
  });

  // 滑条时刷新预览
  const origOnChange = onChange;
  body.addEventListener('input', () => refreshPreview());

  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  onBgTuneChange(() => {});
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
