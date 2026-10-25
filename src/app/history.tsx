import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { auth, db } from "../../firebaseConfig";
import { MaxContentWidth, palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

type SavedGame = {
  id: string;
  result: string;
  status: string;
  moves: string[];
  endedAt: Timestamp | null;
};

export default function GamesScreen() {
  const { colors } = useAppTheme();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadGames() {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/");
        return;
      }
      try {
        const snapshot = await getDocs(query(collection(db, "users", user.uid, "games"), orderBy("endedAt", "desc")));
        setGames(snapshot.docs.map((game) => {
          const data = game.data();
          return {
            id: game.id,
            result: typeof data.result === "string" ? data.result : "Unknown",
            status: typeof data.status === "string" ? data.status : "completed",
            moves: Array.isArray(data.moves) ? data.moves : [],
            endedAt: data.endedAt instanceof Timestamp ? data.endedAt : null,
          };
        }));
      } catch (error) {
        console.error("Could not load saved games:", error);
        setErrorMessage("Could not load saved games. Check your connection.");
      } finally {
        setLoading(false);
      }
    }
    void loadGames();
  }, []);

  if (loading) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><ActivityIndicator style={styles.loader} size="large" color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to home" accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Saved games</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Continue a match or review your history</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: `${colors.primary}22` }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{games.length}</Text>
          </View>
        </View>
        {errorMessage ? <View style={[styles.messageCard, { backgroundColor: `${colors.primary}18` }]}><Ionicons name="alert-circle-outline" size={20} color={colors.primary} /><Text style={[styles.messageText, { color: colors.text }]}>{errorMessage}</Text></View> : null}
        {!errorMessage && games.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}22` }]}><Ionicons name="bookmark-outline" size={30} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved games yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Your completed and in-progress matches will appear here.</Text>
            <Pressable accessibilityLabel="Play chess" accessibilityRole="button" onPress={() => router.push("/chess")} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Ionicons name="play" size={17} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start a game</Text>
            </Pressable>
          </View>
        ) : null}
        {games.map((game, index) => (
          <Pressable key={game.id} accessibilityLabel={`Open saved game ${games.length - index}`} accessibilityRole="button" onPress={() => router.push({ pathname: "/games/[id]", params: { id: game.id } })} style={({ pressed }) => [styles.gameCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.gameIcon, { backgroundColor: `${colors.primary}22` }]}><Ionicons name={game.status === "in_progress" ? "play-circle-outline" : "checkmark-circle-outline"} size={24} color={game.status === "in_progress" ? colors.primary : palette.success} /></View>
            <View style={styles.gameCopy}>
              <Text style={[styles.gameTitle, { color: colors.text }]}>Game {games.length - index}</Text>
              <Text style={[styles.gameDetails, { color: colors.textSecondary }]}>{game.status === "in_progress" ? "In progress" : `Result: ${game.result}`} · {game.moves.length} moves</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: Typography.caption },
  countBadge: { minWidth: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.pill },
  countText: { fontSize: Typography.body, fontWeight: "800" },
  messageCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  messageText: { flex: 1, fontSize: Typography.body },
  emptyCard: { alignItems: "center", padding: Spacing.xl, borderWidth: 1, borderRadius: Radius.lg },
  emptyIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  emptyTitle: { marginTop: Spacing.md, fontSize: Typography.heading, fontWeight: "800" },
  emptyText: { marginTop: Spacing.sm, fontSize: Typography.body, lineHeight: 21, textAlign: "center" },
  primaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.md },
  primaryButtonText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  gameCard: { minHeight: 76, alignItems: "center", flexDirection: "row", gap: Spacing.sm, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  gameIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  gameCopy: { flex: 1 },
  gameTitle: { fontSize: Typography.body, fontWeight: "800" },
  gameDetails: { marginTop: 4, fontSize: Typography.caption },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
