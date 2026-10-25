import { useReducer } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, reduce, type State } from "@/games/tictactoe/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function TicTacToeScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer(reduce, undefined, createState);
  const status = state.winner === "draw"
    ? "Draw game"
    : state.winner
      ? `${state.winner} wins!`
      : `${state.turn}'s turn`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Tic Tac Toe</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Local two-player · 3 × 3</Text>
          </View>
          <Pressable accessibilityLabel="Reset round" accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={[styles.iconButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="refresh-outline" size={21} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.scoreRow}>
          <Score mark="X" value={state.scores.X} active={state.turn === "X" && !state.winner} colors={colors} />
          <Score mark="O" value={state.scores.O} active={state.turn === "O" && !state.winner} colors={colors} />
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIcon, { backgroundColor: state.winner ? `${palette.success}22` : `${colors.primary}22` }]}>
            <Ionicons name={state.winner === "draw" ? "swap-horizontal-outline" : state.winner ? "trophy-outline" : "game-controller-outline"} size={20} color={state.winner ? palette.success : colors.primary} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>{status}</Text>
            <Text style={[styles.statusHint, { color: colors.textSecondary }]}>{state.winner ? "Start a new round when you are ready." : "Choose an empty cell to place your mark."}</Text>
          </View>
        </View>

        <View style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {state.board.map((cell, index) => {
            const winning = state.winningLine?.includes(index) ?? false;
            return (
              <Pressable
                key={index}
                accessibilityLabel={`Cell ${index + 1}${cell ? `, occupied by ${cell}` : ", empty"}`}
                accessibilityRole="button"
                disabled={Boolean(state.winner) || Boolean(cell)}
                onPress={() => dispatch({ type: "move", index })}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: winning ? `${palette.success}28` : colors.surfaceElevated, borderColor: winning ? palette.success : colors.border },
                  pressed && !cell && styles.pressed,
                ]}
              >
                <Text style={[styles.mark, { color: cell === "X" ? colors.primary : palette.mint, opacity: winning ? 1 : 0.9 }]}>{cell}</Text>
                {winning ? <View style={[styles.winDot, { backgroundColor: palette.success }]} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.roundCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.roundLabel, { color: colors.textSecondary }]}>MATCH SCORE</Text>
          <Text style={[styles.roundScore, { color: colors.text }]}>{state.scores.X} - {state.scores.O}</Text>
          <Text style={[styles.roundHint, { color: colors.textSecondary }]}>Scores stay across rounds. Reset round keeps the match score.</Text>
        </View>
        <Pressable accessibilityLabel={state.winner ? "Play another round" : "Reset current round"} accessibilityRole="button" onPress={() => dispatch({ type: "reset" })} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Ionicons name={state.winner ? "play" : "refresh-outline"} size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>{state.winner ? "Play another round" : "Reset round"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Score({ mark, value, active, colors }: { mark: "X" | "O"; value: number; active: boolean; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return (
    <View style={[styles.score, { backgroundColor: active ? `${colors.primary}22` : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={[styles.scoreMark, { color: mark === "X" ? colors.primary : palette.mint }]}>{mark}</Text>
      <View><Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{mark === "X" ? "Player X" : "Player O"}</Text><Text style={[styles.scoreValue, { color: colors.text }]}>{value}</Text></View>
    </View>
  );
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
  score: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  scoreMark: { fontSize: 27, fontWeight: "900" },
  scoreLabel: { fontSize: Typography.caption, fontWeight: "700" },
  scoreValue: { marginTop: 2, fontSize: Typography.heading, fontWeight: "900" },
  statusCard: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  statusIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 12 },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: Typography.body, fontWeight: "800" },
  statusHint: { marginTop: 3, fontSize: Typography.caption },
  board: { width: "100%", maxWidth: 420, aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, alignSelf: "center", marginTop: Spacing.lg, padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.lg },
  cell: { width: "31.5%", flexGrow: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  mark: { fontSize: 60, fontWeight: "900" },
  winDot: { position: "absolute", right: 10, top: 10, width: 8, height: 8, borderRadius: 4 },
  roundCard: { padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  roundLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  roundScore: { marginTop: 3, fontSize: Typography.title, fontWeight: "900" },
  roundHint: { marginTop: 3, fontSize: Typography.caption },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, borderRadius: Radius.md },
  primaryText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
});
