import { StyleSheet, Text, View } from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function EmptyState({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.container}><Text style={styles.emoji}>{emoji}</Text><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: Spacing.xxl },
  emoji: { fontSize: 42, marginBottom: Spacing.md },
  title: { fontSize: Typography.heading, fontWeight: "800" },
  description: { maxWidth: 280, marginTop: Spacing.sm, fontSize: Typography.body, lineHeight: 22, textAlign: "center" },
});
