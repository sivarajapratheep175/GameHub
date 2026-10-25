import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { GameCard } from "@/components/GameCard";
import { SearchBar } from "@/components/SearchBar";
import { TopBar } from "@/components/TopBar";
import { games, GameCategory, GameDefinition } from "@/games";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";
import { auth, db } from "../../firebaseConfig";
import { getFallbackDisplayName, getInitials } from "@/utils/profile";

function GameGridSkeleton({ colors }: { colors: { surface: string; border: string } }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.border }]} /><View style={[styles.skeletonSmallLine, { backgroundColor: colors.border }]} /></View>)}
    </View>
  );
}

function GamesHeader({ username, query, setQuery, category, setCategory, colors, onGamesSectionLayout }: { username: string; query: string; setQuery: (value: string) => void; category: "All" | GameCategory; setCategory: (value: "All" | GameCategory) => void; colors: ReturnType<typeof useAppTheme>["colors"]; onGamesSectionLayout: (offset: number) => void }) {
  return (
    <View>
      <TopBar title={`Good evening, ${username}`} subtitle="Ready for your next high score?" avatarLabel={getInitials(username)} onAvatarPress={() => router.push("/profile")} />
      <View style={styles.scoreChip}><MaterialCommunityIcons name="fire" size={15} color="#FFCB66" /><Text style={[styles.scoreChipText, { color: colors.textSecondary }]}>3 day streak · 2,450 pts</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Invite a friend to play online" onPress={() => router.push("/multiplayer")} style={({ pressed }) => [styles.invitePressed, pressed && styles.pressed]}>
        <LinearGradient colors={["#7654F8", "#8C69FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inviteCard}>
          <View style={styles.inviteIcon}><MaterialCommunityIcons name="account-multiple-plus" size={24} color="#fff" /></View>
          <View style={styles.inviteCopy}><Text style={styles.inviteTitle}>Play with friends</Text><Text style={styles.inviteSubtitle}>Create a room and share the invite code.</Text></View>
          <MaterialCommunityIcons name="arrow-top-right" size={25} color="#fff" />
        </LinearGradient>
      </Pressable>
      <View style={styles.quickLinks}>
        <QuickLink icon="folder-play-outline" title="Saved games" subtitle="Pick up where you left off" onPress={() => router.push("/history")} colors={colors} />
      </View>
      <SearchBar value={query} onChangeText={setQuery} />
      <CategoryChips selected={category} onSelect={setCategory} />
      <View onLayout={(event) => onGamesSectionLayout(event.nativeEvent.layout.y)} style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.text }]}>All games</Text><Text style={[styles.count, { color: colors.textSecondary }]}>{games.length} games</Text></View>
    </View>
  );
}

