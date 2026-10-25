import { cardCount, createDeck, createState, reduce, type Card, type State, type Suit } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp };
}

function customState(): State {
  return createState(createDeck(() => 0));
}

export function runSolitaireEngineTests() {
  const initial = customState();
  assert(initial.tableau.map((pile) => pile.length).join(",") === "1,2,3,4,5,6,7", "Deal should create seven tableau piles.");
  assert(initial.stock.length === 24 && cardCount(initial) === 52, "Deal should preserve all 52 cards.");

  const legal = { ...customState(), tableau: [[card("hearts", 5)], [card("clubs", 6)], [], [], [], [], []] };
  const moved = reduce(legal, { type: "move", from: { area: "tableau", pile: 0 }, to: { area: "tableau", pile: 1 } });
  assert(moved.tableau[1].length === 2 && moved.moves === 1, "Alternating-color descending move should be accepted.");

  const invalid = reduce(legal, { type: "move", from: { area: "tableau", pile: 1 }, to: { area: "tableau", pile: 0 } });
  assert(invalid === legal, "Illegal tableau move should leave state unchanged.");

  const foundationMove = reduce({ ...customState(), waste: [card("hearts", 1)] }, { type: "move", from: { area: "waste" }, to: { area: "foundation", pile: "hearts" } });
  assert(foundationMove.foundations.hearts[0]?.rank === 1, "Ace should start its matching foundation.");

  const stock = customState();
  const drawn = reduce(stock, { type: "draw" });
  assert(drawn.stock.length === 23 && drawn.waste[0]?.faceUp && cardCount(drawn) === 52, "Stock draw should move one card to waste.");
  const recycleState = { ...stock, stock: [], waste: stock.stock.map((stockCard) => ({ ...stockCard, faceUp: true })) };
  const recycled = reduce(recycleState, { type: "draw" });
  assert(recycled.stock.length === 24 && recycled.waste.length === 0 && cardCount(recycled) === 52, "Empty stock should recycle waste without losing cards.");

  const flipState = { ...customState(), tableau: [[card("spades", 7, false)], [], [], [], [], [], []] };
  const flipped = reduce(flipState, { type: "move", from: { area: "tableau", pile: 0 }, to: { area: "tableau", pile: 1 } });
  assert(flipped === flipState, "Face-down cards cannot be moved.");

  const undo = reduce(drawn, { type: "undo" });
  assert(undo.stock.length === stock.stock.length && undo.waste.length === stock.waste.length && undo.moves === stock.moves, "Undo should restore the exact previous state.");

  const winning: State = {
    ...customState(),
    tableau: suits.map((suit) => [card(suit, 13)]),
    stock: [],
    waste: [],
    foundations: {
      hearts: Array.from({ length: 12 }, (_, index) => card("hearts", index + 1)),
      diamonds: Array.from({ length: 12 }, (_, index) => card("diamonds", index + 1)),
      clubs: Array.from({ length: 12 }, (_, index) => card("clubs", index + 1)),
      spades: Array.from({ length: 12 }, (_, index) => card("spades", index + 1)),
    },
    undoStack: [],
  };
  let complete = winning;
  for (let index = 0; index < 4; index++) complete = reduce(complete, { type: "move", from: { area: "tableau", pile: index }, to: { area: "foundation", pile: suits[index] } });
  assert(complete.won && cardCount(complete) === 52, "Completing all foundations should win and conserve all cards.");
  assert(reduce(complete, { type: "draw" }) === complete, "Won games should reject further actions.");
  return true;
}
