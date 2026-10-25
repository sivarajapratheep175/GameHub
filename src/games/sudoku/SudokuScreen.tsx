import { useEffect, useReducer, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, getScore, reduce, type Difficulty } from "@/games/sudoku/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function SudokuScreen() {
  const { colors } = useAppTheme();
  const [state, dispatch] = useReducer(reduce, "easy" as Difficulty, createState);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [noteMode, setNoteMode] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedValue = selected ? state.grid[selected.row][selected.col] : 0;
  const formatTime = `${Math.floor(state.elapsedSeconds / 60).toString().padStart(2, "0")}:${(state.elapsedSeconds % 60).toString().padStart(2, "0")}`;
  const status = state.finished ? "Puzzle complete!" : state.failed ? "Too many mistakes" : state.paused ? "Game paused" : `${state.mistakes}/${state.maxMistakes} mistakes`;

  function chooseNumber(value: number) {
    if (!selected) return;
    if (noteMode) dispatch({ type: "toggle-note", row: selected.row, col: selected.col, value });
    else dispatch({ type: "set", row: selected.row, col: selected.col, value });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Sudoku</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>9 × 9 logic puzzle</Text></View>
          <Pressable accessibilityLabel={state.paused ? "Resume Sudoku" : "Pause Sudoku"} accessibilityRole="button" onPress={() => dispatch({ type: "pause", paused: !state.paused })} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name={state.paused ? "play" : "pause"} size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.difficultyRow}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((difficulty) => <Pressable key={difficulty} accessibilityLabel={`Choose ${difficulty} difficulty`} accessibilityRole="button" onPress={() => { dispatch({ type: "reset", difficulty }); setSelected(null); }} style={[styles.difficulty, { backgroundColor: state.difficulty === difficulty ? colors.primary : colors.surface, borderColor: state.difficulty === difficulty ? colors.primary : colors.border }]}><Text style={[styles.difficultyText, { color: state.difficulty === difficulty ? "#FFFFFF" : colors.textSecondary }]}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</Text></Pressable>)}
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusMetric}><Ionicons name="time-outline" size={18} color={colors.primary} /><Text style={[styles.metricText, { color: colors.text }]}>{formatTime}</Text></View>
          <View style={styles.statusMetric}><Ionicons name="alert-circle-outline" size={18} color={state.mistakes ? palette.orange : colors.textSecondary} /><Text style={[styles.metricText, { color: colors.text }]}>{status}</Text></View>
          <Text style={[styles.scoreText, { color: colors.primary }]}>{getScore(state)}</Text>
        </View>

        <View style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {state.grid.map((row, rowIndex) => row.map((value, colIndex) => {
            const fixed = state.puzzle[rowIndex][colIndex] !== 0;
            const isSelected = selected?.row === rowIndex && selected.col === colIndex;
            const sameValue = Boolean(selectedValue && value === selectedValue);
            const peer = selected ? selected.row === rowIndex || selected.col === colIndex || (Math.floor(selected.row / 3) === Math.floor(rowIndex / 3) && Math.floor(selected.col / 3) === Math.floor(colIndex / 3)) : false;
            const notes = state.notes[rowIndex][colIndex];
            const cellLabel = `Sudoku cell row ${rowIndex + 1}, column ${colIndex + 1}${fixed ? ", fixed clue" : value ? `, ${value}` : ", empty"}`;
            return <Pressable key={`${rowIndex}-${colIndex}`} accessibilityLabel={cellLabel} accessibilityRole="button" disabled={state.paused || state.finished || state.failed} onPress={() => setSelected({ row: rowIndex, col: colIndex })} style={[styles.cell, { backgroundColor: isSelected ? `${colors.primary}55` : sameValue ? `${colors.primary}22` : peer ? colors.surfaceElevated : colors.surface }, rowIndex % 3 === 0 && styles.boxTop, colIndex % 3 === 0 && styles.boxLeft, rowIndex === 8 && styles.boxBottom, colIndex === 8 && styles.boxRight]}>
              {value ? <Text style={[styles.cellValue, { color: fixed ? colors.text : colors.primary }]}>{value}</Text> : <View style={styles.notes}>{notes.map((note) => <Text key={note} style={[styles.note, { color: colors.textSecondary }]}>{note}</Text>)}</View>}
            </Pressable>;
          }))}
          {state.paused ? <View style={styles.pauseOverlay}><Ionicons name="pause-circle-outline" size={44} color="#FFFFFF" /><Text style={styles.pauseText}>Paused</Text></View> : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable accessibilityLabel="Toggle pencil notes" accessibilityRole="button" onPress={() => setNoteMode((value) => !value)} style={[styles.action, { backgroundColor: noteMode ? `${colors.primary}33` : colors.surface, borderColor: noteMode ? colors.primary : colors.border }]}><Ionicons name="pencil-outline" size={18} color={noteMode ? colors.primary : colors.text} /><Text style={[styles.actionText, { color: colors.text }]}>Notes</Text></Pressable>
          <Pressable accessibilityLabel="Erase selected cell" accessibilityRole="button" disabled={!selected} onPress={() => selected && dispatch({ type: "erase", row: selected.row, col: selected.col })} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border, opacity: selected ? 1 : 0.5 }]}><Ionicons name="backspace-outline" size={18} color={colors.text} /><Text style={[styles.actionText, { color: colors.text }]}>Erase</Text></Pressable>
          <Pressable accessibilityLabel="Get hint for selected cell" accessibilityRole="button" disabled={!selected} onPress={() => selected && dispatch({ type: "hint", row: selected.row, col: selected.col })} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border, opacity: selected ? 1 : 0.5 }]}><Ionicons name="bulb-outline" size={18} color={palette.orange} /><Text style={[styles.actionText, { color: colors.text }]}>Hint</Text></Pressable>
        </View>

        <View style={styles.numberPad}>{Array.from({ length: 9 }, (_, index) => index + 1).map((number) => <Pressable key={number} accessibilityLabel={`Enter ${number}`} accessibilityRole="button" onPress={() => chooseNumber(number)} style={[styles.number, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.numberText, { color: colors.text }]}>{number}</Text></Pressable>)}</View>
        <Pressable accessibilityLabel="Restart Sudoku puzzle" accessibilityRole="button" onPress={() => { dispatch({ type: "reset" }); setSelected(null); }} style={[styles.restart, { backgroundColor: colors.primary }]}><Ionicons name="refresh-outline" size={18} color="#FFFFFF" /><Text style={styles.restartText}>Restart puzzle</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  difficultyRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  difficulty: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.pill },
  difficultyText: { fontSize: Typography.caption, fontWeight: "800" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.sm, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  statusMetric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricText: { fontSize: Typography.caption, fontWeight: "800" },
  scoreText: { marginLeft: "auto", fontSize: Typography.body, fontWeight: "900" },
  board: { position: "relative", width: "100%", aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.md, padding: 1, borderWidth: 1, borderRadius: Radius.md, overflow: "hidden" },
  cell: { width: "11.111%", height: "11.111%", alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: "#273451" },
  boxTop: { borderTopWidth: 2, borderTopColor: palette.primary },
  boxLeft: { borderLeftWidth: 2, borderLeftColor: palette.primary },
  boxBottom: { borderBottomWidth: 2, borderBottomColor: palette.primary },
  boxRight: { borderRightWidth: 2, borderRightColor: palette.primary },
  cellValue: { fontSize: 22, fontWeight: "800" },
  notes: { width: "100%", height: "100%", flexDirection: "row", flexWrap: "wrap", alignContent: "center", justifyContent: "center" },
  note: { width: "33%", fontSize: 9, textAlign: "center" },
  pauseOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020CC", zIndex: 4 },
  pauseText: { marginTop: Spacing.sm, color: "#FFFFFF", fontSize: Typography.heading, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  action: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, borderWidth: 1, borderRadius: Radius.md },
  actionText: { fontSize: Typography.caption, fontWeight: "800" },
  numberPad: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  number: { width: "10.5%", minWidth: 38, flexGrow: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  numberText: { fontSize: Typography.heading, fontWeight: "800" },
  restart: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, borderRadius: Radius.md },
  restartText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
});
