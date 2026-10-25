export type GameCategory = "Board" | "Puzzle" | "Arcade" | "Card";

export type GameDefinition = {
  id: string;
  title: string;
  emoji: string;
  category: GameCategory;
  description: string;
  accent: string;
  difficulty: string;
  score: number;
};

export const games: GameDefinition[] = [
  { id: "chess", title: "Chess", emoji: "♟", category: "Board", description: "Think ahead, outplay your opponent.", accent: "#7C5CFC", difficulty: "Strategic", score: 1240 },
  { id: "carrom", title: "Carrom", emoji: "◉", category: "Board", description: "Slide, aim and pocket with style.", accent: "#45D6B3", difficulty: "Medium", score: 860 },
  { id: "tictactoe", title: "Tic Tac Toe", emoji: "✕", category: "Puzzle", description: "A tiny board. Endless possibilities.", accent: "#FF9D5C", difficulty: "Easy", score: 32 },
  { id: "sudoku", title: "Sudoku", emoji: "▦", category: "Puzzle", description: "Find your calm in the numbers.", accent: "#65A8FF", difficulty: "Medium", score: 720 },
  { id: "snake", title: "Snake", emoji: "🐍", category: "Arcade", description: "Grow fast. Stay sharp.", accent: "#57D68D", difficulty: "Easy", score: 1560 },
  { id: "ludo", title: "Ludo", emoji: "🎲", category: "Board", description: "Roll into your next victory.", accent: "#FF6B7A", difficulty: "Easy", score: 410 },
  { id: "solitaire", title: "Solitaire", emoji: "♠", category: "Card", description: "A classic reset for your brain.", accent: "#D98BFF", difficulty: "Easy", score: 980 },
  { id: "brick-breaker", title: "Brick Breaker", emoji: "▰", category: "Arcade", description: "Bounce, break and beat your best.", accent: "#FFCB66", difficulty: "Hard", score: 2150 },
  { id: "pong", title: "Pong", emoji: "▥", category: "Arcade", description: "Simple to learn. Hard to master.", accent: "#70D7FF", difficulty: "Medium", score: 840 },
  { id: "memory-match", title: "Memory Match", emoji: "🧠", category: "Puzzle", description: "Match pairs and flex your memory.", accent: "#F58CAC", difficulty: "Medium", score: 24 },
  { id: "candy-match", title: "Candy Match", emoji: "🍬", category: "Puzzle", description: "Sweet combos, satisfying clears.", accent: "#FF7EB6", difficulty: "Easy", score: 1870 },
];
