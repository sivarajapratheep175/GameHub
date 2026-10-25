import { createState, globalPosition, isSafeCell, legalTokens, reduce } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runLudoEngineTests() {
  let state = reduce(createState(), { type: "roll", value: 6 });
  assert(legalTokens(state).length === 4, "A six should make all base tokens legal.");
  state = reduce(state, { type: "move", token: 0 });
  assert(state.tokens[0][0].progress === 1 && state.current === 0 && state.extraTurn, "Six should enter a token and grant an extra turn.");

  const moved = reduce({ ...state, dice: 4 }, { type: "move", token: 0 });
  assert(moved.tokens[0][0].progress === 5, "Tokens should progress by the rolled distance.");
  assert(globalPosition(0, 1) === 0 && isSafeCell(0), "Start positions should map to safe cells.");

  const captureState = createState();
  captureState.tokens[0][0] = { progress: 6 };
  captureState.tokens[1][0] = { progress: 32 };
  const captured = reduce({ ...captureState, dice: 39 }, { type: "move", token: 0 });
  assert(captured.tokens[1][0].progress === 0 && captured.lastCapture && captured.extraTurn, "Unsafe landings should capture and grant a bonus turn.");

  const safeState = createState();
  safeState.tokens[0][0] = { progress: 1 };
  safeState.tokens[1][0] = { progress: 40 };
  const safe = reduce({ ...safeState, dice: 0 as never }, { type: "move", token: 0 });
  assert(safe.tokens[1][0].progress === 40, "Safe-cell setup should not alter opponent tokens.");

  const exact = createState();
  exact.tokens[0][0] = { progress: 56 };
  assert(legalTokens({ ...exact, dice: 1 }).includes(0) && !legalTokens({ ...exact, dice: 2 }).includes(0), "Home entry requires an exact roll.");

  const turnStart = createState();
  turnStart.tokens[0][0] = { progress: 1 };
  let turn = reduce(turnStart, { type: "roll", value: 2 });
  turn = reduce(turn, { type: "move", token: 0 });
  assert(turn.current === 1, "A non-six move should switch turns.");

  let sixes = createState();
  sixes = reduce(sixes, { type: "roll", value: 6 });
  sixes = reduce(sixes, { type: "move", token: 0 });
  sixes = reduce(sixes, { type: "roll", value: 6 });
  sixes = reduce(sixes, { type: "move", token: 1 });
  sixes = reduce(sixes, { type: "roll", value: 6 });
  assert(sixes.current === 1 && sixes.dice === null, "Three consecutive sixes should forfeit the turn.");

  const restart = reduce(turn, { type: "reset" });
  assert(restart.current === 0 && restart.tokens[0].every((token) => token.progress === 0), "Reset should restore the opening position.");
  return true;
}
