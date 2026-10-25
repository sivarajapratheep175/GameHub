import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import {
  BOARD_SIZE,
  createState,
  getBestPerformance,
  isBetterPerformance,
  reduce,
  type Action,
  type BestPerformance,
  type Candy,
  type Difficulty,
  type Position,
  type State,
} from "@/games/candy-match/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const BEST_RECORDS_KEY = "@gamehub/candy-match/best/v1";
type BestRecords = Partial<Record<string, BestPerformance>>;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const CANDY_STYLE: Record<Candy, { symbol: string; color: string }> = {
  berry: { symbol: "🍓", color: "#F36B86" },
  lemon: { symbol: "🍋", color: "#F4C94B" },
  grape: { symbol: "🍇", color: "#9A78F5" },
  apple: { symbol: "🍏", color: "#61CF8B" },
  orange: { symbol: "🍊", color: "#FF9D5C" },
  blueberry: { symbol: "🫐", color: "#68A7F7" },
};

export function CandyMatchScreen() {
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
  const [storageError, setStorageError] = useState("");
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const savedRecordKeys = useRef(new Set<string>());
  stateRef.current = state;

  const size = BOARD_SIZE[state.difficulty];
  const gap = Spacing.xs;
  const boardWidth = Math.min(windowWidth - Spacing.md * 2, MaxContentWidth - Spacing.md * 2);
  const tileSize = Math.max(44, Math.min(72, Math.floor((boardWidth - Spacing.sm - gap * (size - 1)) / size)));
  const gridWidth = tileSize * size + gap * (size - 1) + Spacing.sm;
  const currentBest = getBestPerformance(state);
  const matchedPositions = new Set(state.matchesToClear);
  const progress = Math.min(1, state.score / state.target);
  const clock = formatTime(state.elapsedSeconds);

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
        setStorageError("Saved best scores could not be loaded. You can still play.");
        setRecordsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!recordsLoaded) return;
    dispatch({
      type: "set-best-performance",
      record: bestRecords[recordKey(state.difficulty, state.level)] ?? null,
    });
  }, [bestRecords, recordsLoaded, state.difficulty, state.level]);

  useEffect(() => {
    if (state.phase !== "running" && state.phase !== "resolving") return;
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "resolving") return;
    const timeout = setTimeout(
      () => dispatch({ type: "resolve" }),
      state.matchesToClear.length > 0 ? 220 : 150,
    );
    return () => clearTimeout(timeout);
  }, [state.phase, state.matchesToClear]);

  useEffect(() => {
    if (
      !recordsLoaded ||
      (state.phase !== "level-complete" && state.phase !== "won" && state.phase !== "lost") ||
      state.score <= 0
    ) {
      return;
    }
    const record = { score: state.score, elapsedSeconds: state.elapsedSeconds };
    const key = recordKey(state.difficulty, state.level);
    if (!isBetterPerformance(record, bestRecordsRef.current[key] ?? null)) return;
    const signature = `${key}:${record.score}:${record.elapsedSeconds}`;
    if (savedRecordKeys.current.has(signature)) return;
    savedRecordKeys.current.add(signature);

    const updated = { ...bestRecordsRef.current, [key]: record };
    bestRecordsRef.current = updated;
    setBestRecords(updated);
    AsyncStorage.setItem(BEST_RECORDS_KEY, JSON.stringify(updated)).catch(() => {
      if (mountedRef.current) setStorageError("Your best score could not be saved on this device.");
    });
  }, [
    recordsLoaded,
    state.difficulty,
    state.elapsedSeconds,
    state.level,
    state.phase,
    state.score,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      const current = stateRef.current;
      if (
        appState !== "active" &&
        (current.phase === "running" || current.phase === "resolving")
      ) {
        dispatch({ type: "pause" });
      }
    });
    return () => subscription.remove();
  }, []);

  function setDifficulty(difficulty: Difficulty) {
    dispatch({ type: "set-difficulty", difficulty });
    dispatch({
      type: "set-best-performance",
      record: bestRecords[recordKey(difficulty, 1)] ?? null,
    });
  }

  function restart() {
    dispatch({ type: "reset" });
    dispatch({
      type: "set-best-performance",
      record: bestRecords[recordKey(state.difficulty, 1)] ?? null,
    });
  }

  function retryLevel() {
    dispatch({ type: "retry-level" });
    dispatch({
      type: "set-best-performance",
      record: bestRecords[recordKey(state.difficulty, state.level)] ?? null,
    });
  }

  function nextLevel() {
    dispatch({ type: "next-level" });
    dispatch({
      type: "set-best-performance",
      record: bestRecords[recordKey(state.difficulty, state.level + 1)] ?? null,
    });
  }

  const status = state.phase === "ready"
    ? "Tap a candy, then an adjacent one"
    : state.phase === "running"
      ? state.notice || "Make matches to reach your goal"
      : state.phase === "resolving"
        ? state.notice || "Sweet combo!"
        : state.phase === "paused"
          ? "Game paused"
          : state.phase === "level-complete"
            ? `Level ${state.level} complete!`
            : state.phase === "won"
              ? "Puzzle complete!"
              : state.notice || "Out of moves";

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
            <Text style={[styles.title, { color: colors.text }]}>Candy Match</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Level {state.level} of {state.levelCount} · {clock}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={state.phase === "paused" ? "Resume game" : "Pause game"}
            accessibilityRole="button"
            accessibilityState={{ disabled: state.phase !== "running" && state.phase !== "resolving" }}
            disabled={state.phase !== "running" && state.phase !== "resolving" && state.phase !== "paused"}
            onPress={() => dispatch({ type: state.phase === "paused" ? "resume" : "pause" })}
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                opacity: state.phase === "running" || state.phase === "resolving" || state.phase === "paused" ? 1 : 0.5,
              },
            ]}
          >
            <Ionicons name={state.phase === "paused" ? "play" : "pause"} size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Stat label="SCORE" value={state.score.toLocaleString()} colors={colors} />
          <Stat label="GOAL" value={state.target.toLocaleString()} colors={colors} />
          <Stat label="MOVES" value={state.movesLeft.toString()} colors={colors} />
        </View>

        <View
          accessibilityLabel={`Level progress ${Math.round(progress * 100)} percent`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: state.target, now: state.score }}
          style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}
        >
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={styles.bestRow}>
          <Ionicons name="trophy-outline" size={17} color={palette.orange} />
          <Text style={[styles.bestText, { color: colors.textSecondary }]}>
            Best: {currentBest ? `${currentBest.score.toLocaleString()} pts · ${formatTime(currentBest.elapsedSeconds)}` : "Not set"}
          </Text>
          {!recordsLoaded ? <Text style={[styles.bestText, { color: colors.textSecondary }]}>Loading…</Text> : null}
        </View>

        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((difficulty) => {
            const selected = difficulty === state.difficulty;
            return (
              <Pressable
                key={difficulty}
                accessibilityLabel={`Choose ${difficulty} Candy Match board`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: state.phase !== "ready" }}
                disabled={state.phase !== "ready"}
                onPress={() => setDifficulty(difficulty)}
                style={[
                  styles.difficultyButton,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: state.phase === "ready" || selected ? 1 : 0.55,
                  },
                ]}
              >
                <Text style={[styles.difficultyName, { color: selected ? "#FFFFFF" : colors.text }]}>
                  {difficulty[0].toUpperCase() + difficulty.slice(1)}
                </Text>
                <Text style={[styles.difficultySize, { color: selected ? "#FFFFFFCC" : colors.textSecondary }]}>
                  {BOARD_SIZE[difficulty]} × {BOARD_SIZE[difficulty]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          style={styles.boardScroll}
          showsHorizontalScrollIndicator={size > 6}
          contentContainerStyle={[styles.boardViewport, { minWidth: boardWidth }]}
        >
          <View
            accessibilityLabel={`${size} by ${size} candy board`}
            style={[
              styles.board,
              {
                width: gridWidth,
                gap,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {state.board.flatMap((row, rowIndex) =>
              row.map((candy, columnIndex) => {
                const position: Position = [rowIndex, columnIndex];
                const selected = state.selected?.[0] === rowIndex && state.selected[1] === columnIndex;
                let offset = { x: 0, y: 0 };
                if (state.lastSwap && state.phase === "resolving") {
                  const [firstSwap, secondSwap] = state.lastSwap;
                  if (firstSwap[0] === rowIndex && firstSwap[1] === columnIndex) {
                    offset = {
                      x: (secondSwap[1] - firstSwap[1]) * (tileSize + gap),
                      y: (secondSwap[0] - firstSwap[0]) * (tileSize + gap),
                    };
                  } else if (secondSwap[0] === rowIndex && secondSwap[1] === columnIndex) {
                    offset = {
                      x: (firstSwap[1] - secondSwap[1]) * (tileSize + gap),
                      y: (firstSwap[0] - secondSwap[0]) * (tileSize + gap),
                    };
                  }
                }
                return (
                  <CandyTile
                    key={`${rowIndex}:${columnIndex}`}
                    candy={candy}
                    position={position}
                    selected={selected}
                    clearing={matchedPositions.has(rowIndex * size + columnIndex)}
                    disabled={
                      (state.phase !== "ready" && state.phase !== "running") ||
                      state.movesLeft <= 0 ||
                      !recordsLoaded
                    }
                    size={tileSize}
                    swapAnimationId={state.swapAnimationId}
                    swapOffset={offset}
                    onPress={() => dispatch({ type: "select", row: rowIndex, column: columnIndex })}
                    colors={colors}
                  />
                );
              }),
            )}
            {state.phase === "paused" ? <BoardOverlay title="Paused" icon="pause-circle-outline" /> : null}
            {state.phase === "level-complete" ? <BoardOverlay title="Level cleared!" icon="checkmark-circle-outline" /> : null}
            {state.phase === "won" ? <BoardOverlay title="You did it!" icon="trophy-outline" /> : null}
            {state.phase === "lost" ? <BoardOverlay title="Out of moves" icon="close-circle-outline" /> : null}
          </View>
        </ScrollView>

        <View style={styles.statusRow}>
          <Text accessibilityLiveRegion="polite" style={[styles.status, { color: state.lastCombo > 1 ? palette.orange : colors.textSecondary }]}>
            {state.phase === "resolving" && state.cascade > 1
              ? `Combo ×${state.cascade}!`
              : status}
          </Text>
          {state.lastCombo > 1 && state.phase !== "resolving"
            ? <Text style={styles.comboBadge}>×{state.lastCombo} COMBO</Text>
            : null}
        </View>

        {storageError ? <Text accessibilityRole="alert" style={styles.storageError}>{storageError}</Text> : null}

        <View style={styles.controls}>
          {state.phase === "paused" ? (
            <GameButton title="Resume" icon="play" onPress={() => dispatch({ type: "resume" })} />
          ) : null}
          {state.phase === "level-complete" ? (
            <GameButton title={`Next level · ${state.level + 1}`} icon="arrow-forward" onPress={nextLevel} />
          ) : null}
          {state.phase === "won" ? (
            <GameButton title="Play again" icon="refresh-outline" onPress={restart} />
          ) : null}
          {state.phase === "lost" ? (
            <GameButton title="Retry level" icon="refresh-outline" onPress={retryLevel} />
          ) : null}
        </View>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Tap a candy, then tap an adjacent candy to swap. Only swaps that make a match use a move.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CandyTile({
  candy,
  position,
  selected,
  clearing,
  disabled,
  size,
  swapAnimationId,
  swapOffset,
  onPress,
  colors,
}: {
  candy: Candy | null;
  position: Position;
  selected: boolean;
  clearing: boolean;
  disabled: boolean;
  size: number;
  swapAnimationId: number;
  swapOffset: { x: number; y: number };
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const previousCandy = useRef<Candy | null>(candy);
  const previousAnimationId = useRef(swapAnimationId);

  useEffect(() => {
    if (previousAnimationId.current !== swapAnimationId) {
      previousAnimationId.current = swapAnimationId;
      if (swapOffset.x !== 0 || swapOffset.y !== 0) {
        offset.setValue(swapOffset);
        Animated.spring(offset, {
          toValue: { x: 0, y: 0 },
          speed: 22,
          bounciness: 5,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [offset, swapAnimationId, swapOffset]);

  useEffect(() => {
    if (candy !== null && previousCandy.current !== null && candy !== previousCandy.current) {
      scale.setValue(0.72);
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 7, useNativeDriver: true }).start();
    } else if (candy === null && previousCandy.current !== null) {
      Animated.timing(scale, { toValue: 0.4, duration: 130, useNativeDriver: true }).start();
    } else if (candy !== null && previousCandy.current === null) {
      scale.setValue(0.55);
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 7, useNativeDriver: true }).start();
    }
    previousCandy.current = candy;
  }, [candy, scale]);

  const piece = candy ? CANDY_STYLE[candy] : null;
  return (
    <Animated.View style={{ transform: [...offset.getTranslateTransform(), { scale }] }}>
      <Pressable
        accessibilityLabel={candy
          ? `${candy} candy, row ${position[0] + 1}, column ${position[1] + 1}`
          : `Empty candy space, row ${position[0] + 1}, column ${position[1] + 1}`}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        disabled={disabled || !candy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          {
            width: size,
            height: size,
            backgroundColor: piece ? `${piece.color}28` : colors.surfaceElevated,
            borderColor: clearing ? palette.orange : selected ? colors.primary : `${piece?.color ?? colors.border}70`,
            opacity: pressed ? 0.75 : 1,
            borderWidth: selected || clearing ? 2 : 1,
            transform: [{ scale: selected ? 1.08 : 1 }],
          },
        ]}
      >
        {piece ? <Text style={[styles.candySymbol, { fontSize: Math.max(16, size * 0.57) }]}>{piece.symbol}</Text> : null}
        {selected ? <View pointerEvents="none" style={[styles.selectionDot, { backgroundColor: colors.primary }]} /> : null}
      </Pressable>
    </Animated.View>
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

function BoardOverlay({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Ionicons name={icon} size={48} color={palette.orange} />
      <Text style={styles.overlayTitle}>{title}</Text>
    </View>
  );
}

function GameButton({ title, icon, onPress }: { title: string; icon: "play" | "arrow-forward" | "refresh-outline"; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function recordKey(difficulty: Difficulty, level: number) {
  return `${difficulty}:${level}`;
}

function parseBestRecords(raw: string | null): BestRecords {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved Candy Match records have an invalid format.");
  }
  const records: BestRecords = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^(easy|medium|hard):[1-3]$/.test(key)) continue;
    if (
      typeof value !== "object" ||
      value === null ||
      !("score" in value) ||
      !("elapsedSeconds" in value) ||
      typeof value.score !== "number" ||
      !Number.isInteger(value.score) ||
      value.score < 0 ||
      typeof value.elapsedSeconds !== "number" ||
      !Number.isInteger(value.elapsedSeconds) ||
      value.elapsedSeconds < 0
    ) {
      throw new Error("Saved Candy Match records have an invalid format.");
    }
    records[key] = { score: value.score, elapsedSeconds: value.elapsedSeconds };
  }
  return records;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
    alignItems: "center",
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: { width: "100%", flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  statsRow: { width: "100%", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  stat: { flex: 1, minHeight: 60, justifyContent: "center", padding: Spacing.sm, borderRadius: Radius.md },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  statValue: { marginTop: 3, fontSize: Typography.heading, fontWeight: "900" },
  progressTrack: { width: "100%", height: 8, overflow: "hidden", marginTop: Spacing.sm, borderRadius: Radius.pill },
  progressFill: { height: "100%", backgroundColor: palette.mint, borderRadius: Radius.pill },
  bestRow: { width: "100%", minHeight: 34, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  bestText: { flex: 1, fontSize: Typography.caption, fontWeight: "600" },
  difficultyRow: { width: "100%", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  difficultyButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  difficultyName: { fontSize: Typography.caption, fontWeight: "800" },
  difficultySize: { marginTop: 1, fontSize: 10 },
  boardScroll: { width: "100%", flexGrow: 0 },
  boardViewport: { alignItems: "center", justifyContent: "center", marginTop: Spacing.md },
  board: {
    position: "relative",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  tile: { position: "relative", alignItems: "center", justifyContent: "center", overflow: "visible", borderRadius: Radius.md },
  candySymbol: { textAlign: "center" },
  selectionDot: { position: "absolute", right: 2, top: 2, width: 7, height: 7, borderRadius: Radius.pill },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#0B1020CC",
    borderRadius: Radius.md,
  },
  overlayTitle: { color: "#FFFFFF", fontSize: Typography.heading, fontWeight: "900" },
  statusRow: { minHeight: 42, justifyContent: "center", alignItems: "center", marginTop: Spacing.sm },
  status: { textAlign: "center", fontSize: Typography.body, fontWeight: "700", lineHeight: 21 },
  comboBadge: { marginTop: 2, color: palette.orange, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  storageError: { marginTop: Spacing.xs, color: palette.danger, fontSize: Typography.caption, textAlign: "center" },
  controls: { width: "100%", minHeight: 52, justifyContent: "center", marginTop: Spacing.xs },
  primaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: palette.primary,
    borderRadius: Radius.md,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  hint: { marginTop: Spacing.sm, textAlign: "center", fontSize: Typography.caption, lineHeight: 18 },
});
