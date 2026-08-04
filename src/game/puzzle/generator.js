/**
 * Puzzle-fill mode generator.
 *
 * Builds an 8x8 board with three missing polyominoes. The tray is exactly
 * those missing pieces, so the first version is always solvable and easy to
 * evaluate by feel.
 */
import { GRID, PIECE_PALETTE } from '../defaults.js';
import {
  countCells,
  FORM_FAMILIES,
  makePiece,
  matrixSize,
} from '../forms.js';

const BOARD_PALETTES = [
  [0x89c95f, 0x78bd54, 0x9ad96c, 0x6fb14c],
  [0x67b7dc, 0x4fa3d1, 0x82cbed, 0x3f90bf],
  [0xd99a58, 0xc9843f, 0xedb36f, 0xb97535],
  [0xb786d9, 0xa06dcc, 0xc79ce8, 0x8f5fbd],
  [0xd96f86, 0xc95772, 0xea8fa2, 0xb94762],
  [0x69c7ad, 0x51b89d, 0x84d9c2, 0x43a98f],
];
const PIECE_SET_COLORS = [0xf3c739, 0xee443b, 0x2296df, 0x28b965];
const VARIANT_PIECE_COLORS = [
  0xf3c739,
  0xee443b,
  0x2296df,
  0x28b965,
  0xf39a2f,
  0x54d6bd,
  0xa98cff,
  0xff74a6,
];
const BLOCKBLAST_FORMS = [
  { id: 'bb_square2', family: 200, matrix: [[1, 1], [1, 1]] },
  { id: 'bb_line2', family: 201, matrix: [[1, 1]] },
  { id: 'bb_line3', family: 202, matrix: [[1, 1, 1]] },
  { id: 'bb_line4', family: 203, matrix: [[1, 1, 1, 1]] },
  { id: 'bb_line5', family: 204, matrix: [[1, 1, 1, 1, 1]] },
  { id: 'bb_l3', family: 205, matrix: [[1, 0], [1, 1]] },
  { id: 'bb_l4', family: 206, matrix: [[1, 0], [1, 0], [1, 1]] },
  { id: 'bb_l5', family: 207, matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
  { id: 'bb_t4', family: 208, matrix: [[0, 1, 0], [1, 1, 1]] },
  { id: 'bb_z4', family: 209, matrix: [[0, 1, 1], [1, 1, 0]] },
  { id: 'bb_rect6', family: 210, matrix: [[1, 1, 1], [1, 1, 1]] },
  { id: 'bb_square9', family: 211, matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
];
const SUPER_BLOCK_GROUPS = [
  [
    { id: 'yellow_step6', family: 100, matrix: [[1, 1, 1, 0], [0, 1, 1, 1]] },
    { id: 'yellow_i4', family: 101, matrix: [[1, 1, 1, 1]] },
    { id: 'yellow_u6', family: 102, matrix: [[1, 0, 1], [1, 1, 1], [0, 1, 0]] },
    { id: 'yellow_plus', family: 103, matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] },
  ],
  [
    { id: 'red_u', family: 104, matrix: [[1, 0, 1], [1, 1, 1]] },
    { id: 'red_l5', family: 105, matrix: [[1, 0, 0, 0], [1, 1, 1, 1]] },
    { id: 'red_stair', family: 106, matrix: [[0, 0, 1], [0, 1, 1], [1, 1, 1]] },
    { id: 'red_plus6', family: 107, matrix: [[0, 1, 1], [1, 1, 1], [0, 1, 0]] },
  ],
  [
    { id: 'blue_bridge6', family: 108, matrix: [[0, 1, 1, 0], [1, 1, 1, 1]] },
    { id: 'blue_long_t6', family: 109, matrix: [[0, 1, 0, 0], [1, 1, 1, 1], [0, 1, 0, 0]] },
    { id: 'blue_l5', family: 110, matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },
    { id: 'blue_z', family: 111, matrix: [[0, 1, 1], [1, 1, 0]] },
  ],
  [
    { id: 'green_p5', family: 112, matrix: [[1, 1, 0], [1, 1, 1]] },
    { id: 'green_u6', family: 113, matrix: [[1, 0, 0, 1], [1, 1, 1, 1]] },
    { id: 'green_stair', family: 114, matrix: [[0, 0, 1], [0, 1, 1], [1, 1, 0]] },
    { id: 'green_t5', family: 115, matrix: [[0, 1, 0], [0, 1, 0], [1, 1, 1]] },
  ],
];

const PRESET_PUZZLES = [
  // Early: one color, 3 pieces. Coordinates are row/col on the 8x8 board.
  {
    mask: [
      '........',
      '...#.#..',
      '..####..',
      '..####..',
      '........',
      '..#..#..',
      '.#####..',
      '.#####..',
    ],
    tray: [
      { group: 1, index: 0 },
      { group: 1, index: 2 },
      { group: 1, index: 3 },
      { group: 1, index: 1 },
    ],
  },
  {
    mask: [
      '........',
      '.####...',
      '######..',
      '.#......',
      '....#...',
      '..###...',
      '.##.#...',
      '..###...',
    ],
    tray: [
      { group: 0, index: 0 },
      { group: 0, index: 2 },
      { group: 0, index: 3 },
      { group: 0, index: 1 },
    ],
  },
  {
    mask: [
      '........',
      '........',
      '#.......',
      '###.....',
      '###..#..',
      '####.###',
      '..#...##',
      '.....###',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 1 },
      { group: 2, index: 2 },
      { group: 2, index: 3 },
    ],
  },
  {
    mask: [
      '........',
      '...##...',
      '..###...',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '........',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 1 },
      { group: 2, index: 2 },
      { group: 2, index: 3 },
    ],
  },
  {
    mask: [
      '........',
      '..##....',
      '.###....',
      '#####...',
      '......##',
      '.....###',
      '.....###',
      '.....###',
    ],
    tray: [
      { group: 3, index: 0 },
      { group: 3, index: 1 },
      { group: 3, index: 2 },
      { group: 3, index: 3 },
    ],
  },
  // Mid: two color families. These start testing piece selection plus rotation.
  {
    mask: [
      '........',
      '####....',
      '#####...',
      '.####...',
      '.####...',
      '..###...',
      '....#...',
      '........',
    ],
    tray: [
      { group: 3, index: 0 },
      { group: 3, index: 1 },
      { group: 3, index: 2 },
      { group: 3, index: 3 },
    ],
  },
  {
    mask: [
      '.......#',
      '.....###',
      '.....###',
      '....###.',
      '.....#..',
      '#..#....',
      '####....',
      '####....',
    ],
    tray: [
      { group: 2, index: 1 },
      { group: 2, index: 2 },
      { group: 3, index: 0 },
      { group: 3, index: 3 },
    ],
  },
  {
    mask: [
      '.##.....',
      '####....',
      '###...#.',
      '....####',
      '#...###.',
      '###.###.',
      '###.....',
      '####....',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 1 },
      { group: 2, index: 3 },
      { group: 3, index: 0 },
      { group: 3, index: 2 },
      { group: 3, index: 3 },
    ],
  },
  {
    mask: [
      '..###...',
      '.####...',
      '..##....',
      '......##',
      '####.###',
      '####.###',
      '####.###',
      '####....',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 2 },
      { group: 2, index: 3 },
      { group: 3, index: 0 },
      { group: 3, index: 1 },
      { group: 3, index: 2 },
      { group: 3, index: 3 },
    ],
  },
  {
    mask: [
      '.......#',
      '...#.###',
      '...#####',
      '.#..###.',
      '###.###.',
      '###..#..',
      '####....',
      '####....',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 1 },
      { group: 2, index: 2 },
      { group: 2, index: 3 },
      { group: 0, index: 0 },
      { group: 0, index: 1 },
      { group: 0, index: 2 },
      { group: 0, index: 3 },
    ],
  },
  {
    mask: [
      '........',
      '........',
      '........',
      '........',
      '....####',
      '..######',
      '.#######',
      '..######',
    ],
    tray: [
      { group: 2, index: 0 },
      { group: 2, index: 1 },
      { group: 2, index: 2 },
      { group: 2, index: 3 },
      { group: 0, index: 0 },
      { group: 0, index: 1 },
      { group: 0, index: 2 },
      { group: 0, index: 3 },
    ],
  },
];

