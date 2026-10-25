
import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Chess, type Square } from "chess.js";
import { auth, db } from "../../firebaseConfig";
import { MaxContentWidth, palette, Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useAppTheme } from "@/theme/ThemeProvider";

const PIECES: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const FILES = "abcdefgh";

export default function ChessScreen() {
  const { colors } = useAppTheme();
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [message, setMessage] = useState("White to move");
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [saving, setSaving] = useState(false);
  const savedGameId = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const startedAt = useRef(serverTimestamp());

  async function saveGame(chess: Chess) {
    const user = auth.currentUser;

    if (!user || saving) {
      return;
    }

    setSaving(true);

    try {
      const result = chess.isCheckmate()
        ? chess.turn() === "w"
          ? "0-1"
          : "1-0"
        : "1/2-1/2";

      const isComplete = chess.isGameOver();

      await setDoc(
        doc(db, "users", user.uid, "games", savedGameId.current),
        {
          mode: "local",
          playerColor: "w",
          initialFen: new Chess().fen(),
          currentFen: chess.fen(),
          moves: chess.history(),
          pgn: chess.pgn(),
          status: isComplete ? "completed" : "in_progress",
          result: isComplete ? result : null,
          startedAt: startedAt.current,
          updatedAt: serverTimestamp(),
          endedAt: isComplete ? serverTimestamp() : null,
        },
        { merge: true },
      );

      setMessage(
        isComplete
          ? `Game over. Saved as ${result}.`
          : "Game saved. You can continue it later.",
      );
    } catch (error) {
      console.error("Could not save completed game:", error);
      setMessage("Game over, but saving failed. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function updateMessage(chess: Chess) {
    if (chess.isCheckmate()) {
      setMessage(
        `Checkmate! ${chess.turn() === "w" ? "Black" : "White"} wins.`
      );
    } else if (chess.isStalemate()) {
      setMessage("Draw by stalemate.");
    } else if (chess.isInsufficientMaterial()) {
      setMessage("Draw by insufficient material.");
    } else if (chess.isThreefoldRepetition()) {
      setMessage("Draw can be claimed by threefold repetition.");
    } else if (chess.isDrawByFiftyMoves()) {
      setMessage("Draw can be claimed by the 50-move rule.");
    } else if (chess.isDraw()) {
      setMessage("Game drawn.");
    } else if (chess.isCheck()) {
      setMessage(
        `${chess.turn() === "w" ? "White" : "Black"} is in check!`
      );
    } else {
      setMessage(
        `${chess.turn() === "w" ? "White" : "Black"} to move`
      );
    }
  }

  function handleSquare(square: Square) {
    if (game.isGameOver() || promotion) return;

    const piece = game.get(square);

    if (!selected) {
      if (piece && piece.color === game.turn()) {
        setSelected(square);
      }
      return;
    }

    if (selected === square) {
      setSelected(null);
      return;
    }

    // Allow choosing another piece of the current player.
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      return;
    }

    const candidate = game.moves({ square: selected, verbose: true }).find((move) => move.to === square);
    if (!candidate) {
      setMessage("Illegal move. Select a legal destination.");
      setSelected(null);
      return;
    }

    if (candidate.isPromotion()) {
      setPromotion({ from: selected, to: square });
      return;
    }

    applyMove(selected, square, "q");
  }

  function applyMove(from: Square, to: Square, promotionPiece: "q" | "r" | "b" | "n") {
    try {
      const next = new Chess(game.fen());
      next.move({ from, to, promotion: promotionPiece });
      setGame(next);
      setSelected(null);
      setPromotion(null);
      updateMessage(next);

      if (next.isGameOver()) void saveGame(next);
    } catch {
      setMessage("Illegal move. Select a legal destination.");
      setSelected(null);
      setPromotion(null);
    }
  }

  function restartGame() {
    const freshGame = new Chess();
    setGame(freshGame);
    setSelected(null);
    setPromotion(null);
    setMessage("White to move");
    savedGameId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    startedAt.current = serverTimestamp();
  }

  const legalTargets = selected
    ? game.moves({ square: selected, verbose: true })
        .map((move) => move.to)
    : [];

  const board = game.board();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to home" accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Chess</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Local game · Think ahead</Text>
          </View>
          <View style={[styles.turnBadge, { backgroundColor: `${colors.primary}22` }]}>
            <View style={[styles.turnDot, { backgroundColor: game.turn() === "w" ? "#FFFFFF" : colors.text }]} />
            <Text style={[styles.turnBadgeText, { color: colors.primary }]}>{game.turn() === "w" ? "White" : "Black"}</Text>
          </View>
        </View>
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusIcon, { backgroundColor: `${colors.primary}22` }]}>
            <Ionicons name={game.isCheck() ? "warning-outline" : "game-controller-outline"} size={20} color={game.isCheck() ? palette.orange : colors.primary} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.status, { color: colors.text }]}>{message}</Text>
            <Text style={[styles.statusHint, { color: colors.textSecondary }]}>Tap a piece, then choose a highlighted square</Text>
          </View>
        </View>

      <View style={[styles.boardFrame, Shadows.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.board}>
        {board.map((row, rank) =>
          row.map((piece, file) => {
            const square =
              `${FILES[file]}${8 - rank}` as Square;

            const isLight = (rank + file) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.includes(square);

            const key = piece
              ? `${piece.color}${piece.type}`
              : "";

            return (
              <Pressable
                key={square}
                onPress={() => handleSquare(square)}
                style={[
                  styles.square,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isLight
                      ? "#DCC29B"
                      : "#9A704E",
                  },
                ]}
              >
                {piece ? (
                  <Text
                    style={[
                      styles.piece,
                      {
                        color:
                          piece.color === "w" ? "#FFFFFF" : "#172033",
                      },
                    ]}
                  >
                    {PIECES[key]}
                  </Text>
                ) : isTarget ? (
                  <View style={[styles.target, { backgroundColor: colors.primary }]} />
                ) : null}

                {isTarget && piece ? (
                  <View style={[styles.captureRing, { borderColor: colors.primary }]} />
                ) : null}

                {file === 0 ? (
                  <Text style={[styles.coordinate, { color: isLight ? "#9A704E" : "#F4E2BF" }]}>
                    {8 - rank}
                  </Text>
                ) : null}

                {rank === 7 ? (
                  <Text style={[styles.fileCoordinate, { color: isLight ? "#9A704E" : "#F4E2BF" }]}>
                    {FILES[file]}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>TURN</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{game.turn() === "w" ? "White" : "Black"}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>MOVES</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{game.history().length}</Text>
        </View>
      </View>
      <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Move history</Text>
          <Text style={[styles.historyCount, { color: colors.textSecondary }]}>{game.history().length} plies</Text>
        </View>
        <Text style={[styles.historyText, { color: colors.textSecondary }]}>
          {game.history().length ? game.history().map((move, index) => `${Math.floor(index / 2) + 1}${index % 2 === 0 ? "." : "..."} ${move}`).join("  ") : "Moves will appear here"}
        </Text>
      </View>
      {(game.isThreefoldRepetition() || game.isDrawByFiftyMoves()) && !game.isCheckmate() ? (
        <Pressable
          accessibilityLabel="Claim a chess draw"
          accessibilityRole="button"
          style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={() => {
            setMessage(game.isThreefoldRepetition() ? "Draw claimed by threefold repetition." : "Draw claimed by the 50-move rule.");
            void saveGame(game);
          }}
        >
          <Ionicons name="hand-left-outline" size={18} color={colors.primary} />
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Claim draw</Text>
        </Pressable>
      ) : null}
      {saving ? <Text style={[styles.saving, { color: colors.primary }]}>Saving game...</Text> : null}

      <Pressable
        accessibilityLabel="Save chess game"
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
        onPress={() => void saveGame(game)}
        disabled={saving}
      >
        <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Save game</Text>
      </Pressable>
      <Modal visible={promotion !== null} transparent animationType="fade" onRequestClose={() => setPromotion(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.promotionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.promotionTitle, { color: colors.text }]}>Choose promotion</Text>
            <Text style={[styles.promotionHint, { color: colors.textSecondary }]}>Select the piece for your pawn.</Text>
            <View style={styles.promotionOptions}>
              {(["q", "r", "b", "n"] as const).map((piece) => (
                <Pressable
                  key={piece}
                  accessibilityLabel={`Promote pawn to ${piece === "q" ? "queen" : piece === "r" ? "rook" : piece === "b" ? "bishop" : "knight"}`}
                  accessibilityRole="button"
                  onPress={() => promotion && applyMove(promotion.from, promotion.to, piece)}
                  style={[styles.promotionButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <Text style={[styles.promotionPiece, { color: colors.text }]}>{PIECES[`${game.turn()}${piece}`]}</Text>
                  <Text style={[styles.promotionLabel, { color: colors.textSecondary }]}>{piece.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityLabel="Cancel pawn promotion" accessibilityRole="button" onPress={() => setPromotion(null)} style={[styles.secondaryButton, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Pressable accessibilityLabel="Restart chess game" accessibilityRole="button" style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={restartGame}>
        <Ionicons name="refresh-outline" size={18} color={colors.text} />
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Restart game</Text>
      </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  header: { width: "100%", flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: Typography.title, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: Typography.caption },
  turnBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: Radius.pill },
  turnDot: { width: 8, height: 8, borderRadius: 4 },
  turnBadgeText: { fontSize: Typography.caption, fontWeight: "800" },
  statusCard: { width: "100%", flexDirection: "row", alignItems: "center", padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  statusIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm, borderRadius: 12 },
  statusCopy: { flex: 1 },
  status: {
    fontSize: Typography.body,
    fontWeight: "800",
  },
  statusHint: { marginTop: 3, fontSize: Typography.caption },
  boardFrame: { width: "100%", padding: Spacing.sm, borderWidth: 1, borderRadius: Radius.lg },
  board: {
    width: "100%",
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 2,
    borderColor: "#6B4F35",
  },
  square: {
    width: "12.5%",
    height: "12.5%",
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    fontSize: 34,
    textAlign: "center",
  },
  target: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.primary,
    opacity: 0.7,
  },
  captureRing: {
    position: "absolute",
    width: "90%",
    height: "90%",
    borderRadius: 50,
    borderWidth: 3,
    borderColor: palette.primary,
  },
  coordinate: {
    position: "absolute",
    top: 1,
    left: 2,
    fontSize: 9,
  },
  fileCoordinate: {
    position: "absolute",
    bottom: 0,
    right: 2,
    fontSize: 9,
  },
  statsRow: { width: "100%", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  stat: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  statValue: { marginTop: 4, fontSize: Typography.body, fontWeight: "800" },
  historyCard: { width: "100%", padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTitle: { fontSize: Typography.body, fontWeight: "800" },
  historyCount: { fontSize: Typography.caption },
  historyText: { marginTop: Spacing.sm, fontSize: Typography.caption, lineHeight: 20 },
  saving: { marginTop: Spacing.sm, fontSize: Typography.caption, fontWeight: "700" },
  button: {
    width: "100%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
  },
  buttonText: { color: "#FFFFFF", fontSize: Typography.button, fontWeight: "800" },
  secondaryButton: { width: "100%", minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md },
  secondaryButtonText: { fontSize: Typography.button, fontWeight: "800" },
  disabledButton: {
    opacity: 0.6,
  },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg, backgroundColor: "#050816CC" },
  promotionCard: { width: "100%", maxWidth: 380, padding: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg },
  promotionTitle: { fontSize: Typography.heading, fontWeight: "800", textAlign: "center" },
  promotionHint: { marginTop: Spacing.sm, fontSize: Typography.body, textAlign: "center" },
  promotionOptions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  promotionButton: { flex: 1, minHeight: 84, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: Radius.md },
  promotionPiece: { fontSize: 34 },
  promotionLabel: { marginTop: 2, fontSize: 10, fontWeight: "800" },
});
