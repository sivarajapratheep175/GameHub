import { Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function TopBar({ title, subtitle, avatarLabel = "G", onAvatarPress }: { title: string; subtitle?: string; avatarLabel?: string; onAvatarPress?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onAvatarPress} style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.avatarText}>{avatarLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.lg },
  copy: { flex: 1 },
  subtitle: { marginBottom: 4, fontSize: Typography.body },
  title: { fontSize: Typography.display, fontWeight: "800", letterSpacing: -0.8 },
  avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  avatarText: { color: "#fff", fontSize: Typography.heading, fontWeight: "800" },
});
