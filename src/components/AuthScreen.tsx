import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import { maybeCompleteAuthSession } from "expo-web-browser";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { auth, db } from "../../firebaseConfig";
import { useAppTheme } from "@/theme/ThemeProvider";

maybeCompleteAuthSession();

export function AuthScreen() {
  const { colors } = useAppTheme();
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    responseType: "id_token",
  });

  async function signInWithGoogle() {
    setErrorMessage("");
    setLoading(true);
    try {
      let userCredential;
      if (Platform.OS === "web") {
        userCredential = await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        if (!googleRequest) {
          setErrorMessage("Google sign-in is not configured for this build.");
          return;
        }

        const result = await promptGoogle();
        if (result.type !== "success" || !result.params.id_token) {
          if (result.type !== "dismiss" && result.type !== "cancel") {
            setErrorMessage("Google sign-in did not complete. Please try again.");
          }
          return;
        }

        const credential = GoogleAuthProvider.credential(result.params.id_token);
        userCredential = await signInWithCredential(auth, credential);
      }

      const profileName = userCredential.user.displayName?.trim() || userCredential.user.email?.split("@")[0] || "Gamer";
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username: profileName,
        email: userCredential.user.email,
        photoUrl: userCredential.user.photoURL,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
      setErrorMessage(code === "auth/popup-closed-by-user" ? "Google sign-in was cancelled." : "Google sign-in failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    setErrorMessage("");

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (isRegistering && cleanUsername.length < 2) {
      setErrorMessage("Choose a gamer username with at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      const credential = isRegistering
        ? await createUserWithEmailAndPassword(auth, cleanEmail, password)
        : await signInWithEmailAndPassword(auth, cleanEmail, password);

      if (isRegistering) {
        await setDoc(doc(db, "users", credential.user.uid), {
          username: cleanUsername,
          email: cleanEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
      const messages: Record<string, string> = {
        "auth/email-already-in-use": "That email is already registered. Try logging in.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/network-request-failed": "You appear to be offline. Check your connection and try again.",
        "auth/operation-not-allowed": "Email sign-in is not enabled in Firebase yet.",
        "auth/weak-password": "Choose a stronger password.",
      };
      setErrorMessage(messages[code] ?? "We could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={styles.logoText}>G</Text></View>
          <Text style={[styles.brand, { color: colors.text }]}>GameHub</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your pocket-sized arcade.</Text>
        </View>
        <View style={[styles.card, Shadows.floating, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{isRegistering ? "Create your player profile" : "Welcome back, gamer"}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isRegistering ? "Save scores, challenge friends, and play anywhere." : "Log in to continue your streak."}</Text>
          {isRegistering ? <TextInput accessibilityLabel="Gamer username" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Gamer username" placeholderTextColor={colors.textSecondary} value={username} onChangeText={setUsername} maxLength={24} autoCapitalize="words" /> : null}
          <TextInput accessibilityLabel="Email address" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Email address" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <TextInput accessibilityLabel="Password" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Password" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          <Button label={loading ? "Signing you in..." : isRegistering ? "Create account" : "Log in"} onPress={() => void submit()} disabled={loading} />
          <View style={styles.divider}><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /><Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /></View>
          <Button label="Continue with Google" variant="secondary" onPress={() => void signInWithGoogle()} disabled={loading || (!googleRequest && Platform.OS !== "web")} />
          {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
          <Pressable accessibilityRole="button" onPress={() => { setIsRegistering((current) => !current); setErrorMessage(""); }} style={styles.switchButton}><Text style={[styles.switchText, { color: colors.primary }]}>{isRegistering ? "Already have an account? Log in" : "New here? Create an account"}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1, justifyContent: "center", padding: Spacing.lg },
  hero: { alignItems: "center", marginBottom: Spacing.xl },
  logo: { width: 68, height: 68, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md, borderRadius: 22 },
  logoText: { color: "#fff", fontSize: 36, fontWeight: "900" },
  brand: { fontSize: Typography.display, fontWeight: "900", letterSpacing: -1 },
  tagline: { marginTop: Spacing.xs, fontSize: Typography.body },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", padding: Spacing.lg, borderRadius: Radius.lg },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.lg, fontSize: Typography.body, lineHeight: 22 },
  input: { height: 52, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.md, fontSize: Typography.body },
  error: { marginBottom: Spacing.md, color: "#FF6B7A", fontSize: Typography.caption, lineHeight: 18 },
  loader: { marginTop: Spacing.sm },
  switchButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: Spacing.sm },
  switchText: { fontSize: Typography.caption, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});
