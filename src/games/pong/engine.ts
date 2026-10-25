export type Side = "left" | "right";
export type Mode = "local" | "computer";
export type Phase = "ready" | "running" | "paused" | "finished";
export type Ball = { x: number; y: number; vx: number; vy: number; radius: number };
export type State = {
  ball: Ball;
  paddles: { left: number; right: number };
  scores: { left: number; right: number };
  width: number;
  height: number;
  paddleHeight: number;
  winningScore: number;
  mode: Mode;
  aiReaction: number;
  phase: Phase;
  winner: Side | null;
};
export type Action =
  | { type: "movePaddle"; player: Side; y: number }
  | { type: "frame"; deltaMs: number }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set-mode"; mode: Mode }
  | { type: "set-winning-score"; score: number }
  | { type: "set-ai-reaction"; reaction: number }
  | { type: "reset" };

export const FIXED_STEP_SECONDS = 1 / 120;
const PADDLE_WIDTH = 0.025;
const PADDLE_INSET = 0.045;
const MAX_BALL_SPEED = 1.25;
const BASE_BALL_SPEED = 0.62;
const AI_BASE_SPEED = 0.85;

export function createState(width = 1, height = 1): State {
  return {
    ball: serveBall(0, width, height),
    paddles: { left: height / 2, right: height / 2 },
    scores: { left: 0, right: 0 },
    width,
    height,
    paddleHeight: 0.18,
    winningScore: 7,
    mode: "local",
    aiReaction: 0.55,
    phase: "ready",
    winner: null,
  };
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return { ...createState(state.width, state.height), mode: state.mode, winningScore: state.winningScore, aiReaction: state.aiReaction };
  if (action.type === "set-mode" && state.phase !== "running") return { ...state, mode: action.mode };
  if (action.type === "set-winning-score" && state.phase !== "running" && Number.isInteger(action.score) && action.score >= 1 && action.score <= 21) return { ...state, winningScore: action.score };
  if (action.type === "set-ai-reaction" && Number.isFinite(action.reaction)) return { ...state, aiReaction: clamp(action.reaction, 0.1, 1) };
  if (action.type === "movePaddle") {
    if (state.mode === "computer" && action.player === "right") return state;
    if (!Number.isFinite(action.y)) return state;
    return { ...state, paddles: { ...state.paddles, [action.player]: clampPaddle(action.y, state) } };
  }
  if (action.type === "start" && state.phase === "ready") {
    const direction = state.scores.left <= state.scores.right ? 1 : -1;
    return { ...state, phase: "running", ball: serveBall(direction, state.width, state.height) };
  }
  if (action.type === "pause" && state.phase === "running") return { ...state, phase: "paused" };
  if (action.type === "resume" && state.phase === "paused") return { ...state, phase: "running" };
  if (action.type !== "frame" || state.phase !== "running") return state;

  const total = Math.min(Math.max(action.deltaMs / 1000, 0), 0.1);
  if (total === 0) return state;
  const steps = Math.min(12, Math.max(1, Math.ceil(total / FIXED_STEP_SECONDS)));
  const dt = total / steps;
  let next = state;
  for (let i = 0; i < steps && next.phase === "running"; i++) next = simulateStep(next, dt);
  return next;
}

export function simulateStep(state: State, dt = FIXED_STEP_SECONDS): State {
  if (state.phase !== "running") return state;
  const paddles = { ...state.paddles };
  if (state.mode === "computer") {
    const target = state.ball.vx > 0 ? state.ball.y : state.height / 2;
    const maxMove = AI_BASE_SPEED * state.aiReaction * dt;
    paddles.right += clamp(target - paddles.right, -maxMove, maxMove);
    paddles.right = clampPaddle(paddles.right, state);
  }

  let ball: Ball = { ...state.ball, x: state.ball.x + state.ball.vx * dt, y: state.ball.y + state.ball.vy * dt };
  if (ball.y - ball.radius <= 0) ball = { ...ball, y: ball.radius, vy: Math.abs(ball.vy) };
  else if (ball.y + ball.radius >= state.height) ball = { ...ball, y: state.height - ball.radius, vy: -Math.abs(ball.vy) };

  ball = collidePaddle(ball, paddles.left, "left", state);
  ball = collidePaddle(ball, paddles.right, "right", state);

  if (ball.x + ball.radius < 0) return scorePoint(state, "right");
  if (ball.x - ball.radius > state.width) return scorePoint(state, "left");
  return { ...state, ball, paddles };
}

export function getScore(state: State) {
  return Math.max(state.scores.left, state.scores.right);
}

function collidePaddle(ball: Ball, centerY: number, side: Side, state: State): Ball {
  const paddleX = side === "left" ? PADDLE_INSET : state.width - PADDLE_INSET - PADDLE_WIDTH;
  const movingToward = side === "left" ? ball.vx < 0 : ball.vx > 0;
  if (!movingToward) return ball;
  const overlapsX = ball.x + ball.radius >= paddleX && ball.x - ball.radius <= paddleX + PADDLE_WIDTH;
  const overlapsY = ball.y + ball.radius >= centerY - state.paddleHeight / 2 && ball.y - ball.radius <= centerY + state.paddleHeight / 2;
  if (!overlapsX || !overlapsY) return ball;

  const offset = clamp((ball.y - centerY) / (state.paddleHeight / 2), -1, 1);
  const speed = Math.min(MAX_BALL_SPEED, Math.max(BASE_BALL_SPEED, Math.hypot(ball.vx, ball.vy) * 1.04));
  const angle = offset * (Math.PI / 3);
  return {
    ...ball,
    x: side === "left" ? paddleX + PADDLE_WIDTH + ball.radius : paddleX - ball.radius,
    vx: (side === "left" ? 1 : -1) * Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function scorePoint(state: State, scorer: Side): State {
  const scores = { ...state.scores, [scorer]: state.scores[scorer] + 1 };
  const finished = scores[scorer] >= state.winningScore;
  const direction = scorer === "left" ? 1 : -1;
  return {
    ...state,
    scores,
    ball: serveBall(direction, state.width, state.height),
    paddles: { left: state.height / 2, right: state.height / 2 },
    phase: finished ? "finished" : "ready",
    winner: finished ? scorer : null,
  };
}

function serveBall(direction: number, width: number, height: number): Ball {
  return { x: width / 2, y: height / 2, vx: direction * BASE_BALL_SPEED, vy: BASE_BALL_SPEED * 0.32, radius: 0.022 };
}

function clampPaddle(y: number, state: State) {
  const half = state.paddleHeight / 2;
  return clamp(y, half, state.height - half);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
