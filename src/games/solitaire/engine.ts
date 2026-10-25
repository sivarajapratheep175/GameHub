export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Card = { id: string; rank: number; suit: Suit; faceUp: boolean };
export type PileArea = "tableau" | "waste" | "foundation";
export type Location = { area: "waste" } | { area: "tableau"; pile: number; index?: number } | { area: "foundation"; pile: Suit };
type Snapshot = Omit<State, "undoStack">;
export type State = {
  tableau: Card[][];
  stock: Card[];
  waste: Card[];
  foundations: Record<Suit, Card[]>;
  moves: number;
  elapsedSeconds: number;
  paused: boolean;
  won: boolean;
  undoStack: Snapshot[];
};
export type Action =
  | { type: "draw" }
  | { type: "move"; from: Location; to: { area: "tableau"; pile: number } | { area: "foundation"; pile: Suit } }
  | { type: "undo" }
  | { type: "tick" }
  | { type: "pause"; paused: boolean }
  | { type: "reset" };

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const isRed = (suit: Suit) => suit === "hearts" || suit === "diamonds";

export function createDeck(random: () => number = Math.random): Card[] {
  const deck = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ id: `${suit}-${index + 1}`, rank: index + 1, suit, faceUp: false })));
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function createState(deck: Card[] = createDeck()): State {
  if (!isStandardDeck(deck)) throw new Error("Solitaire requires a complete standard 52-card deck.");
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let index = 0;
  for (let pile = 0; pile < 7; pile++) {
    for (let row = 0; row <= pile; row++) {
      tableau[pile].push({ ...deck[index++], faceUp: row === pile });
    }
  }
  return {
    tableau,
    stock: deck.slice(index).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: { hearts: [], diamonds: [], clubs: [], spades: [] },
    moves: 0,
    elapsedSeconds: 0,
    paused: false,
    won: false,
    undoStack: [],
  };
}

export function canPlaceOnTableau(card: Card, target: Card | undefined): boolean {
  return target ? isRed(card.suit) !== isRed(target.suit) && card.rank === target.rank - 1 : card.rank === 13;
}

export function isValidSequence(cards: Card[]): boolean {
  if (!cards.length || cards.some((card) => !card.faceUp)) return false;
  for (let index = 0; index < cards.length - 1; index++) {
    if (!canPlaceOnTableau(cards[index + 1], cards[index])) return false;
  }
  return true;
}