/**
 * @typedef {{
 *   board: (number|null)[][],
 *   tray: import('../forms.js').PieceDef[],
 *   level: number,
 *   missingCells: number,
 * }} PuzzleState
 */

function emptyBoard() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function canPlace(board, matrix, row, col) {
  const { rows, cols } = matrixSize(matrix);
  if (row < 0 || col < 0 || row + rows > GRID || col + cols > GRID) return false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      if (board[row + r][col + c] != null) return false;
    }
  }
  return true;
}

function stamp(board, matrix, row, col, value) {
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c]) board[row + r][col + c] = value;
    }
  }
}

function touchCount(board, matrix, row, col) {
  let n = 0;
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      const gr = row + r;
      const gc = col + c;
      for (const [dr, dc] of dirs) {
        const nr = gr + dr;
        const nc = gc + dc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (board[nr][nc] != null) n++;
      }
    }
  }
  return n;
}

function componentCount(board) {
  const seen = new Set();
  let count = 0;
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let sr = 0; sr < GRID; sr++) {
    for (let sc = 0; sc < GRID; sc++) {
      if (board[sr][sc] == null || seen.has(`${sr},${sc}`)) continue;
      count++;
      const stack = [[sr, sc]];
      seen.add(`${sr},${sc}`);
      while (stack.length) {
        const [r, c] = stack.pop();
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          const key = `${nr},${nc}`;
          if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
          if (board[nr][nc] == null || seen.has(key)) continue;
          seen.add(key);
          stack.push([nr, nc]);
        }
      }
    }
  }
  return count;
}

