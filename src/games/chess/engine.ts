import { Chess, type Move, type Square } from "chess.js";

export type Promotion = "q" | "r" | "b" | "n";
export type DrawClaim = "threefold" | "fifty-move";
export type GameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move"
  | "draw-claimed";

export type MoveRecord = {
  san: string;
  from: Square;
  to: Square;
  promotion?: Promotion;
  captured?: string;
  flags: string;
};

export type State = {
  initialFen: string;
  fen: string;
  history: MoveRecord[];
  status: GameStatus;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  claimedDraw: DrawClaim | null;
};

export type Action =
  | { type: "move"; from: Square; to: Square; promotion?: Promotion }
  | { type: "claim-draw"; reason: DrawClaim }
  | { type: "reset"; fen?: string };

export function createState(fen?: string): State {
  const chess = new Chess(fen);
  return toState(chess, [], chess.fen());
}

export function reduce(state: State, action: Action): State {
  if (action.type === "reset") return createState(action.fen);
  const chess = rebuildChess(state);
  if (action.type === "claim-draw") {
    const canClaim = action.reason === "threefold"
      ? chess.isThreefoldRepetition()
      : chess.isDrawByFiftyMoves();
    if (!canClaim) return state;
    return {
      ...state,
      status: "draw-claimed",
      result: "1/2-1/2",
      claimedDraw: action.reason,
    };
  }
  if (state.status !== "playing" && state.status !== "check") return state;

  try {
    const move = chess.move({
      from: action.from,
      to: action.to,
      promotion: action.promotion,
    });
    return toState(chess, [...state.history, toMoveRecord(move)], state.initialFen);
  } catch {
    return state;
  }
}

export function getLegalMoves(state: State, square: Square): Move[] {
  if (state.status !== "playing" && state.status !== "check") return [];
  return rebuildChess(state).moves({ square, verbose: true });
}

export function getStatusLabel(state: State): string {
  switch (state.status) {
    case "checkmate":
      return `${state.result === "1-0" ? "White" : "Black"} wins by checkmate`;
    case "stalemate":
      return "Draw by stalemate";
    case "insufficient-material":
      return "Draw by insufficient material";
    case "threefold-repetition":
      return "Draw by threefold repetition";
    case "fifty-move":
      return "Draw by 50-move rule";
    case "draw-claimed":
      return `Draw claimed by ${state.claimedDraw === "threefold" ? "threefold repetition" : "50-move rule"}`;
    case "check":
      return `${rebuildChess(state).turn() === "w" ? "White" : "Black"} is in check`;
    default:
      return `${rebuildChess(state).turn() === "w" ? "White" : "Black"} to move`;
  }
}

export const getScore = (state: State) => state.result === "1-0" ? 100 : state.result === "0-1" ? 0 : state.result ? 50 : 0;

function toState(chess: Chess, history: MoveRecord[], initialFen: string): State {
  const status = getGameStatus(chess);
  return {
    initialFen,
    fen: chess.fen(),
    history,
    status,
    result: status === "checkmate" ? chess.turn() === "w" ? "0-1" : "1-0" : isDrawStatus(status) ? "1/2-1/2" : null,
    claimedDraw: null,
  };
}

function rebuildChess(state: State) {
  const chess = new Chess(state.initialFen);
  for (const move of state.history) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  }
  return chess;
}

function getGameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "insufficient-material";
  if (chess.isThreefoldRepetition()) return "threefold-repetition";
  if (chess.isDrawByFiftyMoves()) return "fifty-move";
  return chess.isCheck() ? "check" : "playing";
}

function isDrawStatus(status: GameStatus) {
  return status === "stalemate" || status === "insufficient-material" || status === "threefold-repetition" || status === "fifty-move" || status === "draw-claimed";
}

function toMoveRecord(move: Move): MoveRecord {
  return {
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion as Promotion | undefined,
    captured: move.captured,
    flags: move.flags,
  };
}
