export const CANDY_TYPES = ["berry", "lemon", "grape", "apple", "orange", "blueberry"] as const;
export type Candy = (typeof CANDY_TYPES)[number];
export type Board = (Candy | null)[][];
export type Difficulty = "easy" | "medium" | "hard";
export type Phase = "ready" | "running" | "resolving" | "paused" | "level-complete" | "won" | "lost";
export type Position = [row: number, column: number];
export type BestPerformance = { score: number; elapsedSeconds: number };
export type State = {
  board: Board;
  difficulty: Difficulty;
  level: number;
  levelCount: number;
  selected: Position | null;
  movesLeft: number;
  movesMade: number;
  score: number;
  target: number;
  elapsedSeconds: number;
  bestScore: number | null;
  bestTimeSeconds: number | null;
  phase: Phase;
  resumePhase: "running" | "resolving";
  matchesToClear: number[];
  gravityPending: boolean;
  cascade: number;
  lastCombo: number;
  lastMatchCount: number;
  reshuffles: number;
  swapAnimationId: number;
  lastSwap: [Position, Position] | null;
  notice: string;
};
export type Action =
  | { type: "select"; row: number; column: number }
  | { type: "swap"; from: Position; to: Position }
  | { type: "resolve" }
  | { type: "tick" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set-difficulty"; difficulty: Difficulty }
  | { type: "set-best-performance"; record: BestPerformance | null }
  | { type: "next-level" }
  | { type: "retry-level" }
  | { type: "reset" };

export const LEVEL_COUNT = 3;
export const BOARD_SIZE: Record<Difficulty, number> = { easy: 6, medium: 7, hard: 8 };
export const MOVES_PER_LEVEL: Record<Difficulty, number> = { easy: 18, medium: 22, hard: 26 };
export const LEVEL_GOALS: Record<Difficulty, number[]> = {
  easy: [900, 1400, 2000],
  medium: [1200, 1800, 2500],
  hard: [1500, 2200, 3000],
};
const POINTS_PER_CANDY = 60;
const BOARD_GENERATION_ATTEMPTS = 160;

export function createState(
  difficulty: Difficulty = "easy",
  random: () => number = Math.random,
  level = 1,
  best: BestPerformance | null = null,
): State {
  return createLevelState(difficulty, level, random, best);
}

export function reduce(state: State, action: Action, random: () => number = Math.random): State {
  if (action.type === "reset") return createLevelState(state.difficulty, 1, random, null);
  if (action.type === "retry-level" && (state.phase === "lost" || state.phase === "level-complete" || state.phase === "won")) {
    return createLevelState(state.difficulty, state.level, random, getBestPerformance(state));
  }
  if (action.type === "next-level" && state.phase === "level-complete" && state.level < state.levelCount) {
    return createLevelState(state.difficulty, state.level + 1, random);
  }
  if (action.type === "set-difficulty" && state.phase === "ready") return createLevelState(action.difficulty, 1, random);
  if (action.type === "set-best-performance") {
    const score = action.record?.score ?? null;
    const elapsedSeconds = action.record?.elapsedSeconds ?? null;
    if (state.bestScore === score && state.bestTimeSeconds === elapsedSeconds) return state;
    return { ...state, bestScore: score, bestTimeSeconds: elapsedSeconds };
  }
  if (action.type === "pause" && (state.phase === "running" || state.phase === "resolving")) {
    return { ...state, phase: "paused", resumePhase: state.phase };
  }
  if (action.type === "resume" && state.phase === "paused") {
    return { ...state, phase: state.resumePhase };
  }
  if (action.type === "tick" && (state.phase === "running" || state.phase === "resolving")) {
    return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
  }
  if (action.type === "resolve" && state.phase === "resolving") {
    return resolveStep(state, random);
  }
  if (action.type === "select" && (state.phase === "ready" || state.phase === "running")) {
    if (!isPositionInBoard(state.board, [action.row, action.column])) return state;
    const next: Position = [action.row, action.column];
    if (!state.selected) return { ...state, selected: next, notice: "" };
    if (samePosition(state.selected, next)) return { ...state, selected: null };
    if (areAdjacent(state.selected, next)) return attemptSwap(state, state.selected, next);
    return { ...state, selected: next, notice: "" };
  }
  if (action.type === "swap" && (state.phase === "ready" || state.phase === "running")) {
    return attemptSwap(state, action.from, action.to);
  }
  return state;
}

export function findMatches(board: Board): Set<number> {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const matches = new Set<number>();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const candy = board[row][column];
      if (candy === null) continue;

      if (column === 0 || board[row][column - 1] !== candy) {
        let end = column + 1;
        while (end < columns && board[row][end] === candy) end += 1;
        if (end - column >= 3) {
          for (let matchColumn = column; matchColumn < end; matchColumn += 1) {
            matches.add(row * columns + matchColumn);
          }
        }
      }

      if (row === 0 || board[row - 1][column] !== candy) {
        let end = row + 1;
        while (end < rows && board[end][column] === candy) end += 1;
        if (end - row >= 3) {
          for (let matchRow = row; matchRow < end; matchRow += 1) {
            matches.add(matchRow * columns + column);
          }
        }
      }
    }
  }
  return matches;
}

