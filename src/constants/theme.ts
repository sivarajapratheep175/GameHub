import { Platform } from "react-native";

export const palette = {
  ink: "#F8FAFC",
  inkMuted: "#A8B1C1",
  canvas: "#0B1020",
  surface: "#151D31",
  surfaceElevated: "#1C2740",
  border: "#273451",
  lightInk: "#172033",
  lightMuted: "#64748B",
  lightCanvas: "#F5F7FB",
  lightSurface: "#FFFFFF",
  lightBorder: "#E3E8F1",
  primary: "#7C5CFC",
  primaryPressed: "#6444E5",
  mint: "#45D6B3",
  orange: "#FF9D5C",
  danger: "#FF6B7A",
  success: "#57D68D",
  white: "#FFFFFF",
} as const;

export const Colors = {
  dark: {
    text: palette.ink,
    textSecondary: palette.inkMuted,
    background: palette.canvas,
    surface: palette.surface,
    surfaceElevated: palette.surfaceElevated,
    border: palette.border,
    primary: palette.primary,
    tabBar: "#10172A",
    backgroundElement: palette.surface,
    backgroundSelected: palette.surfaceElevated,
  },
  light: {
    text: palette.lightInk,
    textSecondary: palette.lightMuted,
    background: palette.lightCanvas,
    surface: palette.lightSurface,
    surfaceElevated: "#FFFFFF",
    border: palette.lightBorder,
    primary: palette.primary,
    tabBar: palette.lightSurface,
    backgroundElement: palette.lightSurface,
    backgroundSelected: "#EEF1F7",
  },
} as const;

export type ThemeMode = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeMode];
export type ThemeColor = keyof ThemeColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  half: 2,
} as const;

export const Typography = {
  display: 32,
  title: 24,
  heading: 18,
  body: 15,
  caption: 12,
  button: 15,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const Shadows = {
  card: Platform.select({
    ios: { shadowColor: "#050816", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 5 },
    default: { elevation: 3 },
  }),
  floating: Platform.select({
    ios: { shadowColor: "#050816", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
    default: { elevation: 5 },
  }),
} as const;

export const Fonts = Platform.select({
  ios: { sans: "System", rounded: "ui-rounded", mono: "ui-monospace" },
  android: { sans: "sans-serif", rounded: "sans-serif", mono: "monospace" },
  default: { sans: "normal", rounded: "normal", mono: "monospace" },
  web: { sans: "system-ui", rounded: "system-ui", mono: "monospace" },
});

export const BottomTabInset = Platform.select({ ios: 88, android: 72 }) ?? 72;
export const MaxContentWidth = 560;
