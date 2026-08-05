/**
 * 棋盘调参面板（独立入口「Board」）
 */
import {
  BOARD_TUNE_FIELDS,
  getBoardTune,
  onBoardTuneChange,
  resetBoardTune,
  setBoardTune,
} from './game/board-tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: () => void,
 * }} opts
 */
export function createBoardPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'board-panel';
  root.className = 'board-panel is-collapsed';
  root.setAttribute('aria-label', '棋盘调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'board-panel-fab';
  fab.setAttribute('aria-label', '棋盘调参');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = '棋盘尺寸 / 白框 / 空格 / 阴影';
  fab.textContent = 'Board';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'board-panel-scrim';
  scrim.setAttribute('aria-label', '关闭棋盘调参');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'board-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'board-panel-head';
  head.innerHTML = `
    <span class="board-panel-title">棋盘</span>
    <div class="board-panel-head-actions">
      <button type="button" class="board-panel-btn" data-board-reset>重置</button>
      <button type="button" class="board-panel-btn board-panel-btn-primary" data-board-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'board-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, valueEl: HTMLElement, format: (v: number) => string }>} */
  const controls = new Map();

  for (const group of BOARD_TUNE_FIELDS) {
    const g = document.createElement('div');
    g.className = 'board-panel-group';
    const title = document.createElement('div');
    title.className = 'board-panel-group-title';
    title.textContent = group.group;
    g.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'board-panel-row';

      const top = document.createElement('div');
      top.className = 'board-panel-row-top';
      const label = document.createElement('span');
      label.className = 'board-panel-label';
      label.textContent = field.label;
      const valueEl = document.createElement('span');
      valueEl.className = 'board-panel-value';
      top.appendChild(label);
      top.appendChild(valueEl);

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'board-panel-range';
      range.min = String(field.min);
      range.max = String(field.max);
      range.step = String(field.step);
      range.setAttribute('aria-label', field.label);

      const format = field.format || ((v) => String(v));
      controls.set(field.key, { range, valueEl, format });

      range.addEventListener('input', () => {
        const v = Number(range.value);
        setBoardTune({ [field.key]: v });
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
    const t = getBoardTune();
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
  head.querySelector('[data-board-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(false);
  });
  head.querySelector('[data-board-reset]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetBoardTune();
    syncFromState();
    onChange();
  });

  sheet.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  onBoardTuneChange(() => {});
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
