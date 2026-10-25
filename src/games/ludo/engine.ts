export type Player = 0 | 1 | 2 | 3;
export type Token = { progress: number };
export type State = {
  tokens: Record<Player, Token[]>;
  current: Player;
  dice: number | null;
  winner: Player | null;
  extraTurn: boolean;
  consecutiveSixes: number;
  lastCapture: boolean;
};
export type Action =
  | { type: "roll"; value?: number }
  | { type: "move"; token: number }
  | { type: "reset" };

export const FINISH = 57;
export const TRACK_LENGTH = 52;
export const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47] as const;
export const START_CELLS = [0, 13, 26, 39] as const;
export const PLAYER_COLORS = ["red", "green", "yellow", "blue"] as const;

export function createState(): State {
  return {
    tokens: { 0: baseTokens(), 1: baseTokens(), 2: baseTokens(), 3: baseTokens() },
    current: 0,
    dice: null,
    winner: null,
    extraTurn: false,
    consecutiveSixes: 0,
    lastCapture: false,
  };
}

export function legalTokens(state: State): number[] {
  if (state.dice === null || state.winner !== null) return [];
  return state.tokens[state.current].flatMap((token, index) => canMove(token.progress, state.dice as number) ? [index] : []);
}

export function reduce(state: State, action: Action, random: () => number = Math.random): State {
  if (action.type === "reset") return createState();
  if (state.winner !== null) return state;

  if (action.type === "roll") {
    if (state.dice !== null) return state;
    const value = action.value ?? Math.floor(random() * 6) + 1;
    if (!Number.isInteger(value) || value < 1 || value > 6) return state;
    const consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : 0;
    if (consecutiveSixes >= 3) return nextTurn({ ...state, dice: null, consecutiveSixes: 0, extraTurn: false, lastCapture: false });
    return { ...state, dice: value, consecutiveSixes };
  }

  if (action.type !== "move" || state.dice === null || !legalTokens(state).includes(action.token)) return state;
  const rolled = state.dice;
  const player = state.current;
  const progress = state.tokens[player][action.token].progress === 0 ? 1 : state.tokens[player][action.token].progress + rolled;
  const tokens = cloneTokens(state.tokens);
  tokens[player][action.token] = { progress };
  const captured = captureOpponents(tokens, player, progress);
  const winner = tokens[player].every((token) => token.progress === FINISH) ? player : null;
  const extraTurn = rolled === 6 || captured;
  return {
    ...state,
    tokens,
    dice: null,
    winner,
    extraTurn,
    lastCapture: captured,
    current: winner !== null || extraTurn ? player : nextPlayer(player),
    consecutiveSixes: winner !== null || extraTurn ? state.consecutiveSixes : 0,
  };
}

export function canMove(progress: number, dice: number): boolean {
  if (progress === 0) return dice === 6;
  return progress + dice <= FINISH;
}

export function globalPosition(player: Player, progress: number): number | null {
  if (progress <= 0 || progress > TRACK_LENGTH) return null;
  return (START_CELLS[player] + progress - 1) % TRACK_LENGTH;
}

export function isSafeCell(position: number): boolean {
  return (SAFE_CELLS as readonly number[]).includes(position);
}

export function getScore(state: State) {
  return state.winner === null ? 0 : 1000;
}

function captureOpponents(tokens: Record<Player, Token[]>, player: Player, progress: number) {
  const position = globalPosition(player, progress);
  if (position === null || isSafeCell(position)) return false;
  let captured = false;
  for (const opponent of [0, 1, 2, 3] as Player[]) {
    if (opponent === player) continue;
    tokens[opponent] = tokens[opponent].map((token) => {
      if (globalPosition(opponent, token.progress) === position) {
        captured = true;
        return { progress: 0 };
      }
      return token;
    });
  }
  return captured;
}

function cloneTokens(tokens: Record<Player, Token[]>) {
  return {
    0: tokens[0].map((token) => ({ ...token })),
    1: tokens[1].map((token) => ({ ...token })),
    2: tokens[2].map((token) => ({ ...token })),
    3: tokens[3].map((token) => ({ ...token })),
  } as Record<Player, Token[]>;
}

function baseTokens(): Token[] {
  return Array.from({ length: 4 }, () => ({ progress: 0 }));
}

function nextPlayer(player: Player): Player {
  return ((player + 1) % 4) as Player;
}

function nextTurn(state: State): State {
  return { ...state, current: nextPlayer(state.current), dice: null };
}