function comfortProfile(board) {
  let count = 0;
  let edge = 0;
  let minR = GRID;
  let maxR = -1;
  let minC = GRID;
  let maxC = -1;
  let sumR = 0;
  let sumC = 0;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] == null) continue;
      count += 1;
      sumR += r;
      sumC += c;
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      if (r === 0 || r === GRID - 1 || c === 0 || c === GRID - 1) edge += 1;
    }
  }
  if (!count) return null;
  return {
    count,
    edge,
    minR,
    maxR,
    minC,
    maxC,
    rows: maxR - minR + 1,
    cols: maxC - minC + 1,
    centerDist: Math.abs(sumR / count - 3.5) + Math.abs(sumC / count - 3.5),
  };
}

function passesComfort(level, board, attempt) {
  const p = comfortProfile(board);
  if (!p) return false;

  if (level <= 2) {
    if (p.edge > 0 && attempt < 360) return false;
    if ((p.rows > 4 || p.cols > 4 || p.centerDist > 2.2) && attempt < 390) return false;
    return true;
  }

  if (level <= 5) {
    if (p.edge > 0 && attempt < 320) return false;
    if ((p.rows > 6 || p.cols > 6 || p.centerDist > 2.6) && attempt < 370) return false;
    return true;
  }

  if (level <= 10) {
    if (p.edge > Math.max(1, Math.floor(p.count * 0.12)) && attempt < 260) return false;
    if (p.centerDist > 3.1 && attempt < 330) return false;
  }

  return true;
}

function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rotateMatrixCW(matrix) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = matrix[r][c];
  }
  return out;
}

function rotateForm(form, turns) {
  let matrix = form.matrix.map((row) => row.slice());
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) matrix = rotateMatrixCW(matrix);
  return {
    ...form,
    id: `${form.id}_r${n}`,
    matrix,
    rotationTurns: n,
  };
}

