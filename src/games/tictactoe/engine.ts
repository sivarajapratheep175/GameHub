export type Mark = "X" | "O";
export type Board = Array<Mark | null>;
export type Difficulty = "easy" | "medium" | "hard";
export type State = { board: Board; turn: Mark; winner: Mark | "draw" | null; winningLine: number[] | null; scores: Record<Mark, number>; streak: number };
export type Action = { type: "move"; index: number } | { type: "reset" };

export const WIN_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]] as const;

export function createState(): State {
  return { board: Array(9).fill(null), turn: "X", winner: null, winningLine: null, scores: { X: 0, O: 0 }, streak: 0 };
}

export function getWinner(board: Board): { winner: State["winner"]; line: number[] | null } {
  for (const line of WIN_LINES) if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]]) return { winner: board[line[0]], line: [...line] };
  return { winner: board.every(Boolean) ? "draw" : null, line: null };
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return { ...state, board: Array(9).fill(null), turn: "X", winner: null, winningLine: null };
  if (state.winner || !Number.isInteger(action.index) || action.index < 0 || action.index > 8 || state.board[action.index]) return state;
  const board = [...state.board];
  board[action.index] = state.turn;
  const result = getWinner(board);
  return { ...state, board, turn: state.turn === "X" ? "O" : "X", winner: result.winner, winningLine: result.line, scores: result.winner === "X" || result.winner === "O" ? { ...state.scores, [result.winner]: state.scores[result.winner] + 1 } : state.scores, streak: result.winner ? (result.winner === "X" ? state.streak + 1 : 0) : state.streak };
}

export function chooseAiMove(board: Board, difficulty: Difficulty, ai: Mark = "O"): number | null {
  const open = board.flatMap((cell, index) => cell ? [] : [index]);
  if (!open.length) return null;
  if (difficulty === "easy") return open[Math.floor(Math.random() * open.length)];
  if (difficulty === "medium") return findTacticalMove(board, ai) ?? findTacticalMove(board, ai === "X" ? "O" : "X") ?? (board[4] ? open[0] : 4);
  let best = -Infinity;
  let choice = open[0];
  for (const index of open) {
    const next = [...board]; next[index] = ai;
    const score = minimax(next, ai === "X" ? "O" : "X", ai);
    if (score > best) { best = score; choice = index; }
  }
  return choice;
}

function findTacticalMove(board: Board, mark: Mark) {
  for (const index of board.flatMap((cell, i) => cell ? [] : [i])) {
    const next = [...board]; next[index] = mark;
    if (getWinner(next).winner === mark) return index;
  }
  return null;
}

function minimax(board: Board, turn: Mark, ai: Mark): number {
  const result = getWinner(board).winner;
  if (result === ai) return 10;
  if (result && result !== "draw") return -10;
  if (result === "draw") return 0;
  const values = board.flatMap((cell, index) => cell ? [] : [index]).map((index) => {
    const next = [...board]; next[index] = turn;
    return minimax(next, turn === "X" ? "O" : "X", ai);
  });
  return turn === ai ? Math.max(...values) - 1 : Math.min(...values) + 1;
}

export const getScore = (state: State) => state.scores.X * 10 + state.streak * 5;