export function hasPossibleMove(board: Board): boolean {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (column + 1 < columns && createsMatchAfterSwap(board, [row, column], [row, column + 1])) return true;
      if (row + 1 < rows && createsMatchAfterSwap(board, [row, column], [row + 1, column])) return true;
    }
  }
  return false;
}

export function applyGravity(board: Board, random: () => number = Math.random): Board {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const next = board.map((row) => [...row]);
  for (let column = 0; column < columns; column += 1) {
    const surviving: Candy[] = [];
    for (let row = rows - 1; row >= 0; row -= 1) {
      const candy = board[row][column];
      if (candy !== null) surviving.push(candy);
    }
    for (let row = rows - 1, index = 0; row >= 0; row -= 1, index += 1) {
      next[row][column] = surviving[index] ?? randomCandy(random);
    }
  }
  return next;
}

export function getBestPerformance(state: State): BestPerformance | null {
  if (state.bestScore === null || state.bestTimeSeconds === null) return null;
  return { score: state.bestScore, elapsedSeconds: state.bestTimeSeconds };
}

export function isBetterPerformance(candidate: BestPerformance, previous: BestPerformance | null): boolean {
  return previous === null ||
    candidate.score > previous.score ||
    (candidate.score === previous.score && candidate.elapsedSeconds < previous.elapsedSeconds);
}

function createLevelState(
  difficulty: Difficulty,
  level: number,
  random: () => number,
  best: BestPerformance | null = null,
): State {
  const size = BOARD_SIZE[difficulty];
  if (size === undefined) throw new Error(`Unknown Candy Match difficulty: ${difficulty}`);
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) throw new Error(`Invalid Candy Match level: ${level}`);
  return {
    board: createPlayableBoard(size, size, random),
    difficulty,
    level,
    levelCount: LEVEL_COUNT,
    selected: null,
    movesLeft: MOVES_PER_LEVEL[difficulty],
    movesMade: 0,
    score: 0,
    target: LEVEL_GOALS[difficulty][level - 1],
    elapsedSeconds: 0,
    bestScore: best?.score ?? null,
    bestTimeSeconds: best?.elapsedSeconds ?? null,
    phase: "ready",
    resumePhase: "running",
    matchesToClear: [],
    gravityPending: false,
    cascade: 0,
    lastCombo: 0,
    lastMatchCount: 0,
    reshuffles: 0,
    swapAnimationId: 0,
    lastSwap: null,
    notice: "",
  };
}

function attemptSwap(state: State, from: Position, to: Position): State {
  if (
    !isPositionInBoard(state.board, from) ||
    !isPositionInBoard(state.board, to) ||
    !areAdjacent(from, to)
  ) {
    return { ...state, selected: null, notice: "Choose two neighboring candies." };
  }

  const board = swapCandies(state.board, from, to);
  const matches = findMatches(board);
  if (matches.size === 0) {
    return { ...state, selected: null, notice: "That swap needs to make a match." };
  }

  return {
    ...state,
    board,
    selected: null,
    movesLeft: state.movesLeft - 1,
    movesMade: state.movesMade + 1,
    phase: "resolving",
    matchesToClear: [...matches],
    gravityPending: false,
    cascade: 1,
    lastCombo: 1,
    lastMatchCount: matches.size,
    swapAnimationId: state.swapAnimationId + 1,
    lastSwap: [from, to],
    notice: "",
  };
}

function resolveStep(state: State, random: () => number): State {
  if (state.matchesToClear.length > 0) {
    const board = state.board.map((row) => [...row]);
    for (const index of state.matchesToClear) {
      const row = Math.floor(index / board[0].length);
      const column = index % board[0].length;
      board[row][column] = null;
    }
    const points = state.matchesToClear.length * POINTS_PER_CANDY * state.cascade;
    return {
      ...state,
      board,
      score: state.score + points,
      matchesToClear: [],
      gravityPending: true,
      lastMatchCount: state.matchesToClear.length,
      lastCombo: Math.max(state.lastCombo, state.cascade),
      notice: state.cascade > 1 ? `Combo ×${state.cascade}!` : "Nice match!",
    };
  }

  if (state.gravityPending) {
    const board = applyGravity(state.board, random);
    const matches = findMatches(board);
    if (matches.size > 0) {
      const cascade = state.cascade + 1;
      return {
        ...state,
        board,
        matchesToClear: [...matches],
        gravityPending: false,
        cascade,
        lastCombo: cascade,
        lastMatchCount: matches.size,
        notice: `Combo ×${cascade}!`,
      };
    }
    return finishTurn({ ...state, board, gravityPending: false, cascade: 0 }, random);
  }

  return finishTurn({ ...state, cascade: 0 }, random);
}

