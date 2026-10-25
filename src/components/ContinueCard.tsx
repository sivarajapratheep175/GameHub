import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function ContinueCard({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityLabel="Continue playing Chess" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={[styles.card, Shadows.floating, { backgroundColor: colors.surface }]}>
        <View style={[styles.thumbnail, { backgroundColor: `${colors.primary}22` }]}><MaterialCommunityIcons name="chess-pawn" size={42} color={colors.primary} /></View>
        <View style={styles.copy}><Text style={[styles.eyebrow, { color: colors.primary }]}>CONTINUE PLAYING</Text><Text style={[styles.title, { color: colors.text }]}>Chess</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>Played 2h ago · Best 1,240 pts</Text></View>
        <LinearGradient colors={[colors.primary, "#9B7CFF"]} style={styles.play}><MaterialCommunityIcons name="play" size={23} color="#fff" /></LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }] },
  card: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: Spacing.lg, borderRadius: Radius.lg },
  thumbnail: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: Radius.md },
  copy: { flex: 1, marginLeft: Spacing.md },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 3, fontSize: Typography.heading, fontWeight: "800" },
  meta: { marginTop: 3, fontSize: Typography.caption },
  play: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 25 },
});
