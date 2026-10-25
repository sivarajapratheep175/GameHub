import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { BOARD_MAX, BOARD_MIN, createState, reduce, type State } from "@/games/carrom/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const BOARD_RATIO = 1;

export function CarromScreen() {
  const { colors } = useAppTheme();
  const [state, setState] = useState<State>(() => createState());
  const stateRef = useRef(state);
  const boardSize = useRef({ width: 0, height: 0 });
  const [aim, setAim] = useState({ angle: -Math.PI / 2, power: 0.5 });
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (paused || state.phase !== "rolling") return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      setState((current) => reduce(current, { type: "frame", deltaMs: delta }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, state.phase]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => stateRef.current.phase === "aiming",
    onMoveShouldSetPanResponder: () => stateRef.current.phase === "aiming",
    onPanResponderMove: (_, gesture) => {
      const width = boardSize.current.width || 1;
      const angle = Math.atan2(gesture.dy, gesture.dx);
      const distance = Math.min(Math.hypot(gesture.dx, gesture.dy), width * 0.42);
      setAim({ angle, power: Math.max(0.08, distance / (width * 0.42)) });
    },
    onPanResponderRelease: () => {
      setState((current) => reduce(current, { type: "strike", angle: aim.angle, power: aim.power }));
    },
  }), [aim.angle, aim.power]);

  const visibleDiscs = state.discs.filter((disc) => !disc.pocketed);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Carrom</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Player {state.currentPlayer + 1} · {state.currentPlayer === 0 ? "White" : "Black"} · Drag to aim</Text></View>
          <Pressable accessibilityLabel={paused ? "Resume game" : "Pause game"} accessibilityRole="button" onPress={() => setPaused((value) => !value)} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name={paused ? "play" : "pause"} size={19} color={colors.text} /></Pressable>
        </View>
        <View style={styles.scoreRow}><Score label="White · You" value={state.scores[0]} active={state.currentPlayer === 0} colors={colors} /><Score label="Black · Opponent" value={state.scores[1]} active={state.currentPlayer === 1} colors={colors} /></View>
        <View
          onLayout={(event) => { boardSize.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }; }}
          {...panResponder.panHandlers}
          style={[styles.board, { backgroundColor: "#B98255", borderColor: "#6B432B" }]}
        >
          <View style={styles.innerBoard}>
            {Array.from({ length: 4 }, (_, index) => <View key={index} style={[styles.pocket, index < 2 ? { top: "-3%", left: index === 0 ? "-3%" : undefined, right: index === 1 ? "-3%" : undefined } : { bottom: "-3%", left: index === 2 ? "-3%" : undefined, right: index === 3 ? "-3%" : undefined }]} />)}
            <View style={styles.centerCircle} />
            {visibleDiscs.map((disc) => <DiscView key={disc.id} disc={disc} />)}
            {state.phase === "aiming" ? <View style={[styles.aimLine, { transform: [{ rotate: `${aim.angle}rad` }], width: `${Math.max(18, aim.power * 42)}%` }]} /> : null}
          </View>
          {paused ? <View style={styles.pauseOverlay}><Ionicons name="pause-circle-outline" size={44} color="#FFFFFF" /><Text style={styles.pauseText}>Paused</Text></View> : null}
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.turnIcon, { backgroundColor: `${palette.mint}22` }]}><Ionicons name="hand-left-outline" size={20} color={palette.mint} /></View>
          <View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.text }]}>{state.finished ? `${state.winner === 0 ? "White" : "Black"} wins!` : state.foul ?? (paused ? "Game paused" : "Drag from the striker to set direction and power.")}</Text><Text style={[styles.infoText, { color: colors.textSecondary }]}>{state.queenPendingFor !== null ? "Queen must be covered with a same-turn coin." : "Pocket your own coin to keep your turn."}</Text></View>
        </View>
        <View style={[styles.rulesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.rulesTitle, { color: colors.text }]}>Casual carrom rules</Text>
          <Text style={[styles.rulesText, { color: colors.textSecondary }]}>White plays first. Pocket your own color to score 1 and continue. The queen is worth 3, but must be covered by your own coin in the same shot. Pocketing the striker or an opponent coin is a foul and ends the turn. Clear your color and cover the queen to win.</Text>
        </View>
        <Pressable accessibilityLabel="Restart Carrom game" accessibilityRole="button" onPress={() => { setState(createState()); setPaused(false); }} style={[styles.restartButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><Ionicons name="refresh-outline" size={18} color={colors.text} /><Text style={[styles.restartText, { color: colors.text }]}>Restart game</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function DiscView({ disc }: { disc: State["discs"][number] }) {
  const color = disc.kind === "striker" ? "#F8FAFC" : disc.kind === "queen" ? palette.danger : "#1A1A25";
  return <View style={[styles.disc, { left: `${disc.x * 100}%`, top: `${disc.y * 100}%`, width: disc.radius * 200, height: disc.radius * 200, marginLeft: -disc.radius * 100, marginTop: -disc.radius * 100, backgroundColor: color, borderColor: disc.kind === "coin" ? palette.orange : "#FFFFFF" }]} />;
}

function Score({ label, value, active, colors }: { label: string; value: number; active: boolean; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.score, { backgroundColor: active ? `${colors.primary}22` : colors.surface }]}><Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.scoreValue, { color: active ? colors.primary : colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", flex: 1, padding: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  scoreRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  score: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md },
  scoreLabel: { fontSize: Typography.caption, fontWeight: "700" },
  scoreValue: { marginTop: 2, fontSize: Typography.heading, fontWeight: "800" },
  board: { width: "100%", aspectRatio: BOARD_RATIO, alignSelf: "center", marginTop: Spacing.md, borderWidth: 8, borderRadius: Radius.md, overflow: "hidden" },
  innerBoard: { flex: 1, position: "relative", margin: 7, borderWidth: 2, borderColor: "#E2B77F" },
  pocket: { position: "absolute", width: "12%", aspectRatio: 1, borderRadius: 99, backgroundColor: "#17131A", zIndex: 2 },
  centerCircle: { position: "absolute", top: "42%", left: "42%", width: "16%", aspectRatio: 1, borderWidth: 2, borderColor: "#E2B77F", borderRadius: 99 },
  disc: { position: "absolute", zIndex: 3, borderWidth: 2, borderRadius: 99 },
  aimLine: { position: "absolute", top: "86%", left: "50%", height: 2, backgroundColor: "#FFFFFF99", transformOrigin: "left center", zIndex: 4 },
  pauseOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020CC", zIndex: 5 },
  pauseText: { marginTop: Spacing.sm, color: "#FFFFFF", fontSize: Typography.heading, fontWeight: "800" },
  infoCard: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  turnIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 12 },
  infoCopy: { flex: 1 },
  infoTitle: { fontSize: Typography.body, fontWeight: "800" },
  infoText: { marginTop: 3, fontSize: Typography.caption },
  rulesCard: { padding: Spacing.sm, marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  rulesTitle: { fontSize: Typography.caption, fontWeight: "800" },
  rulesText: { marginTop: 4, fontSize: 11, lineHeight: 16 },
  restartButton: { minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  restartText: { fontSize: Typography.button, fontWeight: "800" },
});
