import { useEffect, useMemo, useReducer, useRef } from "react";
import { AppState, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, reduce, type Side, type State } from "@/games/pong/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function PongScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer((current: State, action: Parameters<typeof reduce>[1]) => reduce(current, action), undefined, createState);
  const stateRef = useRef(state);
  const courtSize = useRef({ width: 1, height: 1 });
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (state.phase !== "running") return;
    let frameId = 0;
    let previous = 0;
    const frame = (timestamp: number) => {
      if (!previous) previous = timestamp;
      dispatch({ type: "frame", deltaMs: Math.min(timestamp - previous, 100) });
      previous = timestamp;
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
    onStartShouldSetPanResponder: () => stateRef.current.phase === "running",
    onMoveShouldSetPanResponder: () => stateRef.current.phase === "running",
    onPanResponderGrant: (event) => movePaddleAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderMove: (event) => movePaddleAt(event.nativeEvent.locationX, event.nativeEvent.locationY),
  }), []);

  function movePaddleAt(x: number, y: number) {
    const current = stateRef.current;
    const side: Side = current.mode === "computer" || x < courtSize.current.width / 2 ? "left" : "right";
    dispatch({ type: "movePaddle", player: side, y: y / Math.max(1, courtSize.current.height) });
  }

  const status = state.phase === "ready" ? "Tap start to serve" : state.phase === "running" ? state.mode === "computer" ? "Drag to control your paddle" : "Drag on your half to control each paddle" : state.phase === "paused" ? "Match paused" : `${state.winner === "left" ? "Left player" : "Right player"} wins!`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Pong</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{status}</Text></View>
          <Pressable accessibilityLabel="Restart Pong match" accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="refresh-outline" size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.optionRow}>
          <Option label="2 Players" active={state.mode === "local"} onPress={() => dispatch({ type: "set-mode", mode: "local" })} colors={colors} />
          <Option label="Vs Computer" active={state.mode === "computer"} onPress={() => dispatch({ type: "set-mode", mode: "computer" })} colors={colors} />
        </View>
        <View style={styles.scoreRow}>
          <View style={[styles.playerScore, { backgroundColor: colors.surface }]}><Text style={[styles.playerLabel, { color: colors.textSecondary }]}>LEFT PLAYER</Text><Text style={[styles.scoreValue, { color: colors.primary }]}>{state.scores.left}</Text></View>
          <Text style={[styles.scoreDivider, { color: colors.textSecondary }]}>:</Text>
          <View style={[styles.playerScore, { backgroundColor: colors.surface }]}><Text style={[styles.playerLabel, { color: colors.textSecondary }]}>{state.mode === "computer" ? "COMPUTER" : "RIGHT PLAYER"}</Text><Text style={[styles.scoreValue, { color: palette.mint }]}>{state.scores.right}</Text></View>
        </View>

        <View
          {...panResponder.panHandlers}
          onLayout={(event) => { courtSize.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }; }}
          style={[styles.court, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.centerLine, { backgroundColor: colors.border }]} />
          <View style={[styles.centerCircle, { borderColor: colors.border }]} />
          <View style={[styles.paddle, styles.leftPaddle, { top: `${(state.paddles.left - state.paddleHeight / 2) * 100}%`, height: `${state.paddleHeight * 100}%`, backgroundColor: colors.primary }]} />
          <View style={[styles.paddle, styles.rightPaddle, { top: `${(state.paddles.right - state.paddleHeight / 2) * 100}%`, height: `${state.paddleHeight * 100}%`, backgroundColor: palette.mint }]} />
          <View style={[styles.ball, { left: `${(state.ball.x - state.ball.radius) * 100}%`, top: `${(state.ball.y - state.ball.radius) * 100}%`, width: `${state.ball.radius * 200}%`, aspectRatio: 1, backgroundColor: "#FFFFFF" }]} />
          {state.phase === "paused" ? <Overlay title="Paused" /> : state.phase === "finished" ? <Overlay title={`${state.winner === "left" ? "Left player" : "Right player"} wins!`} /> : null}
        </View>

        <View style={styles.settingsRow}>
          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Play to</Text>
          {[5, 7, 11].map((score) => <Option key={score} label={String(score)} active={state.winningScore === score} onPress={() => dispatch({ type: "set-winning-score", score })} colors={colors} compact />)}
        </View>
        {state.mode === "computer" ? <View style={styles.settingsRow}><Text style={[styles.settingLabel, { color: colors.textSecondary }]}>AI</Text>{[{ label: "Relaxed", value: 0.25 }, { label: "Normal", value: 0.55 }, { label: "Quick", value: 1 }].map((item) => <Option key={item.label} label={item.label} active={state.aiReaction === item.value} onPress={() => dispatch({ type: "set-ai-reaction", reaction: item.value })} colors={colors} compact />)}</View> : null}

        <View style={styles.controls}>
          {state.phase === "ready" ? <Control title={state.scores.left || state.scores.right ? "Continue match" : "Start match"} icon="play" onPress={() => dispatch({ type: "start" })} colors={colors} /> : null}
          {state.phase === "running" ? <Control title="Pause" icon="pause" onPress={() => dispatch({ type: "pause" })} colors={colors} /> : null}
          {state.phase === "paused" ? <Control title="Resume" icon="play" onPress={() => dispatch({ type: "resume" })} colors={colors} /> : null}
          {state.phase === "finished" ? <Control title="Play again" icon="refresh-outline" onPress={() => dispatch({ type: "reset" })} colors={colors} /> : null}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{state.mode === "computer" ? "Drag vertically anywhere to move your paddle. AI reaction speed is adjustable." : "Drag vertically on either half of the court to move that player’s paddle."}</Text>
      </View>
    </SafeAreaView>
  );
}

