import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";

import { AuthScreen } from "@/components/AuthScreen";
import { auth } from "../../firebaseConfig";
import { ThemeProvider as AppThemeProvider, useAppTheme } from "@/theme/ThemeProvider";

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn("Could not keep the splash screen visible during app startup.", error);
});

export default function RootLayout() {
  return <AppThemeProvider><AuthenticatedRouter /></AppThemeProvider>;
}

function AuthenticatedRouter() {
  const { mode, isHydrated: themeHydrated } = useAppTheme();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [hydrated, setHydrated] = useState(Boolean(auth.currentUser));

  useEffect(() => onAuthStateChanged(
    auth,
    (nextUser) => {
      setUser(nextUser);
      setHydrated(true);
    },
    (error) => {
      console.error("Firebase auth state could not be restored.", error);
      setUser(null);
      setHydrated(true);
    },
  ), []);

  useEffect(() => {
    if (!hydrated || !themeHydrated) return;
    void SplashScreen.hideAsync().catch((error: unknown) => {
      console.warn("Could not hide the splash screen after app startup.", error);
    });
  }, [hydrated, themeHydrated]);

  if (!hydrated) return null;
  if (!user) return <AuthScreen />;

  return (
    <RouterThemeProvider value={mode === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="play" />
        <Stack.Screen name="history" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="multiplayer" />
        <Stack.Screen name="chess" />
        <Stack.Screen name="games/[id]" />
        <Stack.Screen name="games/play/[id]" />
      </Stack>
    </RouterThemeProvider>
  );
}
