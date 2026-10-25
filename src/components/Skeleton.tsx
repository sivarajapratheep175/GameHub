import { StyleSheet, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

export function Skeleton({ width = "100%", height = 18 }: { width?: number | `${number}%`; height?: number }) {
  const { colors } = useAppTheme();
  return <View style={[styles.base, { width, height, backgroundColor: colors.surfaceElevated }]} />;
}

export function HomeSkeleton() {
  return <View style={styles.wrapper}><Skeleton width="45%" height={34} /><Skeleton height={52} /><View style={styles.grid}>{[1, 2, 3, 4].map((item) => <Skeleton key={item} height={190} width="47%" />)}</View></View>;
}

const styles = StyleSheet.create({
  base: { marginBottom: Spacing.md, borderRadius: Radius.md, opacity: 0.7 },
  wrapper: { gap: Spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: Spacing.md },
});
