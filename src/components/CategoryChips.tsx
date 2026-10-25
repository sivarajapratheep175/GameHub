import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { GameCategory } from "@/games";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export const categories: ("All" | GameCategory)[] = ["All", "Board", "Puzzle", "Arcade", "Card"];

export function CategoryChips({ selected, onSelect }: { selected: "All" | GameCategory; onSelect: (category: "All" | GameCategory) => void }) {
  const { colors } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {categories.map((category) => (
        <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: selected === category }} onPress={() => onSelect(category)} style={[styles.chip, { backgroundColor: selected === category ? colors.primary : "transparent", borderColor: selected === category ? colors.primary : colors.border }]}>
          <Text style={[styles.text, { color: selected === category ? "#fff" : colors.textSecondary }]}>{category}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm, paddingVertical: Spacing.lg },
  chip: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.pill },
  text: { fontSize: Typography.caption, fontWeight: "700" },
});
