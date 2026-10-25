import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { games } from "@/games";
import { reduce as reduceTicTacToe, createState as createTicTacToeState, type State as TicTacToeState } from "@/games/tictactoe/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";
import { CandyMatchScreen } from "@/games/candy-match/CandyMatchScreen";
import { CarromScreen } from "@/games/carrom/CarromScreen";
import { MemoryMatchScreen } from "@/games/memory-match/MemoryMatchScreen";
import { TicTacToeScreen } from "@/games/tictactoe/TicTacToeScreen";
import { SudokuScreen } from "@/games/sudoku/SudokuScreen";
import { SnakeScreen } from "@/games/snake/SnakeScreen";
import { LudoScreen } from "@/games/ludo/LudoScreen";
import { SolitaireScreen } from "@/games/solitaire/SolitaireScreen";
import { BrickBreakerScreen } from "@/games/brick-breaker/BrickBreakerScreen";
import { PongScreen } from "@/games/pong/PongScreen";

export default function PlayGameScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = games.find((item) => item.id === id);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [ticTacToe, setTicTacToe] = useState<TicTacToeState>(() => createTicTacToeState());

  const title = game?.title ?? "Game";
  const isTicTacToe = id === "tictactoe";

  if (id === "carrom") return <CarromScreen />;
  if (id === "candy-match") return <CandyMatchScreen />;
  if (id === "memory-match") return <MemoryMatchScreen />;
  if (id === "tictactoe") return <TicTacToeScreen />;
  if (id === "sudoku") return <SudokuScreen />;
  if (id === "snake") return <SnakeScreen />;
  if (id === "ludo") return <LudoScreen />;
  if (id === "solitaire") return <SolitaireScreen />;
  if (id === "brick-breaker") return <BrickBreakerScreen />;
  if (id === "pong") return <PongScreen />;

  function reset() {
    setScore(0);
    setRound(0);
    setTicTacToe(createTicTacToeState());
  }

  function playQuickRound() {
    setScore((value) => value + 10);
    setRound((value) => value + 1);
  }

  if (!game) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><View style={styles.center}><Text style={[styles.title, { color: colors.text }]}>Game not found</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Score {score}</Text></View>
          <Pressable accessibilityLabel="Restart game" accessibilityRole="button" onPress={reset} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="refresh-outline" size={21} color={colors.text} /></Pressable>
        </View>
        {isTicTacToe ? <TicTacToeBoard state={ticTacToe} onMove={(index) => setTicTacToe((state) => reduceTicTacToe(state, { type: "move", index }))} colors={colors} /> : null}
        {!isTicTacToe ? <GenericGame title={title} accent={game.accent} round={round} onPlay={playQuickRound} colors={colors} /> : null}
        <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>CURRENT SCORE</Text><Text style={[styles.scoreValue, { color: colors.text }]}>{isTicTacToe ? ticTacToe.scores.X * 10 : score}</Text></View>
      </View>
    </SafeAreaView>
  );
}

function TicTacToeBoard({ state, onMove, colors }: { state: TicTacToeState; onMove: (index: number) => void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={styles.gameArea}><Text style={[styles.instruction, { color: colors.textSecondary }]}>{state.winner ? state.winner === "draw" ? "Draw game" : `${state.winner} wins!` : `${state.turn}'s turn`}</Text><View style={styles.tttBoard}>{state.board.map((cell, index) => <Pressable key={index} accessibilityLabel={`Tic Tac Toe cell ${index + 1}`} onPress={() => onMove(index)} style={[styles.tttCell, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.tttMark, { color: cell === "X" ? colors.primary : palette.mint }]}>{cell}</Text></Pressable>)}</View></View>;
}

function GenericGame({ title, accent, round, onPlay, colors }: { title: string; accent: string; round: number; onPlay: () => void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.genericCard, { backgroundColor: `${accent}18`, borderColor: accent }]}><Text style={[styles.genericIcon, { color: accent }]}>✦</Text><Text style={[styles.genericTitle, { color: colors.text }]}>{title} is ready</Text><Text style={[styles.instruction, { color: colors.textSecondary }]}>Tap the action button to start a round. Your score updates instantly.</Text><Pressable accessibilityLabel={`Make a move in ${title}`} accessibilityRole="button" onPress={onPlay} style={[styles.playButton, { backgroundColor: accent }]}><Ionicons name="play" size={18} color="#FFFFFF" /><Text style={styles.playText}>{round ? `Play again · Round ${round + 1}` : "Start round"}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", flex: 1, padding: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  gameArea: { alignItems: "center", marginTop: Spacing.xl },
  instruction: { fontSize: Typography.body, textAlign: "center", lineHeight: 21 },
  tttBoard: { width: "92%", maxWidth: 360, aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.lg },
  tttCell: { width: "31.5%", flexGrow: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  tttMark: { fontSize: 44, fontWeight: "800" },
  genericCard: { alignItems: "center", padding: Spacing.xl, marginTop: Spacing.xl, borderWidth: 1, borderRadius: Radius.lg },
  genericIcon: { fontSize: 64 },
  genericTitle: { marginTop: Spacing.md, fontSize: Typography.heading, fontWeight: "800" },
  playButton: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.md },
  playText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  scoreCard: { alignItems: "center", padding: Spacing.md, marginTop: "auto", borderWidth: 1, borderRadius: Radius.md },
  scoreLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  scoreValue: { marginTop: 4, fontSize: 26, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
