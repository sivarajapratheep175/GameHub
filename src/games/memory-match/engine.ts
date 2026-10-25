export type Difficulty = "easy" | "medium" | "hard";
export type Phase = "ready" | "playing" | "paused" | "finished";
export type PerformanceRecord = { moves: number; elapsedSeconds: number };
export type Card = { id: string; pair: string; flipped: boolean; matched: boolean };
export type State = {
  cards: Card[];
  difficulty: Difficulty;
  rows: number;
  columns: number;
  first: number | null;
  second: number | null;
  moves: number;
  elapsedSeconds: number;
  matchedPairs: number;
  phase: Phase;
  bestMoves: number | null;
  bestTimeSeconds: number | null;
  newRecord: boolean;
};
export type Action =
  | { type: "flip"; index: number }
  | { type: "resolve" }
  | { type: "tick" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set-difficulty"; difficulty: Difficulty }
  | { type: "set-best-performance"; record: PerformanceRecord | null }
  | { type: "reset" };

export const GRID_SIZE: Record<Difficulty, { rows: number; columns: number; label: string }> = {
  easy: { rows: 4, columns: 4, label: "4 × 4" },
  medium: { rows: 4, columns: 6, label: "4 × 6" },
  hard: { rows: 6, columns: 6, label: "6 × 6" },
};

const SYMBOLS = [
  "🍎", "🍋", "🍇", "🍉", "🍒", "🥝", "🍊", "🍓", "🍍",
  "🥑", "🐱", "🐶", "🦊", "🐼", "🐸", "🦁", "🐵", "🐧",
];

export function createState(
  difficulty: Difficulty = "easy",
  random: () => number = Math.random,
  bestRecord: PerformanceRecord | null = null,
): State {
  const grid = GRID_SIZE[difficulty];
  if (!grid) throw new Error(`Unknown Memory Match difficulty: ${difficulty}`);

  const pairCount = (grid.rows * grid.columns) / 2;
  const cards = Array.from({ length: pairCount }, (_, index) => SYMBOLS[index])
    .flatMap((pair) => [pair, pair])
    .map((pair, index) => ({ id: `${pair}-${index}`, pair, flipped: false, matched: false }));
  shuffle(cards, random);

  return {
    cards,
    difficulty,
    rows: grid.rows,
    columns: grid.columns,
    first: null,
    second: null,
    moves: 0,
    elapsedSeconds: 0,
    matchedPairs: 0,
    phase: "ready",
    bestMoves: bestRecord?.moves ?? null,
    bestTimeSeconds: bestRecord?.elapsedSeconds ?? null,
    newRecord: false,
  };
}

export function reduce(state: State, action: Action, random: () => number = Math.random): State {
  if (action.type === "reset") {
    return createState(state.difficulty, random, getBestPerformance(state));
  }

  if (action.type === "set-difficulty" && state.phase === "ready") {
    return createState(action.difficulty, random);
  }

  if (action.type === "set-best-performance") {
    const moves = action.record?.moves ?? null;
    const elapsedSeconds = action.record?.elapsedSeconds ?? null;
    if (state.bestMoves === moves && state.bestTimeSeconds === elapsedSeconds) return state;
    return { ...state, bestMoves: moves, bestTimeSeconds: elapsedSeconds };
  }

  if (action.type === "pause" && state.phase === "playing") return { ...state, phase: "paused" };
  if (action.type === "resume" && state.phase === "paused") return { ...state, phase: "playing" };

  if (action.type === "tick" && state.phase === "playing") {
    return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
  }

  if (action.type === "resolve" && state.phase === "playing" && state.first !== null && state.second !== null) {
    const cards = state.cards.map((card, index) =>
      index === state.first || index === state.second ? { ...card, flipped: false } : card,
    );
    return { ...state, cards, first: null, second: null };
  }

  if (
    action.type !== "flip" ||
    (state.phase !== "ready" && state.phase !== "playing") ||
    state.second !== null ||
    !Number.isInteger(action.index) ||
    action.index < 0 ||
    action.index >= state.cards.length
  ) {
    return state;
  }

  const selected = state.cards[action.index];
  if (selected.flipped || selected.matched) return state;

  const cards = state.cards.map((card, index) =>
    index === action.index ? { ...card, flipped: true } : card,
  );
  if (state.first === null) {
    return { ...state, cards, first: action.index, phase: "playing" };
  }

  const firstIndex = state.first;
  const moves = state.moves + 1;
  if (state.cards[firstIndex].pair !== selected.pair) {
    return { ...state, cards, second: action.index, moves, phase: "playing" };
  }

  const matchedPairs = state.matchedPairs + 1;
  const finished = matchedPairs === state.cards.length / 2;
  const isRecord = finished && isBetterPerformance(
    { moves, elapsedSeconds: state.elapsedSeconds },
    getBestPerformance(state),
  );
  const nextCards = cards.map((card, index) =>
    index === firstIndex || index === action.index ? { ...card, matched: true, flipped: true } : card,
  );

  return {
    ...state,
    cards: nextCards,
    first: null,
    second: null,
    moves,
    matchedPairs,
    phase: finished ? "finished" : "playing",
    bestMoves: isRecord ? moves : state.bestMoves,
    bestTimeSeconds: isRecord ? state.elapsedSeconds : state.bestTimeSeconds,
    newRecord: finished && isRecord,
  };
}

export function getBestPerformance(state: State): PerformanceRecord | null {
  if (state.bestMoves === null || state.bestTimeSeconds === null) return null;
  return { moves: state.bestMoves, elapsedSeconds: state.bestTimeSeconds };
}

export function isBetterPerformance(candidate: PerformanceRecord, previous: PerformanceRecord | null): boolean {
  return previous === null ||
    candidate.moves < previous.moves ||
    (candidate.moves === previous.moves && candidate.elapsedSeconds < previous.elapsedSeconds);
}

function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error("The random source must return a value in the range [0, 1).");
    }
    const swapIndex = Math.floor(value * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
