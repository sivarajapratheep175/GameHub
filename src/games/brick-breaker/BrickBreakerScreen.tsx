import { useEffect, useMemo, useReducer, useRef } from "react";
import { AppState, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, reduce, type State } from "@/games/brick-breaker/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function BrickBreakerScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer(reduce, undefined, createState);
  const stateRef = useRef(state);
  const boardWidth = useRef(1);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (state.phase !== "running") return;
    let frameId = 0;
    let previousTime = 0;
    let accumulator = 0;
    const frame = (timestamp: number) => {
      if (!previousTime) previousTime = timestamp;
      accumulator += Math.min((timestamp - previousTime) / 1000, 0.1);
      previousTime = timestamp;
      const stepMs = 1000 / 120;
      while (accumulator >= stepMs) {
        dispatch({ type: "frame", deltaMs: stepMs });
        accumulator -= stepMs;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [state.phase]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState !== "active" && stateRef.current.phase === "running") dispatch({ type: "pause" });
    });
    return () => subscription.remove();
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => stateRef.current.phase === "running" || stateRef.current.phase === "ready",
    onMoveShouldSetPanResponder: () => stateRef.current.phase === "running" || stateRef.current.phase === "ready",
    onPanResponderGrant: (event) => {
      const x = event.nativeEvent.locationX / Math.max(boardWidth.current, 1);
      dispatch({ type: "movePaddle", x });
      if (stateRef.current.phase === "ready") dispatch({ type: "start" });
    },
    onPanResponderMove: (event) => dispatch({ type: "movePaddle", x: event.nativeEvent.locationX / Math.max(boardWidth.current, 1) }),
  }), []);

  const status = state.phase === "ready" ? state.lives < 3 ? "Tap or drag to serve again" : "Tap or drag to launch" : state.phase === "running" ? "Drag to move the paddle" : state.phase === "paused" ? "Paused" : state.phase === "level-complete" ? "Level cleared!" : state.phase === "won" ? "You won!" : "Game over";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Brick Breaker</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{status}</Text></View>
          <Pressable accessibilityLabel="Restart Brick Breaker" accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="refresh-outline" size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.statsRow}>
          <Stat label="SCORE" value={state.score.toString()} colors={colors} />
          <Stat label="LEVEL" value={state.level.toString()} colors={colors} />
          <Stat label="LIVES" value={"♥ ".repeat(state.lives).trim() || "0"} colors={colors} />
        </View>

        <View
          {...panResponder.panHandlers}
          onLayout={(event) => { boardWidth.current = event.nativeEvent.layout.width; }}
          style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {state.bricks.filter((brick) => brick.alive).map((brick) => <View key={brick.id} style={[styles.brick, { left: `${brick.x * 100}%`, top: `${brick.y * 100}%`, width: `${brick.width * 100}%`, height: `${brick.height * 100}%`, backgroundColor: brick.value >= 30 ? palette.orange : brick.value >= 20 ? palette.primary : palette.mint }]} />)}
          <View style={[styles.paddle, { left: `${(state.paddle.x - state.paddle.width / 2) * 100}%`, top: `${(state.paddle.y - state.paddle.height / 2) * 100}%`, width: `${state.paddle.width * 100}%`, height: `${state.paddle.height * 100}%`, backgroundColor: colors.primary }]} />
          <View style={[styles.ball, { left: `${(state.ball.x - state.ball.radius) * 100}%`, top: `${(state.ball.y - state.ball.radius) * 100}%`, width: `${state.ball.radius * 200}%`, aspectRatio: 1, backgroundColor: "#FFFFFF" }]} />
          {state.phase === "paused" ? <Overlay title="Paused" icon="pause-circle-outline" /> : null}
          {state.phase === "game-over" ? <Overlay title="Game over" icon="close-circle-outline" /> : null}
          {state.phase === "won" ? <Overlay title="You won!" icon="trophy-outline" /> : null}
          {state.phase === "level-complete" ? <Overlay title="Level cleared!" icon="checkmark-circle-outline" /> : null}
        </View>

        <View style={styles.controls}>
          {state.phase === "ready" ? <GameButton title={state.lives < 3 ? "Serve ball" : "Start game"} icon="play" color={colors.primary} onPress={() => dispatch({ type: "start" })} /> : null}
          {state.phase === "running" ? <GameButton title="Pause" icon="pause" color={colors.surface} onPress={() => dispatch({ type: "pause" })} textColor={colors.text} /> : null}
          {state.phase === "paused" ? <GameButton title="Resume" icon="play" color={colors.primary} onPress={() => dispatch({ type: "resume" })} /> : null}
          {state.phase === "level-complete" ? <GameButton title="Next level" icon="arrow-forward" color={colors.primary} onPress={() => dispatch({ type: "nextLevel" })} /> : null}
          {state.phase === "game-over" || state.phase === "won" ? <GameButton title="Play again" icon="refresh-outline" color={colors.primary} onPress={() => dispatch({ type: "reset" })} /> : null}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Touch and drag anywhere on the board to control the paddle.</Text>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.stat, { backgroundColor: colors.surface }]}><Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]}>{value}</Text></View>;
}

function GameButton({ title, icon, color, onPress, textColor = "#FFFFFF" }: { title: string; icon: "play" | "pause" | "arrow-forward" | "refresh-outline"; color: string; onPress: () => void; textColor?: string }) {
  return <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress} style={[styles.gameButton, { backgroundColor: color }]}><Ionicons name={icon} size={18} color={textColor} /><Text style={[styles.buttonText, { color: textColor }]}>{title}</Text></Pressable>;
}

function Overlay({ title, icon }: { title: string; icon: "pause-circle-outline" | "close-circle-outline" | "trophy-outline" | "checkmark-circle-outline" }) {
  return <View style={styles.overlay}><Ionicons name={icon} size={48} color={palette.orange} /><Text style={styles.overlayText}>{title}</Text></View>;
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
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  statValue: { marginTop: 3, fontSize: Typography.body, fontWeight: "900" },
  board: { position: "relative", width: "100%", aspectRatio: 1, alignSelf: "center", marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  brick: { position: "absolute", borderRadius: 4, borderWidth: 1, borderColor: "#FFFFFF55" },
  paddle: { position: "absolute", borderRadius: 99 },
  ball: { position: "absolute", borderRadius: 99 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020CC", zIndex: 5 },
  overlayText: { marginTop: Spacing.sm, color: "#FFFFFF", fontSize: Typography.title, fontWeight: "900" },
  controls: { minHeight: 52, marginTop: Spacing.md },
  gameButton: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, borderRadius: Radius.md },
  buttonText: { fontSize: Typography.button, fontWeight: "800" },
  hint: { marginTop: Spacing.sm, fontSize: Typography.caption, textAlign: "center" },
});
