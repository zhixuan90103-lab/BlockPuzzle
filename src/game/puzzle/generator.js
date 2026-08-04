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

function makeBoardColor(row, col, rng, level) {
  const palette = BOARD_PALETTES[(Math.max(1, level) - 1) % BOARD_PALETTES.length];
  const base = palette[(row + col + Math.floor(rng() * 2)) % palette.length];
  return base;
}

function pieceGroupForLevel(level) {
  return (Math.max(1, level) - 1) % SUPER_BLOCK_GROUPS.length;
}

function formsForLevel(level, rng) {
  const groupIndex = pieceGroupForLevel(level);
  const group = SUPER_BLOCK_GROUPS[groupIndex];
  return shuffle(group, rng).slice(0, 3);
}

function makeColoredPiece(form, color) {
  const piece = makePiece(form);
  piece.color = color;
  piece.cellColors = piece.matrix.map((row) => row.map((v) => (v ? color : 0)));
  return piece;
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
  const board = makeBoardForLevel(level, rng);
  let missingCells = 0;

  if (preset.mask?.length) {
    for (let r = 0; r < GRID; r++) {
      const row = preset.mask[r] || '';
      for (let c = 0; c < GRID; c++) {
        if (row[c] === '#') {
          board[r][c] = null;
          missingCells += 1;
        }
      }
    }
    const tray = (preset.tray || []).map((spec) => {
      const baseForm = formFromSpec(spec);
      const color = PIECE_SET_COLORS[spec.group] || PIECE_PALETTE[0];
      return makeColoredPiece(baseForm, color);
    });
    return { board, tray, level, missingCells };
  }

  for (const spec of preset) {
    const form = rotateForm(formFromSpec(spec), spec.rot || 0);
    stamp(board, form.matrix, spec.row, spec.col, null);
    missingCells += countCells(form.matrix);
  }
  const tray = preset.map((spec) => {
    const baseForm = formFromSpec(spec);
    const color = PIECE_SET_COLORS[spec.group] || PIECE_PALETTE[0];
    return makeColoredPiece(baseForm, color);
  });
  return { board, tray, level, missingCells };
}

/**
 * @param {number} level
 * @param {() => number} [rng]
 * @returns {PuzzleState}
 */
export function createPuzzle(level = 1, rng = Math.random) {
  const preset = createPresetPuzzle(level, rng);
  if (preset) return preset;

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
