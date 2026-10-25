export type Player = 0 | 1;
export type CoinColor = "white" | "black";
export type DiscKind = "coin" | "queen" | "striker";
export type Disc = {
  id: string;
  kind: DiscKind;
  color?: CoinColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pocketed: boolean;
};

export type State = {
  discs: Disc[];
  currentPlayer: Player;
  scores: [number, number];
  coinsPocketed: [number, number];
  queenCoveredBy: Player | null;
  queenPendingFor: Player | null;
  foul: string | null;
  foulDiscId: string | null;
  turnPocketed: boolean;
  turnCoinPocketed: boolean;
  phase: "aiming" | "rolling" | "finished";
  finished: boolean;
  winner: Player | null;
  boardSize: number;
};

export type Action =
  | { type: "strike"; angle: number; power: number }
  | { type: "frame"; deltaMs: number }
  | { type: "reset" };

export const BOARD_MIN = 0.06;
export const BOARD_MAX = 0.94;
export const POCKET_RADIUS = 0.065;
export const STRIKER_RADIUS = 0.035;
export const COIN_RADIUS = 0.022;
export const QUEEN_RADIUS = 0.024;
export const MAX_POWER = 0.9;
export const WINNING_COINS = 5;
export const FIXED_STEP_MS = 1000 / 60;
const FRICTION = 0.985;
const STOP_SPEED = 0.012;
const RESTITUTION = 0.92;

const pockets = [
  { x: BOARD_MIN, y: BOARD_MIN },
  { x: BOARD_MAX, y: BOARD_MIN },
  { x: BOARD_MIN, y: BOARD_MAX },
  { x: BOARD_MAX, y: BOARD_MAX },
];

export function createState(boardSize = 1): State {
  const discs: Disc[] = [{
    id: "queen", kind: "queen", x: 0.5, y: 0.5, vx: 0, vy: 0, radius: QUEEN_RADIUS, pocketed: false,
  }];
  for (let index = 0; index < 18; index++) {
    const angle = (Math.PI * 2 * index) / 9;
    const ring = index < 9 ? 0.065 : 0.105;
    discs.push({
      id: `coin-${index}`,
      kind: "coin",
      color: index % 2 === 0 ? "white" : "black",
      x: 0.5 + Math.cos(angle) * ring,
      y: 0.5 + Math.sin(angle) * ring,
      vx: 0,
      vy: 0,
      radius: COIN_RADIUS,
      pocketed: false,
    });
  }
  discs.push({ id: "striker", kind: "striker", x: 0.5, y: 0.86, vx: 0, vy: 0, radius: STRIKER_RADIUS, pocketed: false });
  return {
    discs,
    currentPlayer: 0,
    scores: [0, 0],
    coinsPocketed: [0, 0],
    queenCoveredBy: null,
    queenPendingFor: null,
    foul: null,
    foulDiscId: null,
    turnPocketed: false,
    turnCoinPocketed: false,
    phase: "aiming",
    finished: false,
    winner: null,
    boardSize,
  };
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return createState(state.boardSize);
  if (state.finished) return state;

  if (action.type === "strike" && state.phase === "aiming") {
    const striker = state.discs.find((disc) => disc.kind === "striker");
    if (!striker || !Number.isFinite(action.angle) || !Number.isFinite(action.power)) return state;
    const power = clamp(action.power, 0.08, MAX_POWER);
    return {
      ...state,
      foul: null,
      foulDiscId: null,
      turnPocketed: false,
      turnCoinPocketed: false,
      phase: "rolling",
      discs: state.discs.map((disc) => disc.kind === "striker"
        ? { ...disc, pocketed: false, vx: Math.cos(action.angle) * power, vy: Math.sin(action.angle) * power }
        : disc),
    };
  }

  if (action.type !== "frame" || state.phase !== "rolling") return state;
  const safeDelta = Math.min(Math.max(action.deltaMs, 0), 250);
  const steps = Math.max(1, Math.ceil(safeDelta / FIXED_STEP_MS));
  let next = state;
  for (let step = 0; step < steps && next.phase === "rolling"; step++) {
    next = advanceFixed(next);
  }
  return next;
}

export function advanceFixed(state: State): State {
  let next = stepPhysics(state);
  if (allStopped(next.discs)) next = settleTurn({ ...next, phase: "aiming" });
  return next;
}

function stepPhysics(state: State): State {
  let discs = state.discs.map((disc) => {
    if (disc.pocketed) return disc;
    return {
      ...disc,
      x: disc.x + disc.vx,
      y: disc.y + disc.vy,
      vx: disc.vx * FRICTION,
      vy: disc.vy * FRICTION,
    };
  });

  discs = discs.map((disc) => {
    if (disc.pocketed) return disc;
    let { x, y, vx, vy } = disc;
    if (x - disc.radius < BOARD_MIN || x + disc.radius > BOARD_MAX) {
      vx = -vx * RESTITUTION;
      x = clamp(x, BOARD_MIN + disc.radius, BOARD_MAX - disc.radius);
    }
    if (y - disc.radius < BOARD_MIN || y + disc.radius > BOARD_MAX) {
      vy = -vy * RESTITUTION;
      y = clamp(y, BOARD_MIN + disc.radius, BOARD_MAX - disc.radius);
    }
    return { ...disc, x, y, vx, vy };
  });

  for (let first = 0; first < discs.length; first++) {
    for (let second = first + 1; second < discs.length; second++) {
      if (!discs[first].pocketed && !discs[second].pocketed) resolveCollision(discs[first], discs[second]);
    }
  }
  return pocketDiscs({ ...state, discs });
}