function Option({ label, active, onPress, colors, compact = false }: { label: string; active: boolean; onPress: () => void; colors: ReturnType<typeof useAppTheme>["colors"]; compact?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={[styles.option, compact && styles.compactOption, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.optionText, { color: active ? "#FFFFFF" : colors.textSecondary }]}>{label}</Text></Pressable>;
}

function Control({ title, icon, onPress, colors }: { title: string; icon: "play" | "pause" | "refresh-outline"; onPress: () => void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress} style={[styles.control, { backgroundColor: colors.primary }]}><Ionicons name={icon} size={18} color="#FFFFFF" /><Text style={styles.controlText}>{title}</Text></Pressable>;
}

function Overlay({ title }: { title: string }) {
  return <View style={styles.overlay}><Text style={styles.overlayText}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", flex: 1, padding: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  optionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  option: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.pill },
  compactOption: { flex: 0, minWidth: 52, paddingHorizontal: Spacing.sm },
  optionText: { fontSize: Typography.caption, fontWeight: "800" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  playerScore: { flex: 1, alignItems: "center", padding: Spacing.sm, borderRadius: Radius.md },
  playerLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  scoreValue: { marginTop: 2, fontSize: Typography.title, fontWeight: "900" },
  scoreDivider: { fontSize: Typography.heading, fontWeight: "800" },
  court: { position: "relative", width: "100%", aspectRatio: 0.72, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  centerLine: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, opacity: 0.7 },
  centerCircle: { position: "absolute", top: "41%", left: "35%", width: "30%", aspectRatio: 1, borderWidth: 1, borderRadius: 999 },
  paddle: { position: "absolute", width: "2.8%", borderRadius: 99 },
  leftPaddle: { left: "3%" },
  rightPaddle: { right: "3%" },
  ball: { position: "absolute", borderRadius: 99 },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  settingLabel: { width: 55, fontSize: Typography.caption, fontWeight: "800" },
  controls: { minHeight: 50, marginTop: Spacing.md },
  control: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, borderRadius: Radius.md },
  controlText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  hint: { marginTop: Spacing.sm, fontSize: Typography.caption, lineHeight: 18, textAlign: "center" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020CC", zIndex: 5 },
  overlayText: { color: "#FFFFFF", fontSize: Typography.title, fontWeight: "900" },
});
