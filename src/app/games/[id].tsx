import { router, useLocalSearchParams } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { games } from "@/games";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export default function GameDetailsScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = games.find((item) => item.id === id);

  if (!game) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.text }]}>Game not found</Text>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={styles.buttonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Go back to games" accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>All games</Text>
        </Pressable>
        <View style={[styles.hero, { backgroundColor: `${game.accent}22`, borderColor: game.accent }]}>
          <Text style={[styles.gameIcon, { color: game.accent }]}>{game.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{game.title}</Text>
          <Text style={[styles.category, { color: game.accent }]}>{game.category} · {game.difficulty}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About this game</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{game.description}</Text>
          <View style={[styles.score, { backgroundColor: `${game.accent}18` }]}>
            <Text style={[styles.scoreLabel, { color: game.accent }]}>BEST SCORE</Text>
            <Text style={[styles.scoreValue, { color: colors.text }]}>{game.score.toLocaleString()}</Text>
          </View>
          <Text style={[styles.notice, { color: colors.textSecondary }]}>This game is ready for its playable screen. Your game state engine is connected to the GameHub architecture.</Text>
          <Pressable accessibilityLabel={`Start ${game.title}`} accessibilityRole="button" onPress={() => router.push({ pathname: "/games/play/[id]", params: { id: game.id } })} style={[styles.button, { backgroundColor: game.accent }]}>
            <Ionicons name="play" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Play {game.title}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  backButton: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.md },
  backText: { fontSize: Typography.body, fontWeight: "700" },
  hero: { minHeight: 230, alignItems: "center", justifyContent: "center", marginTop: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg },
  gameIcon: { fontSize: 72, marginBottom: Spacing.md },
  title: { fontSize: Typography.title, fontWeight: "800", textAlign: "center" },
  category: { marginTop: Spacing.sm, fontSize: Typography.caption, fontWeight: "800" },
  card: { marginTop: Spacing.md, padding: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg },
  sectionTitle: { fontSize: Typography.heading, fontWeight: "800" },
  description: { marginTop: Spacing.sm, fontSize: Typography.body, lineHeight: 22 },
  score: { alignSelf: "flex-start", marginTop: Spacing.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  scoreLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  scoreValue: { marginTop: 2, fontSize: Typography.heading, fontWeight: "800" },
  notice: { marginTop: Spacing.lg, fontSize: Typography.caption, lineHeight: 18 },
  button: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg, borderRadius: Radius.md },
  buttonText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
});
