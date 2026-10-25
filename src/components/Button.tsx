import { Pressable, PressableProps, StyleSheet, Text } from "react-native";

import { Radius, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

type ButtonProps = PressableProps & { label: string; variant?: "primary" | "secondary" | "ghost" };

export function Button({ label, variant = "primary", style, ...props }: ButtonProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: variant === "primary" ? colors.primary : variant === "secondary" ? colors.surfaceElevated : "transparent", borderColor: colors.border },
        pressed && styles.pressed,
        typeof style === "function" ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: variant === "primary" ? "#fff" : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1 },
  label: { fontSize: Typography.button, fontWeight: "700" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