function QuickLink({ icon, title, subtitle, onPress, colors }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; subtitle: string; onPress: () => void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.quickIcon, { backgroundColor: `${colors.primary}18` }]}><MaterialCommunityIcons name={icon} size={21} color={colors.primary} /></View><View style={styles.quickCopy}><Text style={[styles.quickTitle, { color: colors.text }]}>{title}</Text><Text numberOfLines={2} style={[styles.quickSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text></View></Pressable>;
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | GameCategory>("All");
  const [favorites, setFavorites] = useState<string[]>(["chess"]);
  const [username, setUsername] = useState(() => getFallbackDisplayName(auth.currentUser));
  const [loading, setLoading] = useState(true);
  const [gamesSectionOffset, setGamesSectionOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"home" | "games">("home");
  const listRef = useRef<FlatList<GameDefinition>>(null);
  const gamesSectionOffsetRef = useRef(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    void getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      const profileName = snapshot.data()?.username;
      setUsername(typeof profileName === "string" && profileName.trim() ? profileName.trim() : getFallbackDisplayName(user));
    }).catch((error: unknown) => console.warn("Could not load gamer username.", error)).finally(() => setLoading(false));
  }, []);

  const visibleGames = useMemo(() => games.filter((game) => (category === "All" || game.category === category) && game.title.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  const header = <GamesHeader username={username} query={query} setQuery={setQuery} category={category} setCategory={setCategory} colors={colors} onGamesSectionLayout={(offset) => {
    const listOffset = offset + Spacing.md;
    gamesSectionOffsetRef.current = listOffset;
    setGamesSectionOffset(listOffset);
  }} />;

  function openHome() {
    setActiveTab("home");
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function openGames() {
    setActiveTab("games");
    listRef.current?.scrollToOffset({ offset: gamesSectionOffsetRef.current, animated: true });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <FlatList<GameDefinition>
        ref={listRef}
        data={loading ? [] : visibleGames}
        keyExtractor={(game) => game.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <GameGridSkeleton colors={colors} /> : <EmptyState emoji="⌕" title="No games found" description="Try a different search or category." />}
        onScroll={(event) => {
          const nextTab = gamesSectionOffset > 0 && event.nativeEvent.contentOffset.y >= gamesSectionOffset - 24 ? "games" : "home";
          setActiveTab((current) => current === nextTab ? current : nextTab);
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => <GameCard game={item} favorite={favorites.includes(item.id)} onToggleFavorite={() => setFavorites((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} onPress={() => item.id === "chess" ? router.push("/chess") : router.push({ pathname: "/games/[id]", params: { id: item.id } })} />}
      />
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BottomTab icon="home" label="Home" active={activeTab === "home"} colors={colors} onPress={openHome} />
        <BottomTab icon="view-grid-outline" label="Games" active={activeTab === "games"} colors={colors} onPress={openGames} />
        <BottomTab icon="account-multiple-outline" label="Friends" colors={colors} onPress={() => router.push("/multiplayer")} />
        <BottomTab icon="account-circle-outline" label="Profile" colors={colors} onPress={() => router.push("/profile")} />
      </View>
    </SafeAreaView>
  );
}

function BottomTab({ icon, label, active = false, colors, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; active?: boolean; colors: ReturnType<typeof useAppTheme>["colors"]; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tab}><MaterialCommunityIcons name={icon} size={22} color={active ? colors.primary : colors.textSecondary} /><Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.md, paddingBottom: 120 },
  scoreChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: Spacing.xs, marginBottom: Spacing.md, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: "#FFCB6618" },
  scoreChipText: { fontSize: Typography.caption, fontWeight: "700" },
  invitePressed: { marginBottom: Spacing.lg },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  inviteCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: Radius.lg },
  inviteIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 14, backgroundColor: "#FFFFFF22" },
  inviteCopy: { flex: 1 },
  inviteTitle: { color: "#fff", fontSize: Typography.heading, fontWeight: "800" },
  inviteSubtitle: { marginTop: 3, color: "#F1EDFF", fontSize: Typography.caption },
  quickLinks: { flexDirection: "row", marginBottom: Spacing.lg },
  quickLink: { flex: 1, minHeight: 76, flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  quickIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 12 },
  quickCopy: { flex: 1 },
  quickTitle: { fontSize: Typography.body, fontWeight: "600" },
  quickSubtitle: { marginTop: 3, fontSize: Typography.caption, lineHeight: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: Spacing.md },
  sectionTitle: { fontSize: 22, fontWeight: "800" },
  count: { fontSize: Typography.caption },
  column: { gap: Spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  skeletonCard: { flex: 1, minHeight: 224, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.lg },
  skeletonIcon: { height: 112, marginBottom: Spacing.md, borderRadius: Radius.md },
  skeletonLine: { width: "72%", height: 14, marginBottom: Spacing.sm, borderRadius: 7 },
  skeletonSmallLine: { width: "46%", height: 10, borderRadius: 5 },
  tabBar: { position: "absolute", right: 0, bottom: 0, left: 0, flexDirection: "row", justifyContent: "space-around", paddingTop: Spacing.sm, paddingBottom: Spacing.lg, borderTopWidth: 1 },
  tab: { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  tabLabel: { marginTop: 2, fontSize: 10, fontWeight: "700" },
});
