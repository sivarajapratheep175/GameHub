import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import {
  createState,
  GRID_SIZE,
  isBetterPerformance,
  reduce,
  type Action,
  type Difficulty,
  type PerformanceRecord,
  type State,
} from "@/games/memory-match/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const BEST_RECORDS_KEY = "@gamehub/memory-match/best/v1";
type BestRecords = Partial<Record<Difficulty, PerformanceRecord>>;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export function MemoryMatchScreen() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [state, dispatch] = useReducer(
    (current: State, action: Action) => reduce(current, action),
    undefined,
    createState,
  );
  const [bestRecords, setBestRecords] = useState<BestRecords>({});
  const bestRecordsRef = useRef<BestRecords>({});
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const savedRecordRef = useRef<string | null>(null);

  const boardWidth = Math.min(windowWidth - Spacing.md * 2, MaxContentWidth - Spacing.md * 2);
  const cardGap = Spacing.xs;
  const cardWidth = Math.min(
    72,
    Math.floor((boardWidth - cardGap * (state.columns - 1)) / state.columns),
  );
  const cardHeight = Math.max(44, Math.round(cardWidth * 1.08));
  const time = formatTime(state.elapsedSeconds);
  const bestRecord = state.bestMoves === null || state.bestTimeSeconds === null
    ? null
    : { moves: state.bestMoves, elapsedSeconds: state.bestTimeSeconds };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(BEST_RECORDS_KEY)
      .then((raw) => {
        const records = parseBestRecords(raw);
        if (!active) return;
        bestRecordsRef.current = records;
        setBestRecords(records);
        setRecordsLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setStorageError("Saved records could not be loaded. You can still play.");
        setRecordsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!recordsLoaded) return;
    dispatch({ type: "set-best-performance", record: bestRecords[state.difficulty] ?? null });
  }, [recordsLoaded, bestRecords, state.difficulty]);

  useEffect(() => {
    if (state.phase !== "playing") return;
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.second === null || state.phase !== "playing") return;
    const timeout = setTimeout(() => dispatch({ type: "resolve" }), 900);
    return () => clearTimeout(timeout);
  }, [state.second, state.phase]);

  useEffect(() => {
    if (
      !recordsLoaded ||
      state.phase !== "finished" ||
      !state.newRecord ||
      state.bestMoves === null ||
      state.bestTimeSeconds === null
    ) {
      return;
    }

    const record = { moves: state.bestMoves, elapsedSeconds: state.bestTimeSeconds };
    if (!isBetterPerformance(record, bestRecordsRef.current[state.difficulty] ?? null)) return;
    const signature = `${state.difficulty}:${record.moves}:${record.elapsedSeconds}`;
    if (savedRecordRef.current === signature) return;
    savedRecordRef.current = signature;

    const updatedRecords = { ...bestRecordsRef.current, [state.difficulty]: record };
    bestRecordsRef.current = updatedRecords;
    setBestRecords(updatedRecords);
    AsyncStorage.setItem(BEST_RECORDS_KEY, JSON.stringify(updatedRecords)).catch(() => {
      if (mountedRef.current) {
        setStorageError("Your new best could not be saved on this device.");
      }
    });
  }, [recordsLoaded, state.difficulty, state.bestMoves, state.bestTimeSeconds, state.newRecord, state.phase]);

  function restart() {
    dispatch({ type: "reset" });
  }

  const interactionLocked = !recordsLoaded || state.phase === "paused" ||
    state.phase === "finished" || state.second !== null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { maxWidth: MaxContentWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to game details"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Memory Match</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {state.phase === "finished" ? "All pairs matched!" : `${state.difficulty} · ${GRID_SIZE[state.difficulty].label}`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={state.phase === "paused" ? "Resume game" : "Pause game"}
            accessibilityRole="button"
            disabled={state.phase !== "playing" && state.phase !== "paused"}
            onPress={() => dispatch({ type: state.phase === "paused" ? "resume" : "pause" })}
            style={[
              styles.iconButton,
              { backgroundColor: colors.surface, opacity: state.phase === "playing" || state.phase === "paused" ? 1 : 0.5 },
            ]}
          >
            <Ionicons name={state.phase === "paused" ? "play" : "pause"} size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Stat label="MOVES" value={state.moves.toString()} colors={colors} />
          <Stat label="TIME" value={time} colors={colors} />
          <Stat label="MATCHES" value={`${state.matchedPairs}/${state.cards.length / 2}`} colors={colors} />
        </View>

        <View style={styles.bestRow}>
          <Ionicons name="trophy-outline" size={17} color={palette.orange} />
          <Text style={[styles.bestText, { color: colors.textSecondary }]}>
            Best: {bestRecord ? `${bestRecord.moves} moves · ${formatTime(bestRecord.elapsedSeconds)}` : "Not set"}
          </Text>
          {!recordsLoaded ? <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text> : null}
        </View>

        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((difficulty) => {
            const selected = difficulty === state.difficulty;
            const disabled = state.phase !== "ready" || !recordsLoaded;
            return (
              <Pressable
                key={difficulty}
                accessibilityLabel={`Choose ${difficulty} Memory Match grid, ${GRID_SIZE[difficulty].label}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => dispatch({ type: "set-difficulty", difficulty })}
                style={[
                  styles.difficultyButton,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: disabled && !selected ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.difficultyName, { color: selected ? "#FFFFFF" : colors.text }]}>
                  {difficulty[0].toUpperCase() + difficulty.slice(1)}
                </Text>
                <Text style={[styles.difficultySize, { color: selected ? "#FFFFFFCC" : colors.textSecondary }]}>
                  {GRID_SIZE[difficulty].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          accessibilityLabel={`${state.rows} row by ${state.columns} column card grid`}
          style={[
            styles.board,
            {
              width: cardWidth * state.columns + cardGap * (state.columns - 1),
              gap: cardGap,
            },
          ]}
        >
          {state.cards.map((card, index) => {
            const revealed = card.flipped || card.matched;
            const disabled = interactionLocked || card.matched || card.flipped;
            return (
              <Pressable
                key={card.id}
                accessibilityLabel={
                  card.matched
                    ? `Card ${index + 1}, matched ${card.pair}`
                    : revealed
                      ? `Card ${index + 1}, ${card.pair}`
                      : `Card ${index + 1}, face down`
                }
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: revealed }}
                disabled={disabled}
                onPress={() => dispatch({ type: "flip", index })}
                style={({ pressed }) => [
                  styles.card,
                  {
                    width: cardWidth,
                    height: cardHeight,
                    backgroundColor: card.matched
                      ? `${palette.mint}28`
                      : revealed
                        ? colors.surface
                        : colors.surfaceElevated,
                    borderColor: card.matched ? palette.mint : revealed ? colors.primary : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text style={[styles.cardFace, { color: card.matched ? palette.mint : colors.text }]}>
                  {revealed ? card.pair : "?"}
                </Text>
              </Pressable>
            );
          })}
          {state.phase === "paused" ? <BoardOverlay label="Paused" icon="pause-circle-outline" /> : null}
          {state.phase === "finished" ? (
            <BoardOverlay
              label={state.newRecord ? "New best!" : "You matched every pair!"}
              icon="checkmark-circle-outline"
            />
          ) : null}
        </View>

        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {state.phase === "finished"
            ? `Completed in ${state.moves} moves and ${time}.`
            : state.second !== null
              ? "No match — remember these cards…"
              : state.phase === "paused"
                ? "Resume when you’re ready."
                : state.phase === "ready"
                  ? "Find every matching pair."
                  : "Choose two cards to make a match."}
        </Text>

        {storageError ? (
          <Text accessibilityRole="alert" style={styles.storageError}>{storageError}</Text>
        ) : null}

        <Pressable
          accessibilityLabel={state.phase === "finished" ? "Play Memory Match again" : "Restart Memory Match"}
          accessibilityRole="button"
          onPress={restart}
          style={({ pressed }) => [
            styles.restartButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name={state.phase === "finished" ? "play" : "refresh-outline"} size={18} color="#FFFFFF" />
          <Text style={styles.restartText}>{state.phase === "finished" ? "Play again" : "Restart game"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function BoardOverlay({ label, icon }: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Ionicons name={icon} size={46} color="#FFFFFF" />
      <Text style={styles.overlayText}>{label}</Text>
    </View>
  );
}

function parseBestRecords(raw: string | null): BestRecords {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved Memory Match records have an invalid format.");
  }

  const stored = parsed as Record<string, unknown>;
  const records: BestRecords = {};
  for (const difficulty of DIFFICULTIES) {
    const value = stored[difficulty];
    if (value === undefined) continue;
    if (
      typeof value !== "object" ||
      value === null ||
      !("moves" in value) ||
      !("elapsedSeconds" in value) ||
      typeof value.moves !== "number" ||
      !Number.isInteger(value.moves) ||
      value.moves < 1 ||
      typeof value.elapsedSeconds !== "number" ||
      !Number.isInteger(value.elapsedSeconds) ||
      value.elapsedSeconds < 0
    ) {
      throw new Error("Saved Memory Match records have an invalid format.");
    }
    records[difficulty] = { moves: value.moves, elapsedSeconds: value.elapsedSeconds };
  }
  return records;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },
  header: { width: "100%", flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption, textTransform: "capitalize" },
  statsRow: { width: "100%", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  stat: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, minHeight: 58 },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  statValue: { marginTop: 3, fontSize: Typography.heading, fontWeight: "900" },
  bestRow: { width: "100%", minHeight: 36, flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  bestText: { flex: 1, fontSize: Typography.caption, fontWeight: "600" },
  loadingText: { fontSize: Typography.caption },
  difficultyRow: { width: "100%", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  difficultyButton: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  difficultyName: { fontSize: Typography.caption, fontWeight: "800" },
  difficultySize: { marginTop: 2, fontSize: 10 },
  board: {
    position: "relative",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: Spacing.lg,
  },
  card: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  cardFace: { fontSize: 25, fontWeight: "800" },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#0B1020CC",
    borderRadius: Radius.md,
  },
  overlayText: { color: "#FFFFFF", fontSize: Typography.heading, fontWeight: "900" },
  status: { minHeight: 42, marginTop: Spacing.md, textAlign: "center", fontSize: Typography.body, lineHeight: 21 },
  storageError: { marginTop: Spacing.xs, color: palette.danger, fontSize: Typography.caption, textAlign: "center" },
  restartButton: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
  },
  restartText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
});
