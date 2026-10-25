import { useReducer } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, legalTokens, PLAYER_COLORS, reduce, type Player, type State } from "@/games/ludo/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const COLOR_HEX = [palette.danger, palette.mint, palette.orange, "#65A8FF"];

export function LudoScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer((current: State, action: Parameters<typeof reduce>[1]) => reduce(current, action), undefined, createState);
  const available = legalTokens(state);
  const playerColor = COLOR_HEX[state.current];
  const status = state.winner !== null ? `${PLAYER_COLORS[state.winner]} wins!` : state.dice ? "Choose a highlighted token" : `${PLAYER_COLORS[state.current]}'s turn · Roll the dice`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Ludo</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Local four-player classic</Text></View>
          <Pressable accessibilityLabel="Restart Ludo game" accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="refresh-outline" size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.playerRow}>{PLAYER_COLORS.map((name, player) => <View key={name} style={[styles.player, { backgroundColor: state.current === player ? `${COLOR_HEX[player]}33` : colors.surface, borderColor: state.current === player ? COLOR_HEX[player] : colors.border }]}><View style={[styles.playerDot, { backgroundColor: COLOR_HEX[player] }]} /><Text style={[styles.playerText, { color: colors.text }]}>{name}</Text><Text style={[styles.playerCount, { color: colors.textSecondary }]}>{state.tokens[player as Player].filter((token) => token.progress === 57).length}/4</Text></View>)}</View>

        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.statusIcon, { backgroundColor: `${playerColor}22` }]}><Ionicons name="dice-outline" size={21} color={playerColor} /></View><View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.text }]}>{status}</Text><Text style={[styles.statusHint, { color: colors.textSecondary }]}>{state.extraTurn ? "Bonus turn earned." : "Six enters a token from base."}</Text></View><Text style={[styles.diceValue, { color: playerColor }]}>{state.dice ?? "—"}</Text></View>

        <LudoBoard state={state} colors={colors} />

        <View style={styles.tokenRow}>{[0, 1, 2, 3].map((token) => <Pressable key={token} accessibilityLabel={`Move ${PLAYER_COLORS[state.current]} token ${token + 1}`} accessibilityRole="button" disabled={!available.includes(token)} onPress={() => dispatch({ type: "move", token })} style={[styles.tokenButton, { backgroundColor: available.includes(token) ? `${playerColor}33` : colors.surface, borderColor: available.includes(token) ? playerColor : colors.border }]}><Text style={[styles.tokenLabel, { color: colors.text }]}>Token {token + 1}</Text><Text style={[styles.tokenProgress, { color: available.includes(token) ? playerColor : colors.textSecondary }]}>{state.tokens[state.current][token].progress === 0 ? "Base" : state.tokens[state.current][token].progress === 57 ? "Home" : state.tokens[state.current][token].progress}</Text></Pressable>)}</View>

        <Pressable accessibilityLabel="Roll Ludo dice" accessibilityRole="button" disabled={state.dice !== null || state.winner !== null} onPress={() => dispatch({ type: "roll" })} style={[styles.rollButton, { backgroundColor: playerColor, opacity: state.dice === null && state.winner === null ? 1 : 0.5 }]}><Ionicons name="dice-outline" size={21} color="#FFFFFF" /><Text style={styles.rollText}>{state.winner !== null ? "Match complete" : state.dice ? "Select a token" : "Roll dice"}</Text></Pressable>

        <View style={[styles.rulesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.rulesTitle, { color: colors.text }]}>Classic local rules</Text><Text style={[styles.rulesText, { color: colors.textSecondary }]}>Four players share one board. A six is required to leave base. Movement must land exactly on 57 to reach home. Start and star cells are safe; captures on other track cells return the opponent token to base. Rolling a six or making a capture gives one bonus turn. Three consecutive sixes forfeit the turn. First player to bring all four tokens home wins.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LudoBoard({ state, colors }: { state: State; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>{Array.from({ length: 225 }, (_, index) => { const x = index % 15; const y = Math.floor(index / 15); const token = findToken(state, x, y); const path = isPathCell(x, y); return <View key={index} style={[styles.boardCell, { backgroundColor: path ? colors.surfaceElevated : colors.background }, token && { backgroundColor: COLOR_HEX[token.player], borderColor: "#FFFFFF", borderWidth: 1 }]}>{token ? <Text style={styles.tokenMark}>{token.index + 1}</Text> : null}</View>; })}<View style={styles.centerHome}><Ionicons name="home" size={22} color={colors.textSecondary} /></View></View>;
}

function findToken(state: State, x: number, y: number) {
  for (const player of [0, 1, 2, 3] as Player[]) for (let index = 0; index < 4; index++) {
    const progress = state.tokens[player][index].progress;
    if (progress === 0 || progress === 57) continue;
    const cell = progressCell(player, progress);
    if (cell.x === x && cell.y === y) return { player, index };
  }
  return null;
}

function progressCell(player: Player, progress: number) {
  const track = [
    ...Array.from({ length: 14 }, (_, i) => ({ x: i, y: 6 })),
    ...Array.from({ length: 8 }, (_, i) => ({ x: 14, y: i + 6 })),
    ...Array.from({ length: 14 }, (_, i) => ({ x: 14 - i, y: 14 })),
    ...Array.from({ length: 8 }, (_, i) => ({ x: 0, y: 14 - i })),
  ];
  const offset = [0, 13, 26, 39][player];
  return track[(offset + progress - 1) % track.length];
}

function isPathCell(x: number, y: number) {
  return (y === 6 || y === 8 || y === 7 && x >= 1 && x <= 13 || y === 14 || y === 12 || x === 0 || x === 14);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  playerRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  player: { width: "48%", flexDirection: "row", alignItems: "center", gap: 5, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  playerDot: { width: 9, height: 9, borderRadius: 5 },
  playerText: { flex: 1, fontSize: Typography.caption, fontWeight: "800" },
  playerCount: { fontSize: Typography.caption, fontWeight: "800" },
  statusCard: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  statusIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 12 },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: Typography.body, fontWeight: "800" },
  statusHint: { marginTop: 3, fontSize: Typography.caption },
  diceValue: { fontSize: 24, fontWeight: "900" },
  board: { position: "relative", width: "100%", aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.md, padding: 4, borderWidth: 1, borderRadius: Radius.lg },
  boardCell: { width: "6.666%", height: "6.666%", alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: "#27345155" },
  tokenMark: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  centerHome: { position: "absolute", top: "40%", left: "40%", width: "20%", height: "20%", alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, borderRadius: Radius.lg },
  tokenRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  tokenButton: { width: "48%", minHeight: 48, justifyContent: "center", paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  tokenLabel: { fontSize: Typography.caption, fontWeight: "800" },
  tokenProgress: { marginTop: 2, fontSize: Typography.caption },
  rollButton: { minHeight: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, borderRadius: Radius.md },
  rollText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  rulesCard: { padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  rulesTitle: { fontSize: Typography.body, fontWeight: "800" },
  rulesText: { marginTop: 5, fontSize: Typography.caption, lineHeight: 18 },
});
