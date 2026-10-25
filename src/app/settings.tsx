import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";

import { TopBar } from "@/components/TopBar";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

function SettingRow({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.rowCopy}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text></View>{children}</View>;
}

export default function SettingsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={styles.content}><TopBar title="Settings" subtitle="Make GameHub yours" /><Text style={[styles.group, { color: colors.textSecondary }]}>PREFERENCES</Text><View style={[styles.card, { backgroundColor: colors.surface }]}><SettingRow label="Dark theme" description={mode === "dark" ? "Easy on the eyes" : "Bright and clear"}><Switch accessibilityLabel="Toggle dark theme" value={mode === "dark"} onValueChange={toggleMode} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" /></SettingRow><SettingRow label="Sound effects" description="Feedback while you play"><Switch accessibilityLabel="Toggle sound effects" value trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" /></SettingRow><SettingRow label="Haptic feedback" description="Feel every move"><Switch accessibilityLabel="Toggle haptic feedback" value trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" /></SettingRow><Pressable accessibilityRole="button" style={styles.language}><View><Text style={[styles.label, { color: colors.text }]}>Language</Text><Text style={[styles.description, { color: colors.textSecondary }]}>English</Text></View><Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text></Pressable></View><Text style={[styles.group, { color: colors.textSecondary }]}>ACCOUNT</Text><View style={[styles.card, { backgroundColor: colors.surface }]}><SettingRow label="Email" description="Used only for account access"><Text style={[styles.description, { color: colors.textSecondary }]}>{auth.currentUser?.email ?? "Not available"}</Text></SettingRow></View><Text style={[styles.group, { color: colors.textSecondary }]}>ABOUT</Text><View style={[styles.card, { backgroundColor: colors.surface }]}><SettingRow label="GameHub" description="Version 1.0.0"><Text style={{ color: colors.textSecondary }}>🎮</Text></SettingRow><Pressable accessibilityRole="button" style={styles.language}><Text style={[styles.label, { color: colors.text }]}>Reset progress</Text><Text style={[styles.chevron, { color: "#FF6B7A" }]}>›</Text></Pressable></View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { width: "100%", maxWidth: 720, alignSelf: "center", padding: Spacing.lg, paddingBottom: 120 }, group: { marginTop: Spacing.md, marginBottom: Spacing.sm, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, card: { paddingHorizontal: Spacing.md, borderRadius: Radius.lg }, row: { flexDirection: "row", alignItems: "center", minHeight: 72, justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth }, rowCopy: { flex: 1, paddingRight: Spacing.md }, label: { fontSize: Typography.body, fontWeight: "700" }, description: { marginTop: 3, fontSize: Typography.caption }, language: { flexDirection: "row", alignItems: "center", minHeight: 68, justifyContent: "space-between" }, chevron: { fontSize: 28 } });
