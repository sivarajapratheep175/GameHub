import { useEffect, useReducer, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createState, getScore, reduce, SUITS, type Card, type Location, type State, type Suit } from "@/games/solitaire/engine";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const SUIT_SYMBOL: Record<Suit, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export function SolitaireScreen() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [state, dispatch] = useReducer((current: State, action: Parameters<typeof reduce>[1]) => reduce(current, action), undefined, createState);
  const [selected, setSelected] = useState<Location | null>(null);
  const contentWidth = Math.min(windowWidth - Spacing.md * 2, MaxContentWidth);
  const cardWidth = Math.max(28, Math.floor((contentWidth - Spacing.md * 2 - Spacing.sm * 6) / 7));
  const cardHeight = Math.round(cardWidth * 1.38);
  const time = `${Math.floor(state.elapsedSeconds / 60).toString().padStart(2, "0")}:${(state.elapsedSeconds % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, []);

  function tryMove(to: { area: "tableau"; pile: number } | { area: "foundation"; pile: Suit }) {
    if (!selected) return;
    dispatch({ type: "move", from: selected, to });
    setSelected(null);
  }

  function selectTableau(pile: number, index: number) {
    const card = state.tableau[pile][index];
    if (!card?.faceUp) return;
    if (selected && selected.area === "tableau" && selected.pile !== pile) {
      tryMove({ area: "tableau", pile });
      return;
    }
    if (selected && selected.area !== "tableau") {
      tryMove({ area: "tableau", pile });
      return;
    }
    setSelected({ area: "tableau", pile, index });
  }

  function selectWaste() {
    if (!state.waste.length) return;
    setSelected({ area: "waste" });
  }

  function selectFoundation(suit: Suit) {
    if (selected) tryMove({ area: "foundation", pile: suit });
    else if (state.foundations[suit].length) setSelected({ area: "foundation", pile: suit });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: MaxContentWidth }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to game details" accessibilityRole="button" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Solitaire</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Klondike · Draw one</Text></View>
          <Pressable accessibilityLabel={state.paused ? "Resume game" : "Pause game"} accessibilityRole="button" onPress={() => dispatch({ type: "pause", paused: !state.paused })} style={[styles.iconButton, { backgroundColor: colors.surface }]}><Ionicons name={state.paused ? "play" : "pause"} size={20} color={colors.text} /></Pressable>
        </View>

        <View style={styles.statsRow}><Stat label="MOVES" value={state.moves.toString()} colors={colors} /><Stat label="TIME" value={time} colors={colors} /><Stat label="SCORE" value={getScore(state).toString()} colors={colors} /></View>

        <View style={styles.topRow}>
          <Pressable accessibilityLabel={state.stock.length ? "Draw card from stock" : "Recycle waste pile"} accessibilityRole="button" onPress={() => { dispatch({ type: "draw" }); setSelected(null); }} style={[styles.pile, { width: cardWidth, height: cardHeight, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {state.stock.length ? <View style={styles.cardBack}><Text style={styles.cardBackIcon}>✦</Text></View> : <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />}
          </Pressable>
          <Pressable accessibilityLabel="Select waste top card" accessibilityRole="button" onPress={selectWaste} style={[styles.pile, { width: cardWidth, height: cardHeight, backgroundColor: colors.surface, borderColor: selected?.area === "waste" ? colors.primary : colors.border }]}>
            {state.waste.length ? <CardFace card={state.waste[state.waste.length - 1]} /> : <Text style={[styles.emptyPile, { color: colors.textSecondary }]}>Waste</Text>}
          </Pressable>
          <View style={styles.spacer} />
          {SUITS.map((suit) => <Pressable key={suit} accessibilityLabel={`Select ${suit} foundation`} accessibilityRole="button" onPress={() => selectFoundation(suit)} style={[styles.pile, { width: cardWidth, height: cardHeight, backgroundColor: colors.surface, borderColor: selected?.area === "foundation" && selected.pile === suit ? colors.primary : colors.border }]}>{state.foundations[suit].length ? <CardFace card={state.foundations[suit][state.foundations[suit].length - 1]} /> : <Text style={[styles.emptyPile, { color: isRedSuit(suit) ? palette.danger : colors.textSecondary }]}>{SUIT_SYMBOL[suit]}</Text>}</Pressable>)}
        </View>

        <View style={styles.tableau}>
          {state.tableau.map((pile, pileIndex) => (
            <View key={pileIndex} style={[styles.column, { width: cardWidth, minHeight: cardHeight * 2 }]}>
              {pile.length ? pile.map((card, index) => <Pressable key={card.id} accessibilityLabel={card.faceUp ? `${rankName(card.rank)} of ${card.suit}` : "Face-down card"} accessibilityRole="button" onPress={(event) => { event.stopPropagation(); selectTableau(pileIndex, index); }} style={[styles.tableauCard, { width: cardWidth, height: card.faceUp ? cardHeight : Math.round(cardHeight * 0.52), marginTop: index === 0 ? 0 : -Math.round(cardHeight * (card.faceUp ? 0.68 : 0.48)), zIndex: index + 1, backgroundColor: card.faceUp ? "#F8FAFC" : colors.surfaceElevated, borderColor: selected?.area === "tableau" && selected.pile === pileIndex && (selected.index ?? -1) <= index ? colors.primary : colors.border }]}>{card.faceUp ? <CardFace card={card} compact /> : <View style={styles.cardBack}><Text style={styles.cardBackIcon}>✦</Text></View>}</Pressable>) : <View style={[styles.emptyColumn, { width: cardWidth, height: cardHeight, borderColor: colors.border }]}><Text style={[styles.emptyPile, { color: colors.textSecondary }]}>K</Text></View>}
              {!pile.length ? <Pressable accessibilityLabel={`Move selected card to empty column ${pileIndex + 1}`} accessibilityRole="button" onPress={() => tryMove({ area: "tableau", pile: pileIndex })} style={[styles.emptyColumnTarget, { width: cardWidth, height: cardHeight }]} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.controls}>
          <Pressable accessibilityLabel="Undo last Solitaire move" accessibilityRole="button" disabled={!state.undoStack.length} onPress={() => { dispatch({ type: "undo" }); setSelected(null); }} style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: state.undoStack.length ? 1 : 0.5 }]}><Ionicons name="arrow-undo" size={18} color={colors.text} /><Text style={[styles.controlText, { color: colors.text }]}>Undo</Text></Pressable>
          <Pressable accessibilityLabel="Restart Solitaire game" accessibilityRole="button" onPress={() => { dispatch({ type: "reset" }); setSelected(null); }} style={[styles.controlButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}><Ionicons name="refresh-outline" size={18} color="#FFFFFF" /><Text style={styles.primaryText}>Restart</Text></Pressable>
        </View>
        <Text style={[styles.variant, { color: colors.textSecondary }]}>Rule variant: draw one card at a time. When stock is empty, tap it to recycle the waste pile.</Text>
        {state.paused ? <View style={[styles.overlay, { backgroundColor: "#0B1020DD" }]}><Ionicons name="pause-circle-outline" size={48} color="#FFFFFF" /><Text style={styles.overlayText}>Paused</Text></View> : null}
        {state.won ? <View style={[styles.overlay, { backgroundColor: "#0B1020DD" }]}><Ionicons name="trophy-outline" size={48} color={palette.orange} /><Text style={styles.overlayText}>You won!</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  const red = isRedSuit(card.suit);
  return <View style={[styles.faceContent, compact && styles.compactFace]}><Text style={[styles.cardRank, { color: red ? "#D93C58" : "#1D2939" }]}>{rankName(card.rank)}</Text><Text style={[styles.cardSuit, { color: red ? "#D93C58" : "#1D2939" }]}>{SUIT_SYMBOL[card.suit]}</Text></View>;
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.stat, { backgroundColor: colors.surface }]}><Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color: colors.text }]}>{value}</Text></View>;
}

function rankName(rank: number) {
  return rank === 1 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
}

function isRedSuit(suit: Suit) {
  return suit === "hearts" || suit === "diamonds";
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", alignSelf: "center", padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  stat: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md },
  statLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  statValue: { marginTop: 2, fontSize: Typography.body, fontWeight: "900" },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, marginTop: Spacing.lg },
  pile: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  spacer: { flex: 1 },
  emptyPile: { fontSize: 11, fontWeight: "800" },
  cardBack: { flex: 1, width: "90%", height: "94%", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#8E78FF", borderRadius: 5, backgroundColor: "#4934A0" },
  cardBackIcon: { color: "#DCD5FF", fontSize: 17 },
  tableau: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.xs, marginTop: Spacing.lg },
  column: { alignItems: "center" },
  tableauCard: { alignItems: "center", overflow: "hidden", borderWidth: 1, borderRadius: 7 },
  faceContent: { width: "100%", flex: 1, alignItems: "center", justifyContent: "center" },
  compactFace: { flexDirection: "column" },
  cardRank: { fontSize: 17, fontWeight: "900" },
  cardSuit: { fontSize: 15 },
  emptyColumn: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 7 },
  emptyColumnTarget: { position: "absolute", top: 0, left: 0, zIndex: 4 },
  controls: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  controlButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  controlText: { fontSize: Typography.button, fontWeight: "800" },
  primaryText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  variant: { marginTop: Spacing.md, fontSize: Typography.caption, lineHeight: 18 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 5 },
  overlayText: { marginTop: Spacing.sm, color: "#FFFFFF", fontSize: Typography.title, fontWeight: "900" },
});
