import {
  applyGravity,
  BOARD_SIZE,
  CANDY_TYPES,
  createState,
  findMatches,
  hasPossibleMove,
  LEVEL_COUNT,
  reduce,
  type Board,
  type Position,
  type State,
} from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function findSwap(board: Board, shouldMatch: boolean): [Position, Position] | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      for (const [nextRow, nextColumn] of [[row, column + 1], [row + 1, column]]) {
        if (nextRow >= board.length || nextColumn >= board[row].length) continue;
        const next = board.map((line) => [...line]);
        [next[row][column], next[nextRow][nextColumn]] = [next[nextRow][nextColumn], next[row][column]];
        if ((findMatches(next).size > 0) === shouldMatch) {
          return [[row, column], [nextRow, nextColumn]];
        }
      }
    }
  }
  return null;
}

function settle(state: State, random: () => number = seededRandom(17)) {
  let next = state;
  let steps = 0;
  while (next.phase === "resolving" && steps < 100) {
    next = reduce(next, { type: "resolve" }, random);
    steps += 1;
  }
  if (steps >= 100) throw new Error("Cascade resolution did not settle.");
  return next;
}

function makeCascadeBoard(): Board {
  const board: Board = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 6 }, (_, column) => CANDY_TYPES[(row + column) % 2]),
  );
  board[0][0] = "berry";
  board[1][0] = "berry";
  board[2][0] = "lemon";
  board[2][1] = "berry";
  board[1][1] = "lemon";
  return board;
}

