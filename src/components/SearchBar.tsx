import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useState } from "react";

import { Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function SearchBar({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: focused || value ? colors.primary : colors.border }]}>
      <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} />
      <TextInput accessibilityLabel="Search games" placeholder="Search games..." placeholderTextColor={colors.textSecondary} value={value} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, { color: colors.text }]} />
      {value ? <Pressable accessibilityLabel="Clear game search" accessibilityRole="button" onPress={() => onChangeText("")} style={styles.clear}><MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  input: { flex: 1, marginLeft: Spacing.sm, fontSize: Typography.body },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
