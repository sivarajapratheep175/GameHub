export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type Difficulty = "easy" | "medium" | "hard";
export type State = {
  snake: Point[];
  food: Point;
  direction: Direction;
  queued: Direction;
  score: number;
  bestScore: number;
  difficulty: Difficulty;
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  walls: boolean;
  width: number;
  height: number;
};
export type Action =
  | { type: "turn"; direction: Direction }
  | { type: "tick" }
  | { type: "start" }
  | { type: "pause"; paused: boolean }
  | { type: "set-difficulty"; difficulty: Difficulty }
  | { type: "reset" };

export const SPEED_MS: Record<Difficulty, number> = { easy: 220, medium: 150, hard: 95 };
const reverse: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

export function createState(width = 16, height = 16, random: () => number = Math.random, difficulty: Difficulty = "medium", bestScore = 0): State {
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const snake = [center, { x: center.x - 1, y: center.y }, { x: center.x - 2, y: center.y }];
  return {
    snake,
    food: randomFood(snake, width, height, random),
    direction: "right",
    queued: "right",
    score: 0,
    bestScore,
    difficulty,
    running: false,
    paused: false,
    gameOver: false,
    walls: true,
    width,
    height,
  };
}

export function reduce(state: State, action: Action, random: () => number = Math.random): State {
  if (action.type === "reset") return createState(state.width, state.height, random, state.difficulty, state.bestScore);
  if (action.type === "set-difficulty" && !state.running) return createState(state.width, state.height, random, action.difficulty, state.bestScore);
  if (action.type === "start" && !state.gameOver) return { ...state, running: true, paused: false };
  if (action.type === "pause" && state.running && !state.gameOver) return { ...state, paused: action.paused };
  if (action.type === "turn" && state.running && !state.paused && !state.gameOver && reverse[state.direction] !== action.direction && reverse[state.queued] !== action.direction) {
    return { ...state, queued: action.direction };
  }
  if (action.type !== "tick" || !state.running || state.paused || state.gameOver) return state;

  const head = state.snake[0];
  const next = nextPoint(head, state.queued);
  const wrapped = state.walls ? next : { x: (next.x + state.width) % state.width, y: (next.y + state.height) % state.height };
  const hitWall = state.walls && (wrapped.x < 0 || wrapped.y < 0 || wrapped.x >= state.width || wrapped.y >= state.height);
  const ate = wrapped.x === state.food.x && wrapped.y === state.food.y;
  const bodyToCheck = ate ? state.snake : state.snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((part) => part.x === wrapped.x && part.y === wrapped.y);
  if (hitWall || hitSelf) {
    return { ...state, running: false, gameOver: true, bestScore: Math.max(state.bestScore, state.score) };
  }

  const snake = [wrapped, ...state.snake];
  if (!ate) snake.pop();
  const score = state.score + (ate ? 10 : 0);
  return {
    ...state,
    snake,
    direction: state.queued,
    food: ate ? randomFood(snake, state.width, state.height, random) : state.food,
    score,
    bestScore: Math.max(state.bestScore, score),
  };
}

export function spawnFood(snake: Point[], width: number, height: number, random: () => number = Math.random): Point | null {
  return randomFood(snake, width, height, random);
}

export const getTickMs = (difficulty: Difficulty) => SPEED_MS[difficulty];
export const getScore = (state: State) => state.score;

function nextPoint(point: Point, direction: Direction): Point {
  if (direction === "up") return { x: point.x, y: point.y - 1 };
  if (direction === "down") return { x: point.x, y: point.y + 1 };
  if (direction === "left") return { x: point.x - 1, y: point.y };
  return { x: point.x + 1, y: point.y };
}

function randomFood(snake: Point[], width: number, height: number, random: () => number): Point {
  const open = Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) }))
    .filter((point) => !snake.some((part) => part.x === point.x && part.y === point.y));
  if (!open.length) return { x: -1, y: -1 };
  return open[Math.min(open.length - 1, Math.floor(random() * open.length))];
}
