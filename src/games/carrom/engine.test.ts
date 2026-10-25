import { advanceFixed, BOARD_MAX, BOARD_MIN, COIN_RADIUS, createState, reduce, STRIKER_RADIUS, type State } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function customState(overrides: Partial<State>): State {
  return { ...createState(), ...overrides };
}

export function runCarromEngineTests() {
  const struck = reduce(createState(), { type: "strike", angle: -Math.PI / 2, power: 0.5 });
  assert(struck.phase === "rolling" && struck.discs.find((disc) => disc.kind === "striker")?.vy !== 0, "A valid strike should start motion.");
  assert(reduce(struck, { type: "strike", angle: 0, power: 1 }) === struck, "A second strike during motion must be rejected.");

  const bounced = advanceFixed(customState({
    phase: "rolling",
    discs: [{
      id: "striker", kind: "striker", x: BOARD_MAX - STRIKER_RADIUS - 0.001, y: 0.5,
      vx: 0.04, vy: 0, radius: STRIKER_RADIUS, pocketed: false,
    }],
  }));
  assert((bounced.discs[0].vx ?? 0) < 0, "A striker hitting the wall should bounce.");

  const collision = advanceFixed(customState({
    phase: "rolling",
    discs: [
      { id: "striker", kind: "striker", x: 0.4, y: 0.5, vx: 0.02, vy: 0, radius: STRIKER_RADIUS, pocketed: false },
      { id: "coin", kind: "coin", color: "white", x: 0.4 + STRIKER_RADIUS + COIN_RADIUS - 0.001, y: 0.5, vx: 0, vy: 0, radius: COIN_RADIUS, pocketed: false },
    ],
  }));
  assert(Math.abs(collision.discs[1].vx) > 0, "Overlapping moving discs should exchange momentum.");

  const pocketed = customState({
    phase: "rolling",
    turnPocketed: false,
    discs: [{ id: "coin", kind: "coin", color: "white", x: BOARD_MIN, y: BOARD_MIN, vx: 0, vy: 0, radius: COIN_RADIUS, pocketed: false }],
  });
  const settled = advanceFixed(pocketed);
  assert(settled.coinsPocketed[0] === 1 && settled.scores[0] === 1, "A player's own coin should score when pocketed.");

  const foul = customState({
    phase: "rolling",
    discs: [{ id: "striker", kind: "striker", x: BOARD_MIN, y: BOARD_MIN, vx: 0, vy: 0, radius: STRIKER_RADIUS, pocketed: false }],
  });
  const foulResult = advanceFixed(foul);
  assert(foulResult.foul?.startsWith("Foul: striker") === true && foulResult.currentPlayer === 1, "Pocketing the striker should foul and switch turns.");

  const reset = reduce(struck, { type: "reset" });
  assert(reset.phase === "aiming" && reset.discs.length === 20, "Reset should restore the queen, 18 coins, and striker.");
  return true;
}