function boardPaletteForLevel(level) {
  return BOARD_PALETTES[(Math.max(1, level) - 1) % BOARD_PALETTES.length];
}

function makeBoardColor(row, col, rng, level) {
  const palette = boardPaletteForLevel(level);
  const base = palette[(row + col + Math.floor(rng() * 2)) % palette.length];
  return base;
}

function colorFamily(color) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 28) return 'neutral';
  if (r >= g && r >= b) return g > b + 28 ? 'orange' : 'red';
  if (g >= r && g >= b) return b > r + 22 ? 'cyan' : 'green';
  return r > g + 20 ? 'purple' : 'blue';
}

function pieceGroupForLevel(level) {
  return (Math.max(1, level) - 1) % SUPER_BLOCK_GROUPS.length;
}

function puzzlePieceCount(level) {
  if (level <= 1) return 1;
  if (level <= 2) return 2;
  if (level <= 8) return 3;
  if (level <= 18) return 4;
  if (level <= 25) return 5;
  if (level <= 32) return 6;
  if (level <= 39) return 7;
  return 8;
}

function isMilestoneLevel(level) {
  return level >= 6 && (level - 1) % 5 === 0;
}

function allVariantForms() {
  const superForms = SUPER_BLOCK_GROUPS.flat();
  const canonicalBlockBlast = [
    ...BLOCKBLAST_FORMS,
    // Reuse a few already tuned Block Blast forms so the variant pool has
    // familiar shapes without relying on their original color meaning.
    FORM_FAMILIES[3][0],
    FORM_FAMILIES[4][0],
    FORM_FAMILIES[5][0],
    FORM_FAMILIES[6][0],
  ];
  const seen = new Set();
  const out = [];
  for (const form of [...canonicalBlockBlast, ...superForms]) {
    const key = form.matrix.map((row) => row.join('')).join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(form);
  }
  return out;
}

const VARIANT_FORMS = allVariantForms();
const EARLY_FRIENDLY_FORM_IDS = new Set([
  'bb_line2',
  'bb_line3',
  'bb_line4',
  'bb_square2',
  'bb_l3',
  'bb_l4',
  'bb_t4',
]);
const EARLY_ROTATION_FORM_IDS = new Set(['bb_l3', 'bb_l4', 'bb_t4']);

function requiredEarlyRotations(level) {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level === 5) return 2;
  return 0;
}

function earlyRotationTurns(level, index) {
  const required = requiredEarlyRotations(level);
  if (index >= required) return 0;
  return index % 2 === 0 ? 1 : 3;
}

function shapeRole(form) {
  const id = form.id || '';
  if (id.includes('line') || id.includes('_i')) return 'line';
  if (id.includes('square') || id.includes('rect')) return 'rect';
  if (id.includes('_t') || id.includes('plus')) return 'tee';
  if (id.includes('_z') || id.includes('step') || id.includes('stair')) return 'skew';
  if (id.includes('_u')) return 'u';
  if (id.includes('_l') || id.includes('bridge') || id.includes('_p')) return 'corner';
  return `area${countCells(form.matrix)}`;
}

function roleLimitForLevel(level, role) {
  if (level <= 5) return 1;
  if (level <= 15) return role === 'line' || role === 'rect' ? 1 : 2;
  return 2;
}

function fillWithDiverseForms(picked, pool, count, rng, level) {
  const shuffled = shuffle(pool, rng);
  for (const form of shuffled) {
    if (picked.length >= count) break;
    const role = shapeRole(form);
    const roleCount = picked.filter((p) => shapeRole(p) === role).length;
    if (roleCount >= roleLimitForLevel(level, role)) continue;
    if (level <= 5 && role === 'line' && picked.length > 0) continue;
    if (picked.some((p) => p.id === form.id)) continue;
    picked.push(form);
  }
  for (const form of shuffled) {
    if (picked.length >= count) break;
    if (level <= 5 && shapeRole(form) === 'line' && picked.length > 0) continue;
    if (picked.some((p) => p.id === form.id)) continue;
    picked.push(form);
  }
  while (picked.length < count) picked.push(pool[Math.floor(rng() * pool.length)] || VARIANT_FORMS[0]);
  return picked;
}

