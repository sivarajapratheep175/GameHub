import { countSolutions, createState, isValidGrid, isValidMove, reduce, solveGrid } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runSudokuEngineTests() {
  const state = createState("easy");
  assert(isValidMove(state.grid, 0, 2, 4), "A valid row/column/box candidate should be accepted.");
  assert(!isValidMove(state.grid, 0, 2, 5), "A row conflict should be rejected.");
  assert(!isValidMove(state.grid, 0, 2, 9), "A box conflict should be rejected.");

  const invalid = state.grid.map((row) => [...row]);
  invalid[0][2] = 5;
  assert(!isValidGrid(invalid) && countSolutions(invalid) === 0, "Invalid puzzles must not be solvable.");

  const solution = solveGrid(state.puzzle);
  assert(solution !== null && countSolutions(state.puzzle) === 1, "Preset puzzles must have exactly one solution.");

  const fixed = reduce(state, { type: "set", row: 0, col: 0, value: 4 });
  assert(fixed.grid[0][0] === 5 && fixed.mistakes === 0, "Fixed clues must not be modified.");

  const wrong = reduce(state, { type: "set", row: 0, col: 2, value: 1 });
  assert(wrong.mistakes === 1 && wrong.grid[0][2] === 0, "Wrong entries should count as mistakes without changing the grid.");

  const hinted = reduce(state, { type: "hint", row: 0, col: 2 });
  assert(hinted.grid[0][2] === state.solution[0][2] && hinted.hintsUsed === 1, "Hints should insert the verified solution value.");

  let complete = state;
  for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) if (complete.puzzle[row][col] === 0) complete = reduce(complete, { type: "set", row, col, value: complete.solution[row][col] });
  assert(complete.finished, "A fully correct grid should complete the puzzle.");

  return true;
}
