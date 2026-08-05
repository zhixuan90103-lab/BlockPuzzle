/**
 * 摆放物样式调参（独立入口「Piece」）
 */
import {
  getPieceTune,
  onPieceTuneChange,
  PIECE_TUNE_FIELDS,
  resetPieceTune,
  setPieceTune,
} from './game/piece-tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: () => void,
 * }} opts
 */
export function createPiecePanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'piece-panel';
  root.className = 'piece-panel is-collapsed';
  root.setAttribute('aria-label', '摆放物样式调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'piece-panel-fab';
  fab.setAttribute('aria-label', '摆放物样式');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = '落子 / 候选块 圆角与体积感';
  fab.textContent = 'Piece';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'piece-panel-scrim';
  scrim.setAttribute('aria-label', '关闭摆放物调参');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'piece-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'piece-panel-head';
  head.innerHTML = `
    <span class="piece-panel-title">摆放物</span>
    <div class="piece-panel-head-actions">
      <button type="button" class="piece-panel-btn" data-piece-reset>重置</button>
      <button type="button" class="piece-panel-btn piece-panel-btn-primary" data-piece-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'piece-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, valueEl: HTMLElement, format: (v: number) => string }>} */
  const controls = new Map();

  for (const group of PIECE_TUNE_FIELDS) {
    const g = document.createElement('div');
    g.className = 'piece-panel-group';
    const title = document.createElement('div');
    title.className = 'piece-panel-group-title';
    title.textContent = group.group;
    g.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'piece-panel-row';

      const top = document.createElement('div');
      top.className = 'piece-panel-row-top';
      const label = document.createElement('span');
      label.className = 'piece-panel-label';
      label.textContent = field.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'piece-panel-value';
      top.appendChild(label);
      top.appendChild(valueEl);

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'piece-panel-range';
      range.min = String(field.min);
      range.max = String(field.max);
      range.step = String(field.step);
      range.setAttribute('aria-label', field.label);

      const format = field.format || ((v) => String(v));
      controls.set(field.key, { range, valueEl, format });

      range.addEventListener('input', () => {
        const v = Number(range.value);
        setPieceTune({ [field.key]: v });
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
    const t = getPieceTune();
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
  head.querySelector('[data-piece-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-piece-reset]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPieceTune();
    syncFromState();
    onChange();
  });

  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  onPieceTuneChange(() => {});
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