function formsForVariantLevel(level, rng) {
  const count = puzzlePieceCount(level);
  const milestone = isMilestoneLevel(level);
  let pool = VARIANT_FORMS;

  if (level <= 5) {
    pool = VARIANT_FORMS.filter((form) => EARLY_FRIENDLY_FORM_IDS.has(form.id));
    const rotationPool = shuffle(pool.filter((form) => EARLY_ROTATION_FORM_IDS.has(form.id)), rng);
    const easyPool = shuffle(pool.filter((form) => !EARLY_ROTATION_FORM_IDS.has(form.id)), rng);
    const picked = [];
    const rotateCount = requiredEarlyRotations(level);
    for (let i = 0; i < rotateCount && rotationPool.length; i++) picked.push(rotationPool.shift());
    for (const form of [...easyPool, ...rotationPool]) {
      if (picked.length >= count) break;
      if (picked.some((p) => shapeRole(p) === shapeRole(form))) continue;
      picked.push(form);
    }
    return fillWithDiverseForms(picked, pool, count, rng, level);
  } else if (level === 6) {
    pool = VARIANT_FORMS.filter((form) => countCells(form.matrix) >= 5 && countCells(form.matrix) <= 6);
  } else if (level <= 8) {
    pool = VARIANT_FORMS.filter((form) => countCells(form.matrix) <= 6);
  } else if (!milestone) {
    pool = VARIANT_FORMS.filter((form) => countCells(form.matrix) <= 7);
  }

  const picked = [];
  const shuffled = shuffle(pool, rng);
  const roleCounts = new Map();
  for (const form of shuffled) {
    const area = countCells(form.matrix);
    const total = picked.reduce((sum, f) => sum + countCells(f.matrix), 0);
    const role = shapeRole(form);
    const roleCount = roleCounts.get(role) || 0;
    if (roleCount >= roleLimitForLevel(level, role)) continue;
    if (count >= 6 && total + area > 42) continue;
    picked.push(form);
    roleCounts.set(role, roleCount + 1);
    if (picked.length === count) break;
  }

  return fillWithDiverseForms(picked, pool, count, rng, level);
}

function formsForLevel(level, rng) {
  const groupIndex = pieceGroupForLevel(level);
  const group = SUPER_BLOCK_GROUPS[groupIndex];
  return shuffle(group, rng).slice(0, 3);
}

function randomPieceColor(rng) {
  return VARIANT_PIECE_COLORS[Math.floor(rng() * VARIANT_PIECE_COLORS.length)] || PIECE_PALETTE[0];
}

function makeColoredPiece(form, color = null, rng = Math.random) {
  const piece = makePiece(form);
  piece.color = color || randomPieceColor(rng);
  piece.cellColors = piece.matrix.map((row) => row.map((v) => (v ? piece.color : 0)));
  return piece;
}

function makeTrayPieces(forms, rng, bannedFamilies = new Set()) {
  const byFamily = new Map();
  for (const color of shuffle(VARIANT_PIECE_COLORS, rng)) {
    const family = colorFamily(color);
    if (bannedFamilies.has(family)) continue;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(color);
  }
  let colors = Array.from(byFamily.values()).map((familyColors) => familyColors[0]);
  colors = shuffle(colors, rng);
  if (colors.length < forms.length) {
    const extras = Array.from(byFamily.values()).flat().filter((color) => !colors.includes(color));
    colors = colors.concat(shuffle(extras, rng));
  }
  if (!colors.length) colors = shuffle(VARIANT_PIECE_COLORS, rng);
  return forms.map((form, index) => makeColoredPiece(form, colors[index % colors.length], rng));
}

function formFromSpec(spec) {
  return SUPER_BLOCK_GROUPS[spec.group]?.[spec.index] || SUPER_BLOCK_GROUPS[0][0];
}

