import { createState, reduce, spawnFood } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runSnakeEngineTests() {
  let state = createState(8, 8, () => 0);
  state = reduce(state, { type: "start" });
  const moved = reduce(state, { type: "tick" });
  assert(moved.snake[0].x === state.snake[0].x + 1 && moved.snake.length === 3, "Snake should move one grid cell.");

  const growing = { ...state, food: { x: state.snake[0].x + 1, y: state.snake[0].y } };
  const eaten = reduce(growing, { type: "tick" });
  assert(eaten.snake.length === 4 && eaten.score === 10, "Eating food should grow and score.");
  assert(spawnFood(eaten.snake, 8, 8, () => 0)?.x !== eaten.snake[0].x, "Food must spawn outside the snake.");

  const reversed = reduce(state, { type: "turn", direction: "left" });
  assert(reversed.queued === "right", "Direct reversal must be rejected.");

  const wall = reduce({ ...state, snake: [{ x: 7, y: 2 }], food: { x: 0, y: 0 } }, { type: "tick" });
  assert(wall.gameOver && !wall.running, "Wall collision should end the game.");

  const self = reduce({ ...state, running: true, snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 2 }], direction: "left", queued: "left", food: { x: 0, y: 0 } }, { type: "tick" });
  assert(self.gameOver, "Self collision should end the game.");

  const initial = createState(8, 8, () => 0);
  const paused = reduce(initial, { type: "pause", paused: true });
  assert(paused === initial, "Pause before start should not change state.");
  const started = reduce(state, { type: "start" });
  const pausedRunning = reduce(started, { type: "pause", paused: true });
  assert(reduce(pausedRunning, { type: "tick" }) === pausedRunning, "Paused games must not tick.");

  const reset = reduce({ ...eaten, bestScore: 20 }, { type: "reset" });
  assert(reset.score === 0 && reset.bestScore === 20 && !reset.gameOver, "Restart should clear the round but preserve best score.");
  return true;
}
