import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function ScoreBadge({ score, accent }: { score: number; accent?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.badge, { backgroundColor: `${accent ?? colors.primary}18` }]}>
      <Text style={[styles.label, { color: accent ?? colors.primary }]}>BEST</Text>
      <Text style={[styles.score, { color: colors.text }]}>{score.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill },
  label: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  score: { fontSize: Typography.caption, fontWeight: "700" },
});