function makeBoardForLevel(level, rng) {
  const board = emptyBoard();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      board[r][c] = makeBoardColor(r, c, rng, level);
    }
  }
  return board;
}

function createPresetPuzzle(level, rng) {
  const preset = PRESET_PUZZLES[level - 1];
  if (!preset) return null;
  let missingCells = 0;
  const boardFamily = colorFamily(boardPaletteForLevel(level)[0]);
  const trayBannedFamilies = new Set([boardFamily]);

  if (preset.mask?.length) {
    const tray = makeTrayPieces(
      (preset.tray || []).map((spec) => formFromSpec(spec)),
      rng,
      trayBannedFamilies,
    );
    const board = makeBoardForLevel(level, rng);
    for (let r = 0; r < GRID; r++) {
      const row = preset.mask[r] || '';
      for (let c = 0; c < GRID; c++) {
        if (row[c] === '#') {
          board[r][c] = null;
          missingCells += 1;
        }
      }
    }
    return { board, tray, level, missingCells };
  }

  const tray = makeTrayPieces(
    preset.map((spec) => formFromSpec(spec)),
    rng,
    trayBannedFamilies,
  );
  const board = makeBoardForLevel(level, rng);
  for (const spec of preset) {
    const form = rotateForm(formFromSpec(spec), spec.rot || 0);
    stamp(board, form.matrix, spec.row, spec.col, null);
    missingCells += countCells(form.matrix);
  }
  return { board, tray, level, missingCells };
}

function createVariantPuzzle(level, rng) {
  const pieceCount = puzzlePieceCount(level);
  const milestone = isMilestoneLevel(level);
  const early = level <= 5;
  const boardFamily = colorFamily(boardPaletteForLevel(level)[0]);
  const trayBannedFamilies = new Set([boardFamily]);
  const maxComponents = milestone ? 1 : level === 5 ? 2 : early ? 3 : 1;
  const minTouches = level === 6 ? 4 : milestone ? 3 : level === 5 ? 1 : early ? 0 : 2;

  for (let attempt = 0; attempt < 420; attempt++) {
    const missingMask = emptyBoard();
    /** @type {{ form: import('../forms.js').FormDef, trayForm: import('../forms.js').FormDef, row: number, col: number }[]} */
    const removals = [];
    const forms = formsForVariantLevel(level, rng);

    for (let i = 0; i < pieceCount; i++) {
      const trayForm = forms[i];
      const form = early
        ? rotateForm(trayForm, earlyRotationTurns(level, i))
        : rotateForm(trayForm, Math.floor(rng() * 4));
      const { rows, cols } = matrixSize(form.matrix);
      let placed = false;

      for (let tries = 0; tries < 120; tries++) {
        const rowMin = early && rows < GRID - 1 ? 1 : 0;
        const colMin = early && cols < GRID - 1 ? 1 : 0;
        const rowMax = early && rows < GRID - 1 ? GRID - rows - 1 : GRID - rows;
        const colMax = early && cols < GRID - 1 ? GRID - cols - 1 : GRID - cols;
        const row = rowMin + Math.floor(rng() * (Math.max(0, rowMax - rowMin) + 1));
        const col = colMin + Math.floor(rng() * (Math.max(0, colMax - colMin) + 1));
        if (!canPlace(missingMask, form.matrix, row, col)) continue;
        if (i > 0 && touchCount(missingMask, form.matrix, row, col) < minTouches) continue;

        stamp(missingMask, form.matrix, row, col, 1);
        removals.push({ form, trayForm, row, col });
        placed = true;
        break;
      }

      if (!placed) break;
    }

    if (removals.length !== pieceCount) continue;
    if (componentCount(missingMask) > maxComponents) continue;
    if (!passesComfort(level, missingMask, attempt)) continue;

    const missingCells = removals.reduce((sum, p) => sum + countCells(p.form.matrix), 0);
    const minMissing = pieceCount <= 2 ? pieceCount * 3 : pieceCount * 4;
    if (missingCells < minMissing && attempt < 320) continue;

    const tray = makeTrayPieces(
      shuffle(removals, rng).map((p) => p.trayForm),
      rng,
      trayBannedFamilies,
    );
    const full = makeBoardForLevel(level, rng);
    for (const p of removals) stamp(full, p.form.matrix, p.row, p.col, null);

    return {
      board: full,
      tray,
      level,
      missingCells,
    };
  }

  const forms = formsForVariantLevel(level, rng);
  const tray = makeTrayPieces(forms, rng, trayBannedFamilies);
  const full = makeBoardForLevel(level, rng);
  let col = 0;
  let row = 0;
  let missingCells = 0;
  for (const form of forms) {
    const { rows, cols } = matrixSize(form.matrix);
    if (col + cols > GRID) {
      row += 2;
      col = 0;
    }
    if (row + rows > GRID) break;
    stamp(full, form.matrix, row, col, null);
    missingCells += countCells(form.matrix);
    col += cols + 1;
  }

  return {
    board: full,
    tray,
    level,
    missingCells,
  };
}

