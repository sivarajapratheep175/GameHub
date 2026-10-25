import { Chess } from "chess.js";

import { createState, reduce } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runChessEngineTests() {
  const castled = reduce(createState("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), { type: "move", from: "e1", to: "g1" });
  assert(castled.fen.includes("R4RK1"), "Kingside castling should move king and rook.");

  const enPassant = reduce(createState("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"), { type: "move", from: "e5", to: "d6" });
  assert(enPassant.fen.includes("3P4") && !enPassant.fen.includes("p"), "En passant should remove the captured pawn.");

  const promoted = reduce(createState("4k3/P7/8/8/8/8/8/4K3 w - - 0 1"), { type: "move", from: "a7", to: "a8", promotion: "q" });
  assert(promoted.history[0]?.promotion === "q" && promoted.fen.includes("Q"), "Promotion should record and create the selected piece.");

  const checkmate = createState("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
  assert(checkmate.status === "checkmate" && checkmate.result === "1-0", "Checkmate should produce a white win.");

  const stalemate = createState("7k/5Q2/7K/8/8/8/8/8 b - - 0 1");
  assert(stalemate.status === "stalemate" && stalemate.result === "1/2-1/2", "Stalemate should produce a draw.");

  const insufficient = createState("8/8/8/8/8/8/2k5/3K4 w - - 0 1");
  assert(insufficient.status === "insufficient-material", "Bare kings should be insufficient material.");

  const fiftyMove = createState("8/8/8/8/8/8/2k5/R2K4 w - - 100 51");
  assert(fiftyMove.status === "fifty-move", "A position at 100 half-moves should expose a 50-move draw.");

  let repeated = createState();
  for (const move of [
    ["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"],
    ["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"],
  ] as const) {
    repeated = reduce(repeated, { type: "move", from: move[0], to: move[1] });
  }
  assert(repeated.status === "threefold-repetition", "Repeated positions should be detected.");

  const invalid = reduce(createState(), { type: "move", from: "e2", to: "e5" });
  assert(invalid.history.length === 0, "Illegal moves must not change state.");

  return true;
}
