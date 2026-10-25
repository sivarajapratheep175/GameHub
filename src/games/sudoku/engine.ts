export type Difficulty = "easy" | "medium" | "hard";
export type Grid = number[][];
export type Notes = number[][][];
export type State = {
  difficulty: Difficulty;
  puzzle: Grid;
  grid: Grid;
  solution: Grid;
  notes: Notes;
  mistakes: number;
  maxMistakes: number;
  hintsUsed: number;
  elapsedSeconds: number;
  paused: boolean;
  finished: boolean;
  failed: boolean;
};

export type Action =
  | { type: "set"; row: number; col: number; value: number }
  | { type: "erase"; row: number; col: number }
  | { type: "toggle-note"; row: number; col: number; value: number }
  | { type: "hint"; row: number; col: number }
  | { type: "tick" }
  | { type: "pause"; paused: boolean }
  | { type: "reset"; difficulty?: Difficulty };

const PUZZLES: Record<Difficulty, Grid> = {
  easy: [
    [5, 3, 0, 0, 7, 0, 0, 0, 0], [6, 0, 0, 1, 9, 5, 0, 0, 0], [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3], [4, 0, 0, 8, 0, 3, 0, 0, 1], [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0], [0, 0, 0, 4, 1, 9, 0, 0, 5], [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ],
  medium: [
    [0, 0, 3, 0, 2, 0, 6, 0, 0], [9, 0, 0, 3, 0, 5, 0, 0, 1], [0, 0, 1, 8, 0, 6, 4, 0, 0],
    [0, 0, 8, 1, 0, 2, 9, 0, 0], [7, 0, 0, 0, 0, 0, 0, 0, 8], [0, 0, 6, 7, 0, 8, 2, 0, 0],
    [0, 0, 2, 6, 0, 9, 5, 0, 0], [8, 0, 0, 2, 0, 3, 0, 0, 9], [0, 0, 5, 0, 1, 0, 3, 0, 0],
  ],
  hard: [
    [0, 0, 0, 0, 0, 0, 9, 0, 7], [0, 0, 0, 4, 2, 0, 1, 8, 0], [0, 0, 0, 7, 0, 5, 0, 2, 6],
    [1, 0, 0, 9, 0, 4, 0, 0, 0], [0, 5, 0, 0, 0, 0, 0, 4, 0], [0, 0, 0, 5, 0, 7, 0, 0, 9],
    [9, 2, 0, 1, 0, 8, 0, 0, 0], [0, 3, 4, 0, 5, 9, 0, 0, 0], [5, 0, 7, 0, 0, 0, 0, 0, 0],
  ],
};

export function createState(difficulty: Difficulty = "easy", maxMistakes = 3): State {
  const puzzle = cloneGrid(PUZZLES[difficulty]);
  const solution = solveGrid(puzzle);
  if (!solution || countSolutions(puzzle) !== 1) throw new Error(`Invalid Sudoku preset: ${difficulty}`);
  return {
    difficulty,
    puzzle,
    grid: cloneGrid(puzzle),
    solution,
    notes: emptyNotes(),
    mistakes: 0,
    maxMistakes,
    hintsUsed: 0,
    elapsedSeconds: 0,
    paused: false,
    finished: false,
    failed: false,
  };
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return createState(action.difficulty ?? state.difficulty, state.maxMistakes);
  if (action.type === "pause") return state.finished || state.failed ? state : { ...state, paused: action.paused };
  if (action.type === "tick") return state.paused || state.finished || state.failed ? state : { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
  if (state.paused || state.finished || state.failed || !inBounds(action.row, action.col) || state.puzzle[action.row][action.col] !== 0) return state;

  if (action.type === "set") {
    if (!Number.isInteger(action.value) || action.value < 1 || action.value > 9) return state;
    if (!isValidMove(state.grid, action.row, action.col, action.value) || action.value !== state.solution[action.row][action.col]) {
      const mistakes = state.mistakes + 1;
      return { ...state, mistakes, failed: mistakes >= state.maxMistakes };
    }
    const grid = cloneGrid(state.grid);
    grid[action.row][action.col] = action.value;
    const notes = clearValueFromNotes(state.notes, action.row, action.col, action.value);
    return { ...state, grid, notes, finished: isSolved(grid, state.solution) };
  }

  if (action.type === "erase") {
    const grid = cloneGrid(state.grid);
    grid[action.row][action.col] = 0;
    return { ...state, grid };
  }

  if (action.type === "toggle-note") {
    if (!Number.isInteger(action.value) || action.value < 1 || action.value > 9 || state.grid[action.row][action.col] !== 0) return state;
    const notes = state.notes.map((row) => row.map((cell) => [...cell]));
    const index = notes[action.row][action.col].indexOf(action.value);
    if (index >= 0) notes[action.row][action.col].splice(index, 1);
    else {
      notes[action.row][action.col].push(action.value);
      notes[action.row][action.col].sort((a, b) => a - b);
    }
    return { ...state, notes };
  }

  if (action.type === "hint") {
    if (state.grid[action.row][action.col] !== 0) return state;
    const grid = cloneGrid(state.grid);
    grid[action.row][action.col] = state.solution[action.row][action.col];
    return { ...state, grid, hintsUsed: state.hintsUsed + 1, finished: isSolved(grid, state.solution) };
  }
  return state;
}

export function isValidMove(grid: Grid, row: number, col: number, value: number): boolean {
  if (!inBounds(row, col) || value < 1 || value > 9) return false;
  for (let index = 0; index < 9; index++) {
    if (index !== col && grid[row][index] === value) return false;
    if (index !== row && grid[index][col] === value) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) for (let c = boxCol; c < boxCol + 3; c++) {
    if ((r !== row || c !== col) && grid[r][c] === value) return false;
  }
  return true;
}

export function isValidGrid(grid: Grid): boolean {
  if (grid.length !== 9 || grid.some((row) => row.length !== 9 || row.some((value) => !Number.isInteger(value) || value < 0 || value > 9))) return false;
  for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
    const value = grid[row][col];
    if (value !== 0) {
      const copy = cloneGrid(grid);
      copy[row][col] = 0;
      if (!isValidMove(copy, row, col, value)) return false;
    }
  }
  return true;
}

export function solveGrid(grid: Grid): Grid | null {
  if (!isValidGrid(grid)) return null;
  const solved = cloneGrid(grid);
  if (solveInPlace(solved)) return solved;
  return null;
}

export function countSolutions(grid: Grid, limit = 2): number {
  if (!isValidGrid(grid)) return 0;
  const copy = cloneGrid(grid);
  let count = 0;
  function search() {
    if (count >= limit) return;
    const cell = findEmpty(copy);
    if (!cell) {
      count++;
      return;
    }
    for (const value of candidates(copy, cell.row, cell.col)) {
      copy[cell.row][cell.col] = value;
      search();
      copy[cell.row][cell.col] = 0;
    }
  }
  search();
  return count;
}

export function getCandidates(grid: Grid, row: number, col: number) {
  if (!inBounds(row, col) || grid[row][col] !== 0) return [];
  return candidates(grid, row, col);
}

export const getScore = (state: State) => state.finished ? Math.max(0, 1000 - state.mistakes * 100 - state.elapsedSeconds - state.hintsUsed * 50) : 0;

function solveInPlace(grid: Grid): boolean {
  const cell = findEmpty(grid);
  if (!cell) return true;
  for (const value of candidates(grid, cell.row, cell.col)) {
    grid[cell.row][cell.col] = value;
    if (solveInPlace(grid)) return true;
    grid[cell.row][cell.col] = 0;
  }
  return false;
}

function candidates(grid: Grid, row: number, col: number) {
  const values: number[] = [];
  for (let value = 1; value <= 9; value++) if (isValidMove(grid, row, col, value)) values.push(value);
  return values;
}

function findEmpty(grid: Grid) {
  for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) if (grid[row][col] === 0) return { row, col };
  return null;
}

function isSolved(grid: Grid, solution: Grid) {
  return grid.every((row, r) => row.every((value, c) => value === solution[r][c]));
}

function emptyNotes(): Notes {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]));
}

function clearValueFromNotes(notes: Notes, row: number, col: number, value: number) {
  const next = notes.map((noteRow) => noteRow.map((cell) => cell.filter((item) => item !== value)));
  next[row][col] = [];
  return next;
}

function cloneGrid(grid: Grid) {
  return grid.map((row) => [...row]);
}

function inBounds(row: number, col: number) {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 9 && col >= 0 && col < 9;
}
