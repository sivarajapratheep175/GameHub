import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { TopBar } from "@/components/TopBar";
import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export default function LeaderboardScreen() {
  const { colors } = useAppTheme();
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><View style={styles.content}><TopBar title="Leaderboard" subtitle="See how you stack up" /><View style={[styles.tabs, { backgroundColor: colors.surface }]}><Text style={[styles.activeTab, { color: colors.primary }]}>Global</Text><Text style={[styles.tab, { color: colors.textSecondary }]}>Friends</Text><Text style={[styles.tab, { color: colors.textSecondary }]}>Local</Text></View><EmptyState emoji="🏆" title="Leaderboards arrive soon" description="Play a few games and your scores will appear here." /></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { padding: Spacing.lg }, tabs: { flexDirection: "row", justifyContent: "space-around", padding: Spacing.md, borderRadius: 16 }, activeTab: { fontWeight: "800" }, tab: { fontWeight: "600" } });