function finishTurn(state: State, random: () => number): State {
  if (state.score >= state.target) {
    const phase = state.level === state.levelCount ? "won" : "level-complete";
    return {
      ...state,
      phase,
      bestScore: Math.max(state.bestScore ?? 0, state.score),
      bestTimeSeconds: state.bestScore === null || state.score > state.bestScore
        ? state.elapsedSeconds
        : state.bestScore === state.score
          ? Math.min(state.bestTimeSeconds ?? state.elapsedSeconds, state.elapsedSeconds)
          : state.bestTimeSeconds,
      notice: phase === "won" ? "Puzzle complete!" : `Level ${state.level} complete!`,
    };
  }
  if (state.movesLeft <= 0) {
    return {
      ...state,
      phase: "lost",
      bestScore: Math.max(state.bestScore ?? 0, state.score),
      bestTimeSeconds: state.bestScore === null || state.score > state.bestScore
        ? state.elapsedSeconds
        : state.bestScore === state.score
          ? Math.min(state.bestTimeSeconds ?? state.elapsedSeconds, state.elapsedSeconds)
          : state.bestTimeSeconds,
      notice: "Out of moves. Give it another try!",
    };
  }
  if (!hasPossibleMove(state.board)) {
    return {
      ...state,
      board: createPlayableBoard(state.board.length, state.board[0].length, random),
      phase: "running",
      reshuffles: state.reshuffles + 1,
      notice: "No moves available — the board was reshuffled.",
    };
  }
  return { ...state, phase: "running", notice: state.lastCombo > 1 ? `Combo ×${state.lastCombo}!` : "" };
}

function createPlayableBoard(rows: number, columns: number, random: () => number): Board {
  for (let attempt = 0; attempt < BOARD_GENERATION_ATTEMPTS; attempt += 1) {
    const board: Board = Array.from({ length: rows }, () => Array<Candy | null>(columns).fill(null));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const allowed = CANDY_TYPES.filter((candy) =>
          !wouldCompleteMatch(board, row, column, candy),
        );
        board[row][column] = allowed[Math.floor(randomIndex(random, allowed.length))];
      }
    }
    if (findMatches(board).size === 0 && hasPossibleMove(board)) return board;
  }
  return createGuaranteedPlayableBoard(rows, columns);
}

function createGuaranteedPlayableBoard(rows: number, columns: number): Board {
  const board: Board = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => CANDY_TYPES[(row + column) % 2]),
  );
  board[0][0] = CANDY_TYPES[0];
  board[0][1] = CANDY_TYPES[0];
  board[0][2] = CANDY_TYPES[1];
  board[0][3] = CANDY_TYPES[0];
  board[1][1] = CANDY_TYPES[1];
  board[1][2] = CANDY_TYPES[0];
  if (findMatches(board).size !== 0 || !hasPossibleMove(board)) {
    throw new Error("Unable to generate a stable Candy Match board.");
  }
  return board;
}

function wouldCompleteMatch(board: Board, row: number, column: number, candy: Candy) {
  return (
    (column >= 2 && board[row][column - 1] === candy && board[row][column - 2] === candy) ||
    (row >= 2 && board[row - 1][column] === candy && board[row - 2][column] === candy)
  );
}

function createsMatchAfterSwap(board: Board, first: Position, second: Position) {
  if (board[first[0]][first[1]] === board[second[0]][second[1]]) return false;
  return findMatches(swapCandies(board, first, second)).size > 0;
}

function swapCandies(board: Board, first: Position, second: Position): Board {
  const next = board.map((row) => [...row]);
  const candy = next[first[0]][first[1]];
  next[first[0]][first[1]] = next[second[0]][second[1]];
  next[second[0]][second[1]] = candy;
  return next;
}

function randomCandy(random: () => number): Candy {
  return CANDY_TYPES[randomIndex(random, CANDY_TYPES.length)];
}

function randomIndex(random: () => number, length: number) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("The random source must return a value in the range [0, 1).");
  }
  return Math.floor(value * length);
}

function areAdjacent(first: Position, second: Position) {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) === 1;
}

function isPositionInBoard(board: Board, position: Position) {
  const [row, column] = position;
  return Number.isInteger(row) && Number.isInteger(column) &&
    row >= 0 && row < board.length &&
    column >= 0 && column < (board[0]?.length ?? 0);
}

function samePosition(first: Position, second: Position) {
  return first[0] === second[0] && first[1] === second[1];
}