/**
 * @param {number} level
 * @param {() => number} [rng]
 * @returns {PuzzleState}
 */
export function createPuzzle(level = 1, rng = Math.random) {
  return createVariantPuzzle(level, rng);

  for (let attempt = 0; attempt < 240; attempt++) {
    const missingMask = emptyBoard();
    /** @type {{ form: import('../forms.js').FormDef, trayForm: import('../forms.js').FormDef, row: number, col: number }[]} */
    const removals = [];
    const forms = formsForLevel(level, rng);

    for (let i = 0; i < 3; i++) {
      const trayForm = forms[i];
      const form = rotateForm(trayForm, Math.floor(rng() * 4));
      const { rows, cols } = matrixSize(form.matrix);
      let placed = false;
      for (let tries = 0; tries < 80; tries++) {
        const row = Math.floor(rng() * (GRID - rows + 1));
        const col = Math.floor(rng() * (GRID - cols + 1));
        if (!canPlace(missingMask, form.matrix, row, col)) continue;
        if (i > 0) {
          const touches = touchCount(missingMask, form.matrix, row, col);
          const minTouches = level < 5 ? 1 : 2;
          if (touches < minTouches) continue;
        }
        stamp(missingMask, form.matrix, row, col, 1);
        removals.push({ form, trayForm, row, col });
        placed = true;
        break;
      }
      if (!placed) break;
    }

    if (removals.length !== 3) continue;

    const missingCells = removals.reduce((sum, p) => sum + countCells(p.form.matrix), 0);
    const minMissing = level < 5 ? 12 : 14;
    if (missingCells < minMissing && attempt < 200) continue;
    if (componentCount(missingMask) !== 1) continue;

    const full = emptyBoard();
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        full[r][c] = makeBoardColor(r, c, rng, level);
      }
    }
    for (const p of removals) stamp(full, p.form.matrix, p.row, p.col, null);

    const pieceColor = PIECE_SET_COLORS[pieceGroupForLevel(level)] || PIECE_PALETTE[0];
    const tray = shuffle(removals, rng).map((p) => makeColoredPiece(p.trayForm, pieceColor));

    return { board: full, tray, level, missingCells };
  }

  // Deterministic fallback: three simple holes in an otherwise full board.
  const board = emptyBoard();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      board[r][c] = makeBoardColor(r, c, rng, level);
    }
  }
  const forms = formsForLevel(level, rng);
  const origins = [
    [0, 0],
    [3, 2],
    [5, 5],
  ];
  forms.forEach((form, i) => stamp(board, form.matrix, origins[i][0], origins[i][1], null));
  return {
    board,
    tray: forms.map((form) => makeColoredPiece(form, PIECE_SET_COLORS[pieceGroupForLevel(level)])),
    level,
    missingCells: forms.reduce((sum, form) => sum + countCells(form.matrix), 0),
  };
}
