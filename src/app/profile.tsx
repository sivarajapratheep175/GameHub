import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { auth, db, storage } from "../../firebaseConfig";
import { palette, Radius, Spacing, Typography, MaxContentWidth } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";
import { getFallbackDisplayName, getInitials } from "@/utils/profile";

type Stats = { total: number; wins: number; losses: number; draws: number };
type RecentGame = { id: string; result: string; moves: number };
type ProfileTab = "Overview" | "Games" | "Achievements";

const tabs: { label: ProfileTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Overview", icon: "grid-outline" },
  { label: "Games", icon: "game-controller-outline" },
  { label: "Achievements", icon: "ribbon-outline" },
];

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const user = auth.currentUser;
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [stats, setStats] = useState<Stats>({ total: 0, wins: 0, losses: 0, draws: 0 });
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [tab, setTab] = useState<ProfileTab>("Overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        router.replace("/");
        return;
      }
      try {
        const [profileSnapshot, gamesSnapshot] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDocs(query(collection(db, "users", user.uid, "games"), orderBy("updatedAt", "desc"))),
        ]);
        const profile = profileSnapshot.data();
        const savedUsername = typeof profile?.username === "string" ? profile.username.trim() : "";
        setUsername(savedUsername);
        setBio(typeof profile?.bio === "string" ? profile.bio : "");
        setPhotoUrl(typeof profile?.photoUrl === "string" ? profile.photoUrl : "");
        setNamePromptVisible(!savedUsername);

        const games = gamesSnapshot.docs.map((game) => {
          const data = game.data();
          return {
            id: game.id,
            result: typeof data.result === "string" ? data.result : "In progress",
            moves: Array.isArray(data.moves) ? data.moves.length : 0,
          };
        });
        setRecentGames(games.slice(0, 3));
        setStats(games.reduce<Stats>((current, game) => {
          if (game.result === "In progress") return current;
          return {
            total: current.total + 1,
            wins: current.wins + (game.result === "1-0" ? 1 : 0),
            losses: current.losses + (game.result === "0-1" ? 1 : 0),
            draws: current.draws + (game.result === "1/2-1/2" ? 1 : 0),
          };
        }, { total: 0, wins: 0, losses: 0, draws: 0 }));
      } catch (error) {
        console.error("Could not load profile:", error);
        setErrorMessage("Could not load your profile.");
      } finally {
        setLoading(false);
      }
    }
    void loadProfile();
  }, [user]);

  async function saveProfile(closeAfterSave = true) {
    if (!user) return;
    const cleanUsername = username.trim();
    const cleanBio = bio.trim();
    if (!/^[\p{L}\p{N} _-]{3,16}$/u.test(cleanUsername)) {
      setErrorMessage("Gamer name must be 3-16 characters.");
      return;
    }
    if (cleanBio.length > 120) {
      setErrorMessage("Bio must be 120 characters or fewer.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      const duplicate = await getDocs(query(collection(db, "users"), where("username", "==", cleanUsername)));
      if (duplicate.docs.some((candidate) => candidate.id !== user.uid)) {
        setErrorMessage("That gamer name is already taken.");
        return;
      }
      await setDoc(doc(db, "users", user.uid), {
        username: cleanUsername,
        bio: cleanBio,
        email: user.email,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setUsername(cleanUsername);
      setBio(cleanBio);
      setNamePromptVisible(false);
      setSuccessMessage("Profile saved.");
      if (closeAfterSave) setEditVisible(false);
    } catch (error) {
      console.error("Could not save profile:", error);
      setErrorMessage("Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function pickProfilePicture() {
    if (!user || saving) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Allow photo access to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setSaving(true);
    setErrorMessage("");
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("Could not read selected image.");
      const blob = await response.blob();
      const extension = asset.fileName?.split(".").pop()?.toLowerCase() || "jpg";
      const imageRef = ref(storage, `users/${user.uid}/profile.${extension}`);
      await uploadBytes(imageRef, blob, { contentType: asset.mimeType || "image/jpeg", cacheControl: "public,max-age=3600" });
      const downloadUrl = await getDownloadURL(imageRef);
      await setDoc(doc(db, "users", user.uid), { photoUrl: downloadUrl, updatedAt: new Date().toISOString() }, { merge: true });
      setPhotoUrl(downloadUrl);
      setSuccessMessage("Profile picture updated.");
    } catch (error) {
      console.error("Could not upload profile picture:", error);
      setErrorMessage("Could not upload that photo. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function shareProfile() {
    const displayName = username || getFallbackDisplayName(user);
    const winRate = stats.total === 0 ? 0 : Math.round((stats.wins / stats.total) * 100);
    await Share.share({ message: `${displayName} on GameHub\n${stats.wins} wins · ${winRate}% win rate\nCome play with me!` });
  }

  async function handleSignOut() {
    await auth.signOut();
    router.replace("/");
  }

  if (!user) return null;
  const displayName = username || getFallbackDisplayName(user);
  const winRate = stats.total === 0 ? 0 : Math.round((stats.wins / stats.total) * 100);
  const initials = getInitials(displayName);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.profileHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.headerIcon} />
          <Text style={[styles.handle, { color: colors.text }]}>{displayName}</Text>
          <Pressable accessibilityLabel="Profile menu" accessibilityRole="button" onPress={() => setEditVisible(true)} style={styles.headerIcon}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.identityRow}>
          <Pressable accessibilityLabel="Edit profile picture" accessibilityRole="button" onPress={() => setEditVisible(true)} style={[styles.avatarRing, { borderColor: colors.primary }]}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{initials}</Text></View>}
          </Pressable>
          <View style={styles.metrics}>
            <Metric value={stats.total} label="Games" colors={colors} />
            <Metric value={stats.wins} label="Wins" colors={colors} />
            <Metric value={`${winRate}%`} label="Win rate" colors={colors} />
          </View>
        </View>
        <View style={styles.bio}>
          <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.bioText, { color: colors.textSecondary }]}>{bio || "No bio yet. Tell other players about yourself."}</Text>
        </View>
        <View style={styles.actionRow}>
          <ProfileButton label="Edit profile" icon="create-outline" onPress={() => setEditVisible(true)} colors={colors} />
          <ProfileButton label="Share profile" icon="share-social-outline" onPress={() => void shareProfile()} colors={colors} />
        </View>
        <View style={[styles.profileTabs, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          {tabs.map((item) => (
            <Pressable key={item.label} accessibilityRole="tab" accessibilityState={{ selected: tab === item.label }} accessibilityLabel={item.label} onPress={() => setTab(item.label)} style={[styles.tab, tab === item.label && { borderBottomColor: colors.primary }]}>
              <Ionicons name={item.icon} size={18} color={tab === item.label ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, { color: tab === item.label ? colors.primary : colors.textSecondary }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : (
          <>
            {tab === "Overview" ? <Overview stats={stats} recentGames={recentGames} colors={colors} /> : null}
            {tab === "Games" ? <GamesTab recentGames={recentGames} stats={stats} colors={colors} /> : null}
            {tab === "Achievements" ? <Achievements colors={colors} /> : null}
          </>
        )}
        {errorMessage && !editVisible && !namePromptVisible ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={[styles.success, { color: palette.success }]}>{successMessage}</Text> : null}
        <ProfileButton label="Game history" icon="time-outline" onPress={() => router.push("/history")} colors={colors} />
        <ProfileButton label="Sign out" icon="log-out-outline" onPress={() => void handleSignOut()} colors={colors} variant="secondary" />
      </ScrollView>
      <ProfileEditor visible={editVisible || namePromptVisible} required={namePromptVisible} username={username} bio={bio} saving={saving} error={errorMessage} colors={colors} onUsernameChange={setUsername} onBioChange={setBio} onPickPhoto={() => void pickProfilePicture()} onSave={() => void saveProfile()} onCancel={() => { if (!namePromptVisible) { setEditVisible(false); setErrorMessage(""); } }} photoUrl={photoUrl} />
    </SafeAreaView>
  );
}

function ProfileEditor({ visible, required, username, bio, saving, error, colors, onUsernameChange, onBioChange, onPickPhoto, onSave, onCancel, photoUrl }: { visible: boolean; required: boolean; username: string; bio: string; saving: boolean; error: string; colors: ReturnType<typeof useAppTheme>["colors"]; onUsernameChange: (value: string) => void; onBioChange: (value: string) => void; onPickPhoto: () => void; onSave: () => void; onCancel: () => void; photoUrl: string }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{required ? "Choose your gamer name" : "Edit your profile"}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{required ? "Pick a name your friends will recognize." : "Update your public profile details."}</Text>
          <Pressable accessibilityLabel="Choose profile picture" accessibilityRole="button" onPress={onPickPhoto} style={[styles.photoPicker, { borderColor: colors.border }]}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photoPreview} /> : <Ionicons name="camera-outline" size={24} color={colors.primary} />}
            <Text style={[styles.photoPickerText, { color: colors.text }]}>Change photo</Text>
          </Pressable>
          <TextInput accessibilityLabel="Gamer username" autoCapitalize="words" maxLength={16} placeholder="Gamer name (3-16 characters)" placeholderTextColor={colors.textSecondary} value={username} onChangeText={onUsernameChange} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} />
          <TextInput accessibilityLabel="Profile bio" maxLength={120} multiline placeholder="Bio (optional, 120 characters max)" placeholderTextColor={colors.textSecondary} value={bio} onChangeText={onBioChange} style={[styles.input, styles.bioInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} />
          <Text style={[styles.characterCount, { color: colors.textSecondary }]}>{bio.length}/120</Text>
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
          <View style={styles.sheetActions}>
            {!required ? <ProfileButton label="Cancel" icon="close-outline" onPress={onCancel} colors={colors} variant="secondary" /> : null}
            <ProfileButton label={saving ? "Saving..." : "Save"} icon="checkmark-outline" onPress={onSave} disabled={saving} colors={colors} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Overview({ stats, recentGames, colors }: { stats: Stats; recentGames: RecentGame[]; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <><View style={styles.breakdown}>{[["Wins", stats.wins], ["Losses", stats.losses], ["Draws", stats.draws]].map(([label, value]) => <StatTile key={String(label)} label={String(label)} value={Number(value)} colors={colors} />)}</View><SectionTitle title="Recent matches" colors={colors} />{recentGames.length === 0 ? <EmptyText text="No matches yet." colors={colors} /> : recentGames.map((game) => <Text key={game.id} style={[styles.recent, { color: colors.textSecondary }]}>{game.result} · {game.moves} moves</Text>)}</>;
}

function GamesTab({ recentGames, stats, colors }: { recentGames: RecentGame[]; stats: Stats; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <><SectionTitle title="Game statistics" colors={colors} /><View style={styles.breakdown}><StatTile label="Games played" value={stats.total} colors={colors} /><StatTile label="Best score" value={recentGames.length ? Math.max(...recentGames.map((game) => game.moves)) : 0} colors={colors} /></View><EmptyText text="Per-game best scores will appear here as you play." colors={colors} /></>;
}

function Achievements({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={styles.badges}>{[["First win", "trophy-outline", true], ["On a streak", "flame-outline", false], ["Chess master", "school-outline", false], ["Social player", "people-outline", false]].map(([label, icon, unlocked]) => <View key={String(label)} style={[styles.badge, { backgroundColor: unlocked ? `${colors.primary}22` : colors.surfaceElevated, borderColor: colors.border }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={unlocked ? colors.primary : colors.textSecondary} /><Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text><Text style={[styles.badgeState, { color: colors.textSecondary }]}>{unlocked ? "Unlocked" : "Locked"}</Text></View>)}</View>;
}

function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Text style={[styles.subtitle, { color: colors.text }]}>{title}</Text>;
}

function EmptyText({ text, colors }: { text: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Text style={[styles.muted, { color: colors.textSecondary }]}>{text}</Text>;
}

function Metric({ value, label, colors }: { value: number | string; label: string; colors: { text: string; textSecondary: string } }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></View>;
}

function StatTile({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={[styles.statTile, { backgroundColor: colors.surfaceElevated }]}><Text style={[styles.statTileValue, { color: colors.text }]}>{value}</Text><Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>{label}</Text></View>;
}

function ProfileButton({ label, icon, onPress, disabled = false, colors, variant = "primary" }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; colors: ReturnType<typeof useAppTheme>["colors"]; variant?: "primary" | "secondary" }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: variant === "primary" ? colors.primary : colors.surfaceElevated, borderColor: colors.border }, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}><Ionicons name={icon} size={17} color={variant === "primary" ? "#fff" : colors.text} /><Text style={[styles.buttonText, { color: variant === "primary" ? "#fff" : colors.text }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", paddingBottom: Spacing.xxl },
  profileHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  handle: { fontSize: Typography.body, fontWeight: "800" },
  identityRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  metrics: { flex: 1, flexDirection: "row", justifyContent: "space-around", marginLeft: Spacing.lg },
  metric: { alignItems: "center" },
  metricValue: { fontSize: Typography.heading, fontWeight: "800" },
  metricLabel: { marginTop: 3, fontSize: Typography.caption },
  bio: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  displayName: { fontSize: Typography.body, fontWeight: "800" },
  bioText: { marginTop: 5, fontSize: Typography.caption, lineHeight: 19 },
  avatarRing: { width: 104, height: 104, alignItems: "center", justifyContent: "center", borderWidth: 3, borderRadius: 52 },
  avatar: { width: 94, height: 94, borderRadius: 47 },
  avatarPlaceholder: { width: 94, height: 94, alignItems: "center", justifyContent: "center", borderRadius: 47 },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  profileTabs: { flexDirection: "row", justifyContent: "space-around", minHeight: 58, alignItems: "stretch", marginTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: Typography.caption, fontWeight: "800" },
  breakdown: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.lg },
  statTile: { flex: 1, alignItems: "center", padding: Spacing.md, borderRadius: Radius.sm },
  statTileValue: { fontSize: Typography.heading, fontWeight: "800" },
  statTileLabel: { marginTop: 4, fontSize: Typography.caption },
  loader: { marginVertical: Spacing.xl },
  input: { minHeight: 48, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.sm, fontSize: Typography.body },
  bioInput: { minHeight: 84, paddingTop: Spacing.sm, textAlignVertical: "top" },
  characterCount: { alignSelf: "flex-end", marginTop: 4, fontSize: Typography.caption },
  button: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.xs, paddingHorizontal: Spacing.sm, marginTop: Spacing.sm, borderWidth: 1, borderRadius: 12 },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontSize: Typography.caption, fontWeight: "800" },
  subtitle: { marginTop: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, fontSize: Typography.heading, fontWeight: "800" },
  recent: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, fontSize: Typography.body },
  muted: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, fontSize: Typography.body },
  error: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, fontSize: Typography.caption, textAlign: "center" },
  success: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, fontSize: Typography.caption, textAlign: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, padding: Spacing.lg },
  badge: { width: "48%", minHeight: 116, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md, gap: 4 },
  badgeText: { fontSize: Typography.caption, fontWeight: "800" },
  badgeState: { fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#05081699" },
  sheet: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, marginBottom: Spacing.md, borderRadius: 2, backgroundColor: palette.inkMuted },
  sheetTitle: { fontSize: Typography.heading, fontWeight: "800" },
  sheetSubtitle: { marginTop: 4, fontSize: Typography.body },
  photoPicker: { minHeight: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  photoPreview: { width: 36, height: 36, borderRadius: 18 },
  photoPickerText: { fontSize: Typography.body, fontWeight: "700" },
  sheetActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
});
