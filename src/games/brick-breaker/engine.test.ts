import { createState, MAX_LEVEL, reduce, simulateStep, type State } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function playingState(overrides: Partial<State> = {}): State {
  return { ...createState(), phase: "running", ...overrides };
}

export function runBrickBreakerEngineTests() {
  const wallBounce = simulateStep(playingState({
    ball: { x: 0.99, y: 0.5, vx: 0.5, vy: 0, radius: 0.02 },
    bricks: [],
  }), 1 / 60);
  assert(wallBounce.ball.vx < 0, "Ball should bounce off the right wall.");

  const paddleBounce = simulateStep(playingState({
    ball: { x: 0.5, y: 0.88, vx: 0, vy: 0.5, radius: 0.02 },
    paddle: { x: 0.5, width: 0.2, height: 0.025, y: 0.91 },
    bricks: [],
  }), 1 / 60);
  assert(paddleBounce.ball.vy < 0, "Ball should bounce upward from the paddle.");

  const brick = { id: 1, x: 0.45, y: 0.4, width: 0.1, height: 0.04, alive: true, value: 30 };
  const hit = simulateStep(playingState({
    ball: { x: 0.5, y: 0.463, vx: 0, vy: -0.5, radius: 0.02 },
    bricks: [brick],
  }), 1 / 60);
  assert(!hit.bricks[0].alive && hit.score === 30, "One brick collision should remove one brick and award its score.");

  const multiple = simulateStep(playingState({
    ball: { x: 0.5, y: 0.463, vx: 0, vy: -0.5, radius: 0.02 },
    bricks: [brick, { ...brick, id: 2, y: 0.44 }],
  }), 1 / 60);
  assert(multiple.bricks.filter((item) => !item.alive).length === 1, "A single collision step must not remove multiple bricks.");

  const lostLife = simulateStep(playingState({
    ball: { x: 0.5, y: 1.02, vx: 0, vy: 1, radius: 0.02 },
    lives: 3,
    bricks: [],
  }), 1 / 60);
  assert(lostLife.lives === 2 && lostLife.phase === "ready" && lostLife.ball.vx === 0 && lostLife.ball.vy === 0, "Life loss should reset the ball and wait for a new serve.");

  const completed = simulateStep(playingState({
    ball: { x: 0.5, y: 0.463, vx: 0, vy: -0.5, radius: 0.02 },
    bricks: [brick],
  }), 1 / 60);
  assert(completed.phase === "level-complete", "Clearing the last brick should complete the level.");
  const nextLevel = reduce(completed, { type: "nextLevel" });
  assert(nextLevel.level === 2 && nextLevel.phase === "ready" && nextLevel.bricks.some((item) => item.alive), "Next level should create a fresh brick layout.");
  const finalLevel = reduce({ ...completed, level: MAX_LEVEL }, { type: "nextLevel" });
  assert(finalLevel.phase === "won", "Clearing the final level should win the game.");

  const started = reduce(createState(), { type: "start" });
  assert(started.phase === "running" && Math.hypot(started.ball.vx, started.ball.vy) > 0, "Start should launch the ball.");
  const lostAllLives = simulateStep(playingState({ ball: { x: 0.5, y: 1.02, vx: 0, vy: 1, radius: 0.02 }, lives: 1, bricks: [] }), 1 / 60);
  assert(lostAllLives.phase === "game-over" && lostAllLives.lives === 0, "Zero lives should end the game.");

  return true;
}
