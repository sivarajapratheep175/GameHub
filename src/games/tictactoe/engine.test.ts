import { createState, getWinner, reduce } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function play(indices: number[]) {
  return indices.reduce((state, index) => reduce(state, { type: "move", index }), createState());
}

export function runTicTacToeEngineTests() {
  const row = play([0, 3, 1, 4, 2]);
  assert(row.winner === "X" && JSON.stringify(row.winningLine) === JSON.stringify([0, 1, 2]), "Top row should win for X.");

  const column = play([0, 1, 3, 2, 6]);
  assert(column.winner === "X" && JSON.stringify(column.winningLine) === JSON.stringify([0, 3, 6]), "Left column should win for X.");

  const diagonal = play([0, 1, 4, 2, 8]);
  assert(diagonal.winner === "X" && JSON.stringify(diagonal.winningLine) === JSON.stringify([0, 4, 8]), "Main diagonal should win for X.");

  const otherDiagonal = play([2, 0, 4, 1, 6]);
  assert(otherDiagonal.winner === "X" && JSON.stringify(otherDiagonal.winningLine) === JSON.stringify([2, 4, 6]), "Anti-diagonal should win for X.");

  const draw = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert(draw.winner === "draw" && draw.winningLine === null, "A full board without a winner should draw.");

  const occupied = reduce(reduce(createState(), { type: "move", index: 0 }), { type: "move", index: 0 });
  assert(occupied.board.filter(Boolean).length === 1 && occupied.turn === "O", "Occupied cells must reject the move.");

  const completed = play([0, 3, 1, 4, 2]);
  const afterCompletion = reduce(completed, { type: "move", index: 5 });
  assert(afterCompletion === completed, "Completed games must reject further input.");

  const winner = getWinner(["X", "X", "X", null, null, null, null, null, null]);
  assert(winner.winner === "X" && winner.line?.length === 3, "Winner detection should return a complete line.");
  return true;
}
