import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { Colors, ThemeColors, ThemeMode } from "@/constants/theme";

const STORAGE_KEY = "@gamehub/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isHydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === "light" ? "light" : "dark");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === "light" || savedMode === "dark") setModeState(savedMode);
      })
      .catch((error: unknown) => console.warn("Could not restore theme preference.", error))
      .finally(() => setIsHydrated(true));
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode).catch((error: unknown) =>
      console.warn("Could not persist theme preference.", error),
    );
  };

  const value = useMemo(
    () => ({ mode, colors: Colors[mode], setMode, toggleMode: () => setMode(mode === "dark" ? "light" : "dark"), isHydrated }),
    [isHydrated, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useAppTheme must be used inside ThemeProvider");
  return context;
}
