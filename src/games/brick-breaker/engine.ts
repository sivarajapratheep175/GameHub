export type Brick = { id: number; x: number; y: number; width: number; height: number; alive: boolean; value: number };
export type Ball = { x: number; y: number; vx: number; vy: number; radius: number };
export type Phase = "ready" | "running" | "paused" | "level-complete" | "won" | "game-over";
export type State = {
  ball: Ball;
  paddle: { x: number; width: number; height: number; y: number };
  bricks: Brick[];
  lives: number;
  score: number;
  level: number;
  phase: Phase;
  width: number;
  height: number;
};
export type Action =
  | { type: "movePaddle"; x: number }
  | { type: "frame"; deltaMs: number }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "nextLevel" }
  | { type: "reset" };

export const FIXED_STEP_SECONDS = 1 / 120;
const BALL_RADIUS = 0.018;
const BRICK_COLUMNS = 8;
const BRICK_ROWS = 5;
const BRICK_WIDTH = 0.105;
const BRICK_HEIGHT = 0.036;
const BRICK_GAP = 0.014;
const PADDLE_WIDTH = 0.2;
const PADDLE_HEIGHT = 0.025;
const PADDLE_Y = 0.91;
const MAX_FRAME_SECONDS = 0.1;
const MAX_STEPS_PER_FRAME = 12;
export const MAX_LEVEL = 5;

export function createState(width = 1, height = 1): State {
  return {
    ball: { x: 0.5, y: 0.72, vx: 0, vy: 0, radius: BALL_RADIUS },
    paddle: { x: 0.5, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, y: PADDLE_Y },
    bricks: createBricks(1),
    lives: 3,
    score: 0,
    level: 1,
    phase: "ready",
    width,
    height,
  };
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return createState(state.width, state.height);
  if (action.type === "movePaddle") {
    if (!Number.isFinite(action.x)) return state;
    return { ...state, paddle: { ...state.paddle, x: clamp(action.x, state.paddle.width / 2, state.width - state.paddle.width / 2) } };
  }
  if (action.type === "start" && state.phase === "ready") {
    const speed = 0.58 + Math.min(state.level - 1, 5) * 0.045;
    const direction = state.level % 2 === 0 ? -1 : 1;
    return { ...state, phase: "running", ball: { ...state.ball, vx: direction * speed * 0.48, vy: -speed * 0.88 } };
  }
  if (action.type === "pause" && state.phase === "running") return { ...state, phase: "paused" };
  if (action.type === "resume" && state.phase === "paused") return { ...state, phase: "running" };
  if (action.type === "nextLevel" && state.phase === "level-complete") {
    if (state.level >= MAX_LEVEL) return { ...state, phase: "won" };
    const level = state.level + 1;
    return { ...state, level, bricks: createBricks(level), ball: serveBall(), paddle: { ...state.paddle, x: state.width / 2 }, phase: "ready" };
  }
  if (action.type !== "frame" || state.phase !== "running") return state;

  const totalSeconds = Math.min(Math.max(action.deltaMs / 1000, 0), MAX_FRAME_SECONDS);
  if (totalSeconds === 0) return state;
  const steps = Math.min(MAX_STEPS_PER_FRAME, Math.max(1, Math.ceil(totalSeconds / FIXED_STEP_SECONDS)));
  const dt = totalSeconds > 0 ? totalSeconds / steps : FIXED_STEP_SECONDS;
  let next = state;
  for (let index = 0; index < steps && next.phase === "running"; index++) next = simulateStep(next, dt);
  return next;
}

export function simulateStep(state: State, dt = FIXED_STEP_SECONDS): State {
  if (state.phase !== "running") return state;
  let ball = { ...state.ball, x: state.ball.x + state.ball.vx * dt, y: state.ball.y + state.ball.vy * dt };

  if (ball.x - ball.radius < 0) ball = { ...ball, x: ball.radius, vx: Math.abs(ball.vx) };
  else if (ball.x + ball.radius > state.width) ball = { ...ball, x: state.width - ball.radius, vx: -Math.abs(ball.vx) };
  if (ball.y - ball.radius < 0) ball = { ...ball, y: ball.radius, vy: Math.abs(ball.vy) };

  const paddleTop = state.paddle.y - state.paddle.height / 2;
  const paddleLeft = state.paddle.x - state.paddle.width / 2;
  const paddleRight = state.paddle.x + state.paddle.width / 2;
  if (ball.vy > 0 && circleIntersectsRect(ball, paddleLeft, paddleTop, state.paddle.width, state.paddle.height)) {
    const relativeHit = clamp((ball.x - state.paddle.x) / (state.paddle.width / 2), -1, 1);
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = relativeHit * (Math.PI / 3);
    ball = {
      ...ball,
      y: paddleTop - ball.radius,
      vx: Math.sin(angle) * speed,
      vy: -Math.max(speed * Math.cos(angle), speed * 0.35),
    };
  }

  const brickIndex = state.bricks.findIndex((brick) => brick.alive && circleIntersectsRect(ball, brick.x, brick.y, brick.width, brick.height));
  let bricks = state.bricks;
  let score = state.score;
  if (brickIndex >= 0) {
    const brick = state.bricks[brickIndex];
    bricks = state.bricks.map((item, index) => index === brickIndex ? { ...item, alive: false } : item);
    score += brick.value;
    ball = bounceFromBrick(ball, brick);
  }

  if (ball.y - ball.radius > state.height) {
    const lives = state.lives - 1;
    return {
      ...state,
      ball: serveBall(),
      lives,
      score,
      bricks,
      phase: lives <= 0 ? "game-over" : "ready",
    };
  }

  const levelComplete = bricks.every((brick) => !brick.alive);
  return { ...state, ball, bricks, score, phase: levelComplete ? state.level >= MAX_LEVEL ? "won" : "level-complete" : "running" };
}

export function getScore(state: State) {
  return state.score;
}

function createBricks(level: number): Brick[] {
  const totalWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP;
  const left = (1 - totalWidth) / 2;
  return Array.from({ length: BRICK_COLUMNS * BRICK_ROWS }, (_, id) => ({
    id,
    x: left + (id % BRICK_COLUMNS) * (BRICK_WIDTH + BRICK_GAP),
    y: 0.1 + Math.floor(id / BRICK_COLUMNS) * (BRICK_HEIGHT + 0.016),
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
    alive: true,
    value: (1 + (Math.floor(id / BRICK_COLUMNS) % 3)) * 10 * Math.min(level, 3),
  }));
}

function serveBall(): Ball {
  return { x: 0.5, y: 0.72, vx: 0, vy: 0, radius: BALL_RADIUS };
}

function circleIntersectsRect(ball: Ball, x: number, y: number, width: number, height: number) {
  const closestX = clamp(ball.x, x, x + width);
  const closestY = clamp(ball.y, y, y + height);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function bounceFromBrick(ball: Ball, brick: Brick): Ball {
  const previousY = ball.y - ball.vy * FIXED_STEP_SECONDS;
  const crossedHorizontal = previousY + ball.radius <= brick.y || previousY - ball.radius >= brick.y + brick.height;
  if (crossedHorizontal) return { ...ball, vy: -ball.vy };
  return { ...ball, vx: -ball.vx };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
