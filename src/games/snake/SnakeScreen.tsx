import { useEffect, useReducer } from "react";
import { AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, getTickMs, reduce, type Direction, type Difficulty } from "@/games/snake/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function SnakeScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer((current: ReturnType<typeof createState>, action: Parameters<typeof reduce>[1]) => reduce(current, action), undefined, createState);

  useEffect(() => {
    if (!state.running || state.paused || state.gameOver) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), getTickMs(state.difficulty));
    return () => clearInterval(timer);
  }, [state.running, state.paused, state.gameOver, state.difficulty]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && state.running && !state.paused) dispatch({ type: "pause", paused: true });
    });
    return () => subscription.remove();
  }, [state.running, state.paused]);

  const snakeCells = new Set(state.snake.map((point) => `${point.x}:${point.y}`));
  const headKey = state.snake[0] ? `${state.snake[0].x}:${state.snake[0].y}` : "";
  const status = state.gameOver ? "Game over" : state.paused ? "Paused" : state.running ? "Keep moving!" : "Ready to play";

  function restart() {
    dispatch({ type: "reset" });
    dispatch({ type: "start" });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Snake</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{status} · {state.difficulty}</Text></View>
          <Pressable accessibilityLabel={state.paused ? "Resume Snake" : "Pause Snake"} accessibilityRole="button" disabled={!state.running || state.gameOver} onPress={() => dispatch({ type: "pause", paused: !state.paused })} style={[styles.iconButton, { backgroundColor: colors.surface, opacity: state.running && !state.gameOver ? 1 : 0.5 }]}><Ionicons name={state.paused ? "play" : "pause"} size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.statsRow}>
          <Stat label="SCORE" value={state.score.toString()} colors={colors} />
          <Stat label="BEST" value={state.bestScore.toString()} colors={colors} />
          <Stat label="LENGTH" value={state.snake.length.toString()} colors={colors} />
        </View>

        <View style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {Array.from({ length: state.width * state.height }, (_, index) => {
            const x = index % state.width;
            const y = Math.floor(index / state.width);
            const key = `${x}:${y}`;
            const isFood = state.food.x === x && state.food.y === y;
            const isSnake = snakeCells.has(key);
            const isHead = headKey === key;
            return <View key={key} style={[styles.cell, { width: `${100 / state.width}%`, height: `${100 / state.height}%` }, isSnake && { backgroundColor: isHead ? palette.mint : colors.primary }, isFood && { backgroundColor: palette.orange }]}>{isFood ? <View style={styles.foodDot} /> : null}</View>;
          })}
          {state.paused ? <View style={styles.pauseOverlay}><Ionicons name="pause-circle-outline" size={48} color="#FFFFFF" /><Text style={styles.pauseText}>Paused</Text></View> : null}
          {state.gameOver ? <View style={styles.pauseOverlay}><Ionicons name="skull-outline" size={44} color={palette.danger} /><Text style={styles.pauseText}>Game over</Text></View> : null}
        </View>

        <View style={styles.difficultyRow}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((difficulty) => <Pressable key={difficulty} accessibilityLabel={`Choose ${difficulty} Snake speed`} accessibilityRole="button" disabled={state.running} onPress={() => dispatch({ type: "set-difficulty", difficulty })} style={[styles.difficulty, { backgroundColor: state.difficulty === difficulty ? colors.primary : colors.surface, borderColor: state.difficulty === difficulty ? colors.primary : colors.border, opacity: state.running ? 0.6 : 1 }]}><Text style={[styles.difficultyText, { color: state.difficulty === difficulty ? "#FFFFFF" : colors.textSecondary }]}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</Text></Pressable>)}
        </View>

        <View style={styles.controls}>
          <DirectionButton direction="up" onPress={() => dispatch({ type: "turn", direction: "up" })} colors={colors} />
          <View style={styles.horizontalControls}><DirectionButton direction="left" onPress={() => dispatch({ type: "turn", direction: "left" })} colors={colors} /><DirectionButton direction="down" onPress={() => dispatch({ type: "turn", direction: "down" })} colors={colors} /><DirectionButton direction="right" onPress={() => dispatch({ type: "turn", direction: "right" })} colors={colors} /></View>
        </View>

        <Pressable accessibilityLabel={state.running && !state.gameOver ? "Restart Snake game" : "Start Snake game"} accessibilityRole="button" onPress={restart} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Ionicons name={state.gameOver ? "refresh-outline" : "play"} size={18} color="#FFFFFF" /><Text style={styles.primaryText}>{state.running && !state.gameOver ? "Restart game" : state.gameOver ? "Play again" : "Start game"}</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.stat, { backgroundColor: colors.surface }]}><Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]}>{value}</Text></View>;
}

function DirectionButton({ direction, onPress, colors }: { direction: Direction; onPress: () => void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const icon = direction === "up" ? "chevron-up" : direction === "down" ? "chevron-down" : direction === "left" ? "chevron-back" : "chevron-forward";
  return <Pressable accessibilityLabel={`Move ${direction}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.directionButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><Ionicons name={icon} size={24} color={colors.text} /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", flex: 1, padding: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  stat: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  statValue: { marginTop: 3, fontSize: Typography.heading, fontWeight: "900" },
  board: { position: "relative", width: "100%", aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.md, padding: 3, borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  cell: { borderWidth: 0.5, borderColor: "#27345155", alignItems: "center", justifyContent: "center" },
  foodDot: { width: "55%", height: "55%", borderRadius: 99, backgroundColor: "#FFF4" },
  pauseOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020CC", zIndex: 4 },
  pauseText: { marginTop: Spacing.sm, color: "#FFFFFF", fontSize: Typography.heading, fontWeight: "800" },
  difficultyRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  difficulty: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.pill },
  difficultyText: { fontSize: Typography.caption, fontWeight: "800" },
  controls: { alignItems: "center", marginTop: Spacing.md },
  horizontalControls: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  directionButton: { width: 52, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.8 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, borderRadius: Radius.md },
  primaryText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
});
