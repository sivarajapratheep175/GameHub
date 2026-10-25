import { createState, reduce, simulateStep, type State } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function running(overrides: Partial<State> = {}): State {
  return { ...createState(), phase: "running", ...overrides };
}

export function runPongEngineTests() {
  const paddleBound = reduce(createState(), { type: "movePaddle", player: "left", y: 10 });
  assert(paddleBound.paddles.left <= 1 - paddleBound.paddleHeight / 2, "Paddles must stay within court bounds.");

  const paddleHit = simulateStep(running({
    ball: { x: 0.065, y: 0.5, vx: -0.5, vy: 0, radius: 0.022 },
    paddles: { left: 0.5, right: 0.5 },
  }));
  assert(paddleHit.ball.vx > 0, "Left paddle collision should reflect the ball rightward.");

  const topWall = simulateStep(running({ ball: { x: 0.5, y: 0.01, vx: 0, vy: -0.5, radius: 0.022 } }));
  assert(topWall.ball.vy > 0, "Top wall collision should reflect the ball downward.");

  let scoring = running({ ball: { x: -0.04, y: 0.5, vx: -0.5, vy: 0, radius: 0.022 } });
  scoring = simulateStep(scoring);
  assert(scoring.scores.right === 1 && scoring.phase === "ready", "Ball leaving the left side should score for right.");

  const win = simulateStep(running({ ball: { x: -0.04, y: 0.5, vx: -0.5, vy: 0, radius: 0.022 }, scores: { left: 0, right: 6 } }));
  assert(win.phase === "finished" && win.winner === "right", "Winning score should finish the match.");

  const reset = reduce({ ...win, mode: "computer" }, { type: "reset" });
  assert(reset.scores.left === 0 && reset.scores.right === 0 && reset.phase === "ready" && reset.mode === "computer", "Reset should clear scores and preserve selected mode.");

  const ai = simulateStep(running({ mode: "computer", aiReaction: 1, ball: { x: 0.7, y: 0.8, vx: 0.4, vy: 0, radius: 0.022 } }));
  assert(ai.paddles.right > 0.5, "Computer paddle should track the ball when it approaches.");
  const humanRight = reduce({ ...createState(), mode: "computer" }, { type: "movePaddle", player: "right", y: 0.1 });
  assert(humanRight.paddles.right === 0.5, "Computer-controlled paddle should reject manual movement.");
  return true;
}
