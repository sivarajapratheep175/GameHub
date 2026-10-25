import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, Animated } from "react-native";
import { useEffect, useRef } from "react";

import { GameDefinition } from "@/games";
import { Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const gameIcons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  chess: "chess-pawn",
  carrom: "circle-outline",
  tictactoe: "grid",
  sudoku: "numeric",
  snake: "snake",
  ludo: "dice-5",
  solitaire: "cards-playing",
  "brick-breaker": "view-grid",
  pong: "table-tennis",
  "memory-match": "brain",
  "candy-match": "candy",
};

type GameCardProps = {
  game: GameDefinition;
  favorite?: boolean;
  onPress?: () => void;
  onToggleFavorite?: () => void;
};

export function GameCard({ game, favorite = false, onPress, onToggleFavorite }: GameCardProps) {
  const { colors } = useAppTheme();
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!favorite) return;
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.25, useNativeDriver: true, speed: 26, bounciness: 8 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
    ]).start();
  }, [favorite, heartScale]);

  return (
    <View style={[styles.card, Shadows.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityLabel={`Play ${game.title}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.cardContent, pressed && styles.pressed]}
      >
        <View style={[styles.iconTile, { backgroundColor: `${game.accent}22` }]}>
          <MaterialCommunityIcons name={gameIcons[game.id] ?? "gamepad-variant"} size={48} color={game.accent} />
        </View>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{game.title}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: game.accent }]}>{game.category}</Text>
          <Text style={[styles.difficulty, { color: colors.textSecondary }]}>{game.difficulty}</Text>
        </View>
        <View style={[styles.score, { backgroundColor: `${game.accent}18` }]}>
          <Text style={[styles.scoreLabel, { color: game.accent }]}>BEST</Text>
          <Text style={[styles.scoreValue, { color: colors.text }]}>{game.score.toLocaleString()}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`${favorite ? "Remove" : "Add"} ${game.title} favorite`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onToggleFavorite}
        style={styles.favoriteButton}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <MaterialCommunityIcons name={favorite ? "heart" : "heart-outline"} size={22} color={favorite ? "#FF6B7A" : colors.textSecondary} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 224, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.lg },
  cardContent: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  iconTile: { height: 112, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md, borderRadius: Radius.md },
  favoriteButton: { position: "absolute", top: 4, right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: Typography.body, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.xs, gap: Spacing.xs },
  category: { fontSize: Typography.caption, fontWeight: "700" },
  difficulty: { fontSize: Typography.caption },
  score: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill },
  scoreLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  scoreValue: { fontSize: Typography.caption, fontWeight: "700" },
});
