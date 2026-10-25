import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chess, type Square } from "chess.js";
import { Ionicons } from "@expo/vector-icons";

import { auth, db, functions } from "../../firebaseConfig";
import { palette, Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";
import { getFallbackDisplayName } from "@/utils/profile";

type Room = {
  whiteUid: string | null;
  blackUid: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  status: "waiting" | "active" | "completed";
  result: string | null;
  drawOfferUid?: string | null;
};

type GameOption = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const FILES = "abcdefgh";
const PIECES: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const GAME_OPTIONS: GameOption[] = [
  { id: "chess", label: "Chess", icon: "trophy-outline" },
  { id: "ludo", label: "Ludo", icon: "dice-outline" },
  { id: "tic-tac-toe", label: "Tic-Tac-Toe", icon: "grid-outline" },
  { id: "carrom", label: "Carrom", icon: "ellipse-outline" },
];

function pressHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}

function errorText(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.toLowerCase();
  if (message.includes("not found")) return "Room not found";
  if (message.includes("full")) return "Room is full";
  return error.message || fallback;
}

function ScreenHeader() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => {
          pressHaptic();
          router.back();
        }}
        style={({ pressed }) => [styles.backButton, { backgroundColor: colors.surface }, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: colors.text }]}>Play with friends</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Create a room or join with an invite code
        </Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={() => {
        pressHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.button, (disabled || loading) && styles.disabledButton, pressed && !disabled && styles.pressed]}
    >
      <LinearGradient colors={[colors.primary, "#6845E8"]} style={styles.buttonGradient}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={icon} size={18} color="#FFFFFF" />}
        <Text style={styles.buttonText}>{loading ? "Please wait..." : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function GameSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gameChips}>
      {GAME_OPTIONS.map((game) => {
        const selected = game.id === value;
        return (
          <Pressable
            key={game.id}
            accessibilityLabel={`Select ${game.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              pressHaptic();
              onChange(game.id);
            }}
            style={[
              styles.gameChip,
              { backgroundColor: selected ? colors.primary : colors.surfaceElevated, borderColor: selected ? colors.primary : colors.border },
            ]}
          >
            <Ionicons name={game.icon} size={16} color={selected ? "#FFFFFF" : colors.textSecondary} />
            <Text style={[styles.gameChipText, { color: selected ? "#FFFFFF" : colors.textSecondary }]}>{game.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function RoomCreateCard({
  selectedGame,
  onSelectGame,
  onCreate,
  roomCode,
  onCopy,
  onShare,
  loading,
}: {
  selectedGame: string;
  onSelectGame: (game: string) => void;
  onCreate: () => void;
  roomCode: string;
  onCopy: () => void;
  onShare: () => void;
  loading: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeading}>
        <View style={[styles.iconTile, { backgroundColor: `${colors.primary}22` }]}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Create a room</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Choose a game and invite a friend to play.</Text>
        </View>
      </View>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Choose a game</Text>
      <GameSelector value={selectedGame} onChange={onSelectGame} />
      {roomCode ? (
        <View style={[styles.codeResult, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Your room code</Text>
          <Text selectable style={[styles.roomCode, { color: colors.text }]}>{roomCode}</Text>
          <View style={styles.inlineActions}>
            <Pressable accessibilityLabel="Copy room code" accessibilityRole="button" onPress={onCopy} style={[styles.outlineButton, { borderColor: colors.border }]}>
              <Ionicons name="copy-outline" size={16} color={colors.text} />
              <Text style={[styles.outlineButtonText, { color: colors.text }]}>Copy</Text>
            </Pressable>
            <Pressable accessibilityLabel="Share room code" accessibilityRole="button" onPress={onShare} style={[styles.outlineButton, { borderColor: colors.border }]}>
              <Ionicons name="share-social-outline" size={16} color={colors.text} />
              <Text style={[styles.outlineButtonText, { color: colors.text }]}>Share</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <PrimaryButton label="Create room" icon="flash-outline" onPress={onCreate} loading={loading} />
      )}
    </View>
  );
}

function CodeInput({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const code = value.padEnd(6, " ");
  return (
    <View>
      <Pressable
        accessibilityLabel="Room code input"
        accessibilityRole="button"
        onPress={() => undefined}
        style={[styles.codeInput, { borderColor: focused ? colors.primary : colors.border, backgroundColor: colors.surfaceElevated }]}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={[styles.codeBox, { borderColor: focused && index === value.length ? colors.primary : colors.border }]}>
            <Text style={[styles.codeBoxText, { color: colors.text }]}>{code[index]}</Text>
          </View>
        ))}
        <TextInput
          accessibilityLabel="Enter six character room code"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => onChangeText(text.replace(/[^a-z0-9]/gi, "").toUpperCase())}
          onFocus={() => setFocused(true)}
          style={styles.hiddenInput}
          value={value}
        />
      </Pressable>
      {value ? (
        <Pressable accessibilityLabel="Clear room code" accessibilityRole="button" onPress={() => onChangeText("")} style={styles.clearCode}>
          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function RoomJoinCard({ code, onChangeCode, onJoin, loading, error }: { code: string; onChangeCode: (code: string) => void; onJoin: () => void; loading: boolean; error: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeading}>
        <View style={[styles.iconTile, { backgroundColor: `${palette.mint}22` }]}>
          <Ionicons name="enter-outline" size={24} color={palette.mint} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Join a room</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Enter the six-character code from your friend.</Text>
        </View>
      </View>
      <CodeInput value={code} onChangeText={onChangeCode} />
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={16} color={palette.danger} />
          <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}
      <PrimaryButton label="Join room" icon="log-in-outline" onPress={onJoin} loading={loading} disabled={code.length !== 6} />
    </View>
  );
}

function HowItWorks() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.howItWorks, { backgroundColor: colors.surface }]}>
      <View style={styles.howTitle}>
        <Ionicons name="bulb-outline" size={18} color={palette.orange} />
        <Text style={[styles.howTitleText, { color: colors.text }]}>How it works</Text>
      </View>
      <Text style={[styles.howText, { color: colors.textSecondary }]}>1. Pick a game  •  2. Share your code  •  3. Start playing</Text>
    </View>
  );
}

export default function MultiplayerScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [selectedGame, setSelectedGame] = useState("chess");
  const [errorMessage, setErrorMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState(() => getFallbackDisplayName(auth.currentUser));

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    void getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      const profileName = snapshot.data()?.username;
      setDisplayName(typeof profileName === "string" && profileName.trim() ? profileName.trim() : getFallbackDisplayName(user));
    }).catch(() => setDisplayName(getFallbackDisplayName(user)));
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    return onSnapshot(
      doc(db, "rooms", roomCode),
      (snapshot) => setRoom(snapshot.exists() ? (snapshot.data() as Room) : null),
      () => setErrorMessage("Room updates are unavailable."),
    );
  }, [roomCode]);

  async function createRoom() {
    setCreating(true);
    setErrorMessage("");
    try {
      const callable = httpsCallable<undefined, { roomId: string }>(functions, "createRoom");
      const result = await callable();
      setRoomCode(result.data.roomId.toUpperCase());
    } catch (error) {
      setErrorMessage(errorText(error, "Could not create room."));
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMessage("Enter a 6-character code");
      return;
    }
    setJoining(true);
    setErrorMessage("");
    try {
      const callable = httpsCallable<{ roomId: string }, { roomId: string }>(functions, "joinRoom");
      await callable({ roomId: code });
      setRoomCode(code);
    } catch (error) {
      setErrorMessage(errorText(error, "Could not join room."));
    } finally {
      setJoining(false);
    }
  }

  async function copyInvite() {
    await Clipboard.setStringAsync(roomCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }

  async function shareInvite() {
    if (!roomCode) return;
    await Share.share({ message: `${displayName} invited you to a GameHub ${selectedGame} match.\nEnter room code ${roomCode}.` });
  }

  async function submitMove(from: Square, to: Square) {
    try {
      const callable = httpsCallable<{ roomId: string; from: string; to: string; promotion: string }, { san: string; result: string | null }>(functions, "submitMove");
      await callable({ roomId: roomCode, from, to, promotion: "q" });
      setSelected(null);
    } catch (error) {
      setErrorMessage(errorText(error, "Move was rejected."));
      setSelected(null);
    }
  }

  async function resign() {
    try {
      const callable = httpsCallable<{ roomId: string }, { roomId: string }>(functions, "resignGame");
      await callable({ roomId: roomCode });
    } catch (error) {
      setErrorMessage(errorText(error, "Could not resign."));
    }
  }

  async function callDrawFunction(name: "offerDraw" | "acceptDraw") {
    try {
      const callable = httpsCallable<{ roomId: string }, { roomId: string }>(functions, name);
      await callable({ roomId: roomCode });
    } catch (error) {
      setErrorMessage(errorText(error, "Could not update draw."));
    }
  }

  function handleSquare(square: Square, game: Chess) {
    const user = auth.currentUser;
    if (!user || !room || room.status !== "active") return;
    const isPlayerTurn = (room.turn === "w" && room.whiteUid === user.uid) || (room.turn === "b" && room.blackUid === user.uid);
    if (!isPlayerTurn) return;
    const piece = game.get(square);
    if (!selected) {
      if (piece?.color === room.turn) setSelected(square);
      return;
    }
    if (piece?.color === room.turn) {
      setSelected(square);
      return;
    }
    void submitMove(selected, square);
  }

  if (!room) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]} keyboardShouldPersistTaps="handled">
          <ScreenHeader />
          <RoomCreateCard selectedGame={selectedGame} onSelectGame={setSelectedGame} onCreate={() => void createRoom()} roomCode="" onCopy={() => undefined} onShare={() => undefined} loading={creating} />
          <View style={styles.divider}><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /><Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /></View>
          <RoomJoinCard code={roomCode} onChangeCode={(code) => { setRoomCode(code); setErrorMessage(""); }} onJoin={() => void joinRoom()} loading={joining} error={errorMessage} />
          <HowItWorks />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const game = new Chess(room.fen);
  const user = auth.currentUser;
  const isPlayer = user?.uid === room.whiteUid || user?.uid === room.blackUid;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
      <View style={styles.liveHeader}><ScreenHeader /><Text style={[styles.liveCode, { color: colors.primary }]}>Room {roomCode}</Text></View>
      {room.status === "waiting" ? (
        <>
          <View style={[styles.codeResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Your room code</Text>
            <Text selectable style={[styles.roomCode, { color: colors.text }]}>{roomCode}</Text>
            <View style={styles.inlineActions}>
              <Pressable accessibilityLabel="Copy room code" accessibilityRole="button" onPress={() => void copyInvite()} style={[styles.outlineButton, { borderColor: colors.border }]}>
                <Ionicons name="copy-outline" size={16} color={colors.text} />
                <Text style={[styles.outlineButtonText, { color: colors.text }]}>Copy</Text>
              </Pressable>
              <Pressable accessibilityLabel="Share room code" accessibilityRole="button" onPress={() => void shareInvite()} style={[styles.outlineButton, { borderColor: colors.border }]}>
                <Ionicons name="share-social-outline" size={16} color={colors.text} />
                <Text style={[styles.outlineButtonText, { color: colors.text }]}>Share</Text>
              </Pressable>
            </View>
          </View>
          <PrimaryButton label="Invite a friend" icon="share-social-outline" onPress={() => void shareInvite()} />
        </>
      ) : null}
      <Text style={[styles.status, { color: colors.textSecondary }]}>{room.status === "waiting" ? "Waiting for another player..." : room.status === "completed" ? `Game over: ${room.result ?? "Draw"}` : `${room.turn === "w" ? "White" : "Black"} to move`}</Text>
      <View style={styles.board}>
        {game.board().map((row, rank) => row.map((piece, file) => {
          const square = `${FILES[file]}${8 - rank}` as Square;
          const key = piece ? `${piece.color}${piece.type}` : "";
          return <Pressable key={square} accessibilityLabel={`Chess square ${square}`} onPress={() => handleSquare(square, game)} style={[styles.square, { backgroundColor: (rank + file) % 2 ? "#D8B58C" : "#936B4B" }, selected === square && styles.selected]}>{piece ? <Text style={styles.piece}>{PIECES[key]}</Text> : null}</Pressable>;
        }))}
      </View>
      {isPlayer && room.status === "active" ? <View style={styles.liveActions}><Pressable accessibilityLabel="Resign game" onPress={() => void resign()} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={[styles.outlineButtonText, { color: colors.text }]}>Resign</Text></Pressable>{room.drawOfferUid && room.drawOfferUid !== user?.uid ? <Pressable accessibilityLabel="Accept draw" onPress={() => void callDrawFunction("acceptDraw")} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={[styles.outlineButtonText, { color: colors.text }]}>Accept draw</Text></Pressable> : <Pressable accessibilityLabel="Offer draw" onPress={() => void callDrawFunction("offerDraw")} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={[styles.outlineButtonText, { color: colors.text }]}>Offer draw</Text></Pressable>}</View> : null}
      <Pressable accessibilityLabel="Leave room" onPress={() => router.back()} style={styles.leaveButton}><Text style={[styles.outlineButtonText, { color: colors.textSecondary }]}>Leave room</Text></Pressable>
      {errorMessage ? <Text style={[styles.error, { color: palette.danger }]}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  backButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { fontSize: Typography.body, marginTop: 4, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadows.card },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  cardCopy: { flex: 1 },
  iconTile: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: Typography.heading, fontWeight: "800" },
  body: { fontSize: Typography.body, lineHeight: 20, marginTop: 4 },
  fieldLabel: { fontSize: Typography.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  gameChips: { gap: Spacing.sm },
  gameChip: { minHeight: 40, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  gameChipText: { fontSize: Typography.caption, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: Radius.md, overflow: "hidden" },
  buttonGradient: { flex: 1, minHeight: 52, paddingHorizontal: Spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm },
  buttonText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  codeResult: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center", gap: Spacing.sm },
  caption: { fontSize: Typography.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  roomCode: { fontFamily: "monospace", fontSize: 32, fontWeight: "800", letterSpacing: 8, marginLeft: 8 },
  inlineActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  outlineButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm },
  outlineButtonText: { fontSize: Typography.caption, fontWeight: "800" },
  divider: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: Typography.caption, fontWeight: "800", letterSpacing: 1 },
  codeInput: { minHeight: 68, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  codeBox: { flex: 1, height: 48, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  codeBoxText: { fontFamily: "monospace", fontSize: 20, fontWeight: "800" },
  hiddenInput: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0, color: "transparent" },
  clearCode: { position: "absolute", right: Spacing.sm, top: 24, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: -Spacing.sm },
  error: { fontSize: Typography.caption, fontWeight: "700", flex: 1 },
  howItWorks: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  howTitle: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  howTitleText: { fontSize: Typography.body, fontWeight: "800" },
  howText: { fontSize: Typography.caption, lineHeight: 18 },
  liveHeader: { paddingHorizontal: Spacing.md },
  liveCode: { fontSize: Typography.heading, fontWeight: "800", marginTop: -Spacing.sm, marginBottom: Spacing.md },
  status: { fontSize: Typography.body, textAlign: "center", marginVertical: Spacing.md },
  board: { alignSelf: "center", width: "100%", maxWidth: 420, aspectRatio: 1, flexDirection: "row", flexWrap: "wrap", marginHorizontal: Spacing.md, borderWidth: 2, borderColor: "#6B4F35" },
  square: { width: "12.5%", height: "12.5%", alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: "#EAB308" },
  piece: { color: "#171717", fontSize: 32 },
  liveActions: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm, marginTop: Spacing.lg },
  leaveButton: { alignSelf: "center", marginTop: Spacing.md, padding: Spacing.sm },
});