export function runCandyMatchEngineTests() {
  const runMatches: Board = [
    ["berry", "berry", "berry", "lemon", "grape"],
    ["lemon", "apple", "grape", "orange", "blueberry"],
    ["grape", "apple", "lemon", "orange", "blueberry"],
    ["orange", "apple", "blueberry", "lemon", "grape"],
    ["lemon", "orange", "grape", "blueberry", "apple"],
  ];
  const detected = findMatches(runMatches);
  assert(
    [0, 1, 2, 6, 11, 16].every((index) => detected.has(index)),
    "Match detection should find complete horizontal and vertical runs.",
  );

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const board = createState(difficulty, seededRandom(2026)).board;
    assert(board.length === BOARD_SIZE[difficulty], `${difficulty} should have the configured board height.`);
    assert(board.every((row) => row.length === BOARD_SIZE[difficulty]), `${difficulty} should have a square board.`);
    assert(findMatches(board).size === 0, "New boards must not contain automatic matches.");
    assert(hasPossibleMove(board), "New boards must always have a legal move.");
    assert(board.flat().every((candy) => candy !== null), "New boards should not contain empty cells.");
  }
  const fallbackBoard = createState("easy", () => 0).board;
  assert(findMatches(fallbackBoard).size === 0 && hasPossibleMove(fallbackBoard), "Fallback generation should still return a stable, playable board.");
  const randomBoardA = createState("easy", seededRandom(7)).board;
  const randomBoardB = createState("easy", seededRandom(19)).board;
  assert(JSON.stringify(randomBoardA) !== JSON.stringify(randomBoardB), "Different random seeds should produce different boards.");

  let state = createState("easy", seededRandom(41));
  const validSwap = findSwap(state.board, true);
  if (!validSwap) throw new Error("Generated board must contain a legal swap.");
  state = reduce(state, { type: "swap", from: validSwap[0], to: validSwap[1] });
  assert(state.phase === "resolving", "A swap that creates a match should begin resolution.");
  assert(state.movesLeft === 17 && state.movesMade === 1, "A valid swap should use exactly one move.");
  assert(state.matchesToClear.length >= 3, "A valid swap should identify at least three matching candies.");
  assert(state.swapAnimationId === 1, "A valid swap should create a swap animation event.");
  const pointsForFirstMatch = state.matchesToClear.length * 60;
  state = reduce(state, { type: "resolve" }, seededRandom(41));
  assert(state.score === pointsForFirstMatch, "Clearing a match should award points per candy.");
  assert(state.gravityPending && state.matchesToClear.length === 0, "Clearing matches should schedule gravity.");
  state = reduce(state, { type: "resolve" }, seededRandom(41));
  assert(state.board.flat().every((candy) => candy !== null), "Gravity should refill every empty space.");
  assert(state.phase === "resolving" || state.phase === "running" || state.phase === "level-complete" || state.phase === "won" || state.phase === "lost", "Gravity should transition to another cascade or finish the turn.");

  const initialForInvalid = createState("easy", seededRandom(52));
  const invalidSwap = findSwap(initialForInvalid.board, false);
  if (!invalidSwap) throw new Error("Generated board must contain an invalid adjacent swap for the test.");
  const rejected = reduce(initialForInvalid, { type: "swap", from: invalidSwap[0], to: invalidSwap[1] });
  assert(rejected.board === initialForInvalid.board, "A swap that creates no match must leave the board unchanged.");
  assert(rejected.movesLeft === initialForInvalid.movesLeft && rejected.movesMade === 0, "An invalid swap must not cost a move.");
  assert(rejected.notice.length > 0, "An invalid swap should provide feedback.");
  const nonAdjacent = reduce(initialForInvalid, { type: "swap", from: [0, 0], to: [2, 2] });
  assert(nonAdjacent.movesMade === 0 && nonAdjacent.board === initialForInvalid.board, "Non-adjacent swaps must be rejected.");

  const selected = reduce(initialForInvalid, { type: "select", row: 0, column: 0 });
  assert(selected.selected?.[0] === 0 && selected.selected[1] === 0, "The first tap should select a candy.");
  assert(reduce(selected, { type: "select", row: 0, column: 0 }).selected === null, "Tapping a selected candy again should deselect it.");
  const outOfBounds = reduce(initialForInvalid, { type: "select", row: -1, column: 0 });
  assert(outOfBounds === initialForInvalid, "Out-of-bounds selections must be ignored.");

  const gravityInput: Board = [
    ["berry", null, "lemon"],
    [null, "grape", null],
    ["apple", null, "orange"],
    [null, null, "blueberry"],
  ];
  const gravityOutput = applyGravity(gravityInput, () => 0);
  assert(
    gravityOutput.map((row) => row[0]).join(",") === "berry,berry,berry,apple",
    "Gravity should preserve the order of surviving candies and refill the top of a column.",
  );
  assert(
    gravityOutput.map((row) => row[1]).join(",") === "berry,berry,berry,grape",
    "Gravity should refill every empty cell in sparse columns.",
  );
  assert(
    gravityOutput.map((row) => row[2]).join(",") === "berry,lemon,orange,blueberry",
    "Gravity should keep full columns in the same order.",
  );

  const cascade = {
    ...createState("easy", seededRandom(10)),
    board: makeCascadeBoard(),
    phase: "running" as const,
    selected: null,
  };
  assert(findMatches(cascade.board).size === 0, "Cascade fixture must start without a match.");
  const cascadeSwap = reduce(cascade, { type: "swap", from: [2, 0], to: [2, 1] });
  assert(cascadeSwap.matchesToClear.length >= 3, "The cascade fixture swap should create a match.");
  const firstClear = reduce(cascadeSwap, { type: "resolve" }, () => 0);
  const cascadeAfterGravity = reduce(firstClear, { type: "resolve" }, () => 0);
  assert(cascadeAfterGravity.phase === "resolving", "A refill-created match should begin a cascade.");
  assert(cascadeAfterGravity.cascade === 2 && cascadeAfterGravity.lastCombo === 2, "Cascades should increase the combo multiplier.");
  assert(cascadeAfterGravity.matchesToClear.length >= 3, "The cascade match should be identified for clearing.");
  const cascadeScore = reduce(cascadeAfterGravity, { type: "resolve" }, () => 0);
  assert(cascadeScore.score > firstClear.score, "Cascade matches should award multiplied score.");

  const runningGame = { ...initialForInvalid, phase: "running" as const };
  const pauseCandidate = reduce(runningGame, { type: "pause" });
  assert(pauseCandidate.phase === "paused" && pauseCandidate.resumePhase === "running", "An active game should pause.");
  assert(reduce(pauseCandidate, { type: "resume" }).phase === "running", "An active game should resume.");
  let paused = reduce(cascadeSwap, { type: "pause" });
  assert(paused.phase === "paused" && paused.resumePhase === "resolving", "A cascade may be paused without losing its pending work.");
  const pausedTimer = reduce(paused, { type: "tick" });
  assert(pausedTimer.elapsedSeconds === paused.elapsedSeconds, "The timer should stop while paused.");
  assert(reduce(paused, { type: "resolve" }) === paused, "Pending cascade steps should wait while paused.");
  paused = reduce(paused, { type: "resume" });
  assert(paused.phase === "resolving", "Resuming should continue the interrupted cascade.");

  const goalState: State = {
    ...createState("easy", seededRandom(12)),
    phase: "resolving",
    score: 900,
    gravityPending: false,
  };
  const completed = reduce(goalState, { type: "resolve" });
  assert(completed.phase === "level-complete", "Reaching the goal should complete a non-final level.");
  assert(completed.bestScore === 900, "Completing a level should update its best score.");
  assert(reduce(completed, { type: "next-level" }).level === 2, "A cleared level should advance to the next level.");

  const finalLevel: State = {
    ...createState("easy", seededRandom(13), LEVEL_COUNT),
    phase: "resolving",
    score: createState("easy", seededRandom(13), LEVEL_COUNT).target,
    gravityPending: false,
  };
  assert(reduce(finalLevel, { type: "resolve" }).phase === "won", "Completing the final level should win the game.");
  const outOfMoves = reduce({ ...createState("easy", seededRandom(14)), phase: "resolving", movesLeft: 0 }, { type: "resolve" });
  assert(outOfMoves.phase === "lost", "An unfinished level with no moves should be lost.");
  const retried = reduce(outOfMoves, { type: "retry-level" }, seededRandom(15));
  assert(retried.phase === "ready" && retried.level === 1 && retried.movesLeft > 0, "Retry should restart the current level.");
  const restarted = reduce({ ...completed, level: 2 }, { type: "reset" }, seededRandom(16));
  assert(restarted.level === 1 && restarted.phase === "ready" && restarted.score === 0, "Restart should begin a fresh run at level one.");

  const deadBoard: Board = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 6 }, (_, column) => CANDY_TYPES[(row + 2 * column) % 3]),
  );
  assert(findMatches(deadBoard).size === 0 && !hasPossibleMove(deadBoard), "Dead-board fixture should have no matches or legal swaps.");
  const deadState: State = {
    ...createState("easy", seededRandom(17)),
    board: deadBoard,
    phase: "resolving",
  };
  const reshuffled = reduce(deadState, { type: "resolve" }, seededRandom(18));
  assert(reshuffled.reshuffles === 1, "A board with no legal moves should be reshuffled.");
  assert(findMatches(reshuffled.board).size === 0 && hasPossibleMove(reshuffled.board), "A reshuffled board should be stable and playable.");

  return true;
}