function resolveCollision(a: Disc, b: Disc) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minimum = a.radius + b.radius;
  if (distance <= 0 || distance >= minimum) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = (minimum - distance) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const relativeVelocity = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (relativeVelocity <= 0) return;
  const impulse = relativeVelocity * RESTITUTION;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

function pocketDiscs(state: State): State {
  let turnPocketed = state.turnPocketed;
  let turnCoinPocketed = state.turnCoinPocketed;
  let foul = state.foul;
  let foulDiscId = state.foulDiscId;
  const scores = [...state.scores] as [number, number];
  const coinsPocketed = [...state.coinsPocketed] as [number, number];
  let queenPendingFor = state.queenPendingFor;
  const playerColor: CoinColor = state.currentPlayer === 0 ? "white" : "black";
  const discs = state.discs.map((disc) => {
    if (disc.pocketed || !pockets.some((pocket) => Math.hypot(disc.x - pocket.x, disc.y - pocket.y) <= POCKET_RADIUS)) return disc;
    turnPocketed = true;
    if (disc.kind === "striker") {
      foul = "Foul: striker pocketed. One of your coins is returned and the turn ends.";
      foulDiscId = disc.id;
      return { ...disc, pocketed: true, vx: 0, vy: 0 };
    }
    if (disc.kind === "queen") {
      queenPendingFor = state.currentPlayer;
      scores[state.currentPlayer] += 3;
      return { ...disc, pocketed: true, vx: 0, vy: 0 };
    }
    if (disc.color === playerColor) {
      coinsPocketed[state.currentPlayer] += 1;
      scores[state.currentPlayer] += 1;
      turnCoinPocketed = true;
      return { ...disc, pocketed: true, vx: 0, vy: 0 };
    }
    foul = "Foul: opponent coin pocketed. It is returned and the turn ends.";
    foulDiscId = disc.id;
    return { ...disc, x: 0.5, y: 0.5, vx: 0, vy: 0, pocketed: false };
  });
  return { ...state, discs, scores, coinsPocketed, foul, foulDiscId, turnPocketed, turnCoinPocketed, queenPendingFor };
}

function settleTurn(state: State): State {
  let discs = state.discs;
  const scores = [...state.scores] as [number, number];
  const coinsPocketed = [...state.coinsPocketed] as [number, number];
  let queenCoveredBy = state.queenCoveredBy;
  let queenPendingFor = state.queenPendingFor;
  const player = state.currentPlayer;

  if (state.foul?.startsWith("Foul: striker")) {
    const returned = discs.find((disc) => disc.kind === "coin" && disc.color === (player === 0 ? "white" : "black") && disc.pocketed);
    if (returned) {
      discs = discs.map((disc) => disc.id === returned.id ? { ...disc, x: 0.5, y: 0.5, pocketed: false } : disc);
      coinsPocketed[player] = Math.max(0, coinsPocketed[player] - 1);
      scores[player] = Math.max(0, scores[player] - 1);
    }
    discs = discs.map((disc) => disc.kind === "striker" ? { ...disc, x: 0.5, y: player === 0 ? 0.86 : 0.14, pocketed: false, vx: 0, vy: 0 } : disc);
  } else if (state.foul?.startsWith("Foul: opponent") && state.foulDiscId) {
    discs = discs.map((disc) => disc.id === state.foulDiscId ? { ...disc, x: 0.5, y: 0.5, pocketed: false } : disc);
  }

  if (queenPendingFor !== null) {
    if (state.turnCoinPocketed && !state.foul) {
      queenCoveredBy = queenPendingFor;
      queenPendingFor = null;
    } else {
      discs = discs.map((disc) => disc.kind === "queen" ? { ...disc, x: 0.5, y: 0.5, pocketed: false } : disc);
      scores[player] = Math.max(0, scores[player] - 3);
      queenPendingFor = null;
    }
  }

  const remainingOwnCoins = discs.some((disc) => disc.kind === "coin" && !disc.pocketed && disc.color === (player === 0 ? "white" : "black"));
  const winner = !remainingOwnCoins && (queenCoveredBy === player || !discs.some((disc) => disc.kind === "queen" && !disc.pocketed)) ? player : null;
  const keepTurn = state.turnPocketed && !state.foul;
  const nextPlayer: Player = keepTurn ? player : player === 0 ? 1 : 0;
  discs = discs.map((disc) => disc.kind === "striker" ? { ...disc, x: 0.5, y: nextPlayer === 0 ? 0.86 : 0.14, pocketed: false, vx: 0, vy: 0 } : disc);
  return {
    ...state,
    discs,
    scores,
    coinsPocketed,
    queenCoveredBy,
    queenPendingFor,
    currentPlayer: nextPlayer,
    turnPocketed: false,
    turnCoinPocketed: false,
    winner,
    finished: winner !== null,
    phase: winner !== null ? "finished" : "aiming",
  };
}

function allStopped(discs: Disc[]) {
  return discs.every((disc) => disc.pocketed || Math.hypot(disc.vx, disc.vy) < STOP_SPEED);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