export function reduce(state: State, action: Action, random: () => number = Math.random): State {
  if (action.type === "reset") return createState(createDeck(random));
  if (action.type === "pause") return state.won ? state : { ...state, paused: action.paused };
  if (action.type === "tick") return state.paused || state.won ? state : { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
  if (action.type === "undo") {
    const previous = state.undoStack[state.undoStack.length - 1];
    return previous ? { ...cloneSnapshot(previous), undoStack: state.undoStack.slice(0, -1) } : state;
  }
  if (state.won || state.paused) return state;

  if (action.type === "draw") {
    const next = cloneSnapshot(state);
    if (next.stock.length) {
      const card = next.stock.pop()!;
      next.waste.push({ ...card, faceUp: true });
    } else if (next.waste.length) {
      next.stock = next.waste.map((card) => ({ ...card, faceUp: false }));
      next.waste = [];
    } else return state;
    next.moves++;
    return withUndo(state, next);
  }

  const source = getSource(state, action.from);
  if (!source || !source.cards.length) return state;
  const moving = source.cards;
  if (!isValidSequence(moving)) return state;
  if (action.from.area === "foundation" && action.to.area === "foundation" && action.from.pile === action.to.pile) return state;
  if (action.from.area === "tableau" && action.to.area === "tableau" && action.from.pile === action.to.pile) return state;

  const next = cloneSnapshot(state);
  const nextSource = getMutableSource(next, action.from);
  if (!nextSource) return state;
  nextSource.cards.splice(nextSource.start, moving.length);
  if (action.from.area === "tableau") revealLast(next.tableau[action.from.pile]);

  if (action.to.area === "tableau") {
    if (!Number.isInteger(action.to.pile) || action.to.pile < 0 || action.to.pile > 6) return state;
    const targetPile = next.tableau[action.to.pile];
    if (action.from.area === "tableau" && action.from.pile === action.to.pile) return state;
    if (!canPlaceOnTableau(moving[0], targetPile[targetPile.length - 1])) return state;
    targetPile.push(...moving.map((card) => ({ ...card, faceUp: true })));
  } else {
    if (moving.length !== 1) return state;
    const card = moving[0];
    const foundation = next.foundations[action.to.pile];
    if (!foundation || card.suit !== action.to.pile || card.rank !== foundation.length + 1) return state;
    foundation.push({ ...card, faceUp: true });
  }

  next.moves++;
  next.won = SUITS.every((suit) => next.foundations[suit].length === 13);
  return withUndo(state, next);
}

export function cardCount(state: State) {
  return state.stock.length + state.waste.length + Object.values(state.foundations).reduce((total, pile) => total + pile.length, 0) + state.tableau.reduce((total, pile) => total + pile.length, 0);
}

export const getScore = (state: State) => state.won ? Math.max(0, 10000 - state.moves * 10 - Math.floor(state.elapsedSeconds / 10)) : 0;

function getSource(state: State, from: Location): { cards: Card[]; start: number } | null {
  if (from.area === "waste") return state.waste.length ? { cards: [state.waste[state.waste.length - 1]], start: state.waste.length - 1 } : null;
  if (from.area === "foundation") {
    const pile = state.foundations[from.pile];
    return pile.length ? { cards: [pile[pile.length - 1]], start: pile.length - 1 } : null;
  }
  if (!Number.isInteger(from.pile) || from.pile < 0 || from.pile > 6) return null;
  const pile = state.tableau[from.pile];
  const start = from.index ?? pile.length - 1;
  if (!Number.isInteger(start) || start < 0 || start >= pile.length) return null;
  return { cards: pile.slice(start), start };
}

function getMutableSource(state: Snapshot, from: Location) {
  if (from.area === "waste") return { cards: state.waste, start: state.waste.length - 1 };
  if (from.area === "foundation") return { cards: state.foundations[from.pile], start: state.foundations[from.pile].length - 1 };
  const pile = state.tableau[from.pile];
  return { cards: pile, start: from.index ?? pile.length - 1 };
}

function revealLast(pile: Card[]) {
  const last = pile[pile.length - 1];
  if (last && !last.faceUp) last.faceUp = true;
}

function withUndo(previous: State, next: Snapshot): State {
  return { ...next, undoStack: [...previous.undoStack, cloneSnapshot(previous)] };
}

function cloneSnapshot(state: Snapshot): Snapshot {
  return {
    tableau: state.tableau.map((pile) => pile.map((card) => ({ ...card }))),
    stock: state.stock.map((card) => ({ ...card })),
    waste: state.waste.map((card) => ({ ...card })),
    foundations: {
      hearts: state.foundations.hearts.map((card) => ({ ...card })),
      diamonds: state.foundations.diamonds.map((card) => ({ ...card })),
      clubs: state.foundations.clubs.map((card) => ({ ...card })),
      spades: state.foundations.spades.map((card) => ({ ...card })),
    },
    moves: state.moves,
    elapsedSeconds: state.elapsedSeconds,
    paused: state.paused,
    won: state.won,
  };
}

function isStandardDeck(deck: Card[]) {
  if (deck.length !== 52) return false;
  const ids = new Set(deck.map((card) => card.id));
  const identities = new Set(deck.map((card) => `${card.suit}-${card.rank}`));
  return ids.size === 52 && identities.size === 52 && deck.every((card) => SUITS.includes(card.suit) && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13);
}
