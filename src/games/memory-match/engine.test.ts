import {
  createState,
  getBestPerformance,
  isBetterPerformance,
  reduce,
  type State,
} from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function findPair(cards: State["cards"], pair: string) {
  return cards.flatMap((card, index) => card.pair === pair ? [index] : []);
}

function finishGame(state: State) {
  const pairs = [...new Set(state.cards.map((card) => card.pair))];
  for (const pair of pairs) {
    const [first, second] = findPair(state.cards, pair);
    state = reduce(state, { type: "flip", index: first });
    state = reduce(state, { type: "flip", index: second });
  }
  return state;
}

export function runMemoryMatchEngineTests() {
  let randomCalls = 0;
  const shuffled = createState("hard", () => {
    randomCalls += 1;
    return 0.5;
  });
  assert(shuffled.cards.length === 36 && randomCalls === 35, "Hard mode should shuffle all 36 cards with Fisher–Yates.");
  assert(new Set(shuffled.cards.map((card) => card.id)).size === 36, "Every shuffled card should have a unique ID.");
  assert(
    [...new Set(shuffled.cards.map((card) => card.pair))].every(
      (pair) => shuffled.cards.filter((card) => card.pair === pair).length === 2,
    ),
    "The deck should contain exactly two cards for every symbol.",
  );
  const orderFromZero = createState("easy", () => 0).cards.map((card) => card.id).join(",");
  const orderFromHigh = createState("easy", () => 0.999999).cards.map((card) => card.id).join(",");
  assert(orderFromZero !== orderFromHigh, "Changing the random source should change the shuffled deck order.");

  const easy = createState("easy", () => 0);
  const firstPair = easy.cards[0].pair;
  const [first, second] = findPair(easy.cards, firstPair);
  const matched = reduce(reduce(easy, { type: "flip", index: first }), { type: "flip", index: second });
  assert(matched.matchedPairs === 1 && matched.moves === 1, "Matching cards should count one move and one pair.");
  assert(matched.cards[first].matched && matched.cards[second].matched, "A found pair should stay face-up and matched.");
  assert(matched.first === null && matched.second === null, "A matched pair should release the turn lock.");
  assert(matched.phase === "playing", "A non-final pair should keep the game running.");

  const otherPair = easy.cards.find((card) => card.pair !== firstPair)?.pair;
  if (otherPair === undefined) throw new Error("The deck should contain more than one pair.");
  const mismatchFirst = findPair(easy.cards, firstPair)[0];
  const mismatchSecond = findPair(easy.cards, otherPair)[0];
  const mismatchThird = easy.cards.findIndex((card, index) => index !== mismatchFirst && index !== mismatchSecond);
  let mismatch = reduce(easy, { type: "flip", index: mismatchFirst });
  mismatch = reduce(mismatch, { type: "flip", index: mismatchSecond });
  assert(mismatch.moves === 1 && mismatch.second === mismatchSecond, "A mismatch should count one move and remain pending.");
  assert(mismatch.cards[mismatchFirst].flipped && mismatch.cards[mismatchSecond].flipped, "A mismatch should remain visible until resolved.");
  assert(reduce(mismatch, { type: "flip", index: mismatchThird }) === mismatch, "No third card may be flipped during the mismatch delay.");
  assert(reduce(mismatch, { type: "flip", index: mismatchFirst }) === mismatch, "The same revealed card cannot be flipped twice.");
  const resolved = reduce(mismatch, { type: "resolve" });
  assert(!resolved.cards[mismatchFirst].flipped && !resolved.cards[mismatchSecond].flipped, "Resolving a mismatch should hide both cards.");
  assert(resolved.first === null && resolved.second === null, "Resolving a mismatch should unlock card input.");
  assert(reduce(resolved, { type: "resolve" }) === resolved, "A repeated resolve action should be harmless.");

  assert(reduce(easy, { type: "flip", index: -1 }) === easy, "Negative card indexes should be rejected.");
  assert(reduce(easy, { type: "flip", index: easy.cards.length }) === easy, "Out-of-range card indexes should be rejected.");
  assert(reduce(easy, { type: "flip", index: 0.5 }) === easy, "Fractional card indexes should be rejected.");
  assert(reduce(matched, { type: "flip", index: first }) === matched, "Already matched cards should reject input.");

  let paused = reduce(reduce(easy, { type: "flip", index: first }), { type: "pause" });
  const elapsedWhilePaused = reduce(paused, { type: "tick" });
  assert(elapsedWhilePaused.elapsedSeconds === paused.elapsedSeconds, "The timer should stop while paused.");
  assert(reduce(paused, { type: "flip", index: second }) === paused, "Paused games should reject card input.");
  assert(reduce(paused, { type: "resolve" }) === paused, "A pending mismatch should not resolve while paused.");
  paused = reduce(paused, { type: "resume" });
  assert(paused.phase === "playing", "Resume should return the game to play.");

  const easyComplete = finishGame(createState("easy", () => 0));
  assert(easyComplete.phase === "finished" && easyComplete.matchedPairs === 8, "The final pair should finish the 4 × 4 game.");
  assert(easyComplete.moves === 8, "A perfect game should take one move per pair.");
  assert(easyComplete.newRecord && easyComplete.bestMoves === 8, "A completed first game should set a best record.");
  assert(reduce(easyComplete, { type: "flip", index: 0 }) === easyComplete, "A completed game should reject further moves.");

  const seeded = createState("easy", () => 0, { moves: 6, elapsedSeconds: 50 });
  const seededComplete = finishGame(seeded);
  assert(!seededComplete.newRecord && seededComplete.bestMoves === 6, "A worse game should not replace the existing best.");
  assert(
    isBetterPerformance({ moves: 10, elapsedSeconds: 49 }, { moves: 10, elapsedSeconds: 50 }),
    "A faster time should break a tie in move count.",
  );
  assert(
    getBestPerformance(easyComplete)?.moves === 8 && getBestPerformance(easyComplete)?.elapsedSeconds === 0,
    "Best performance should expose the saved move and time pair.",
  );

  const resized = reduce(easy, { type: "set-difficulty", difficulty: "hard" });
  assert(resized.difficulty === "hard" && resized.cards.length === 36, "Difficulty selection should create the selected grid.");
  assert(
    reduce(matched, { type: "set-difficulty", difficulty: "medium" }) === matched,
    "Difficulty should not change after a game has started.",
  );
  const medium = finishGame(createState("medium", () => 0, { moves: 6, elapsedSeconds: 50 }));
  const restarted = reduce(medium, { type: "reset" }, () => 0);
  assert(
    restarted.phase === "ready" && restarted.moves === 0 && restarted.cards.length === 24 &&
      restarted.bestMoves === 6 && restarted.bestTimeSeconds === 50,
    "Restart should reshuffle and reset the game while preserving its difficulty and best performance.",
  );

  return true;
}
