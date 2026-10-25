import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Chess } from "chess.js";

initializeApp();

const db = getFirestore();

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

function requireAuth(request: { auth?: { uid: string } | null }) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
}

function getRoomId(data: unknown) {
  if (
    typeof data !== "object" ||
    data === null ||
    !("roomId" in data) ||
    typeof data.roomId !== "string" ||
    !/^[A-Z0-9]{6}$/.test(data.roomId)
  ) {
    throw new HttpsError("invalid-argument", "A valid room code is required.");
  }
  return data.roomId;
}

function roomRef(roomId: string) {
  return db.collection("rooms").doc(roomId);
}

export const createRoom = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room: Room = {
    whiteUid: uid,
    blackUid: null,
    fen: new Chess().fen(),
    moves: [],
    turn: "w",
    status: "waiting",
    result: null,
  };

  await roomRef(roomId).set({
    ...room,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { roomId };
});

export const joinRoom = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = getRoomId(request.data);

  await db.runTransaction(async (transaction) => {
    const ref = roomRef(roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }

    const room = snapshot.data() as Room;
    if (room.status !== "waiting" || room.blackUid) {
      throw new HttpsError("already-exists", "Room is already full.");
    }
    if (room.whiteUid === uid) {
      throw new HttpsError("failed-precondition", "You created this room.");
    }

    transaction.update(ref, {
      blackUid: uid,
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { roomId };
});

export const submitMove = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = getRoomId(request.data);
  const data = request.data as { from?: unknown; to?: unknown; promotion?: unknown };

  if (
    typeof data.from !== "string" ||
    typeof data.to !== "string" ||
    (data.promotion !== undefined && typeof data.promotion !== "string")
  ) {
    throw new HttpsError("invalid-argument", "A valid chess move is required.");
  }
  const from = data.from as string;
  const to = data.to as string;

  return db.runTransaction(async (transaction) => {
    const ref = roomRef(roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");

    const room = snapshot.data() as Room;
    const isWhite = room.whiteUid === uid;
    const isBlack = room.blackUid === uid;
    if (!isWhite && !isBlack) {
      throw new HttpsError("permission-denied", "You are not a player in this room.");
    }
    if (room.status !== "active") {
      throw new HttpsError("failed-precondition", "This game is not active.");
    }
    if ((room.turn === "w" && !isWhite) || (room.turn === "b" && !isBlack)) {
      throw new HttpsError("failed-precondition", "It is not your turn.");
    }

    const chess = new Chess(room.fen);
    let move;
    try {
      move = chess.move({
        from,
        to,
        promotion: data.promotion as "q" | "r" | "b" | "n" | undefined,
      });
    } catch {
      throw new HttpsError("invalid-argument", "Illegal chess move.");
    }

    const completed = chess.isGameOver();
    const result = completed
      ? chess.isCheckmate()
        ? chess.turn() === "w"
          ? "0-1"
          : "1-0"
        : "1/2-1/2"
      : null;

    transaction.update(ref, {
      fen: chess.fen(),
      turn: chess.turn(),
      moves: [...room.moves, move.san],
      status: completed ? "completed" : "active",
      result,
      updatedAt: FieldValue.serverTimestamp(),
      ...(completed ? { endedAt: FieldValue.serverTimestamp() } : {}),
    });

    return { san: move.san, result };
  });
});

export const resignGame = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = getRoomId(request.data);

  await db.runTransaction(async (transaction) => {
    const ref = roomRef(roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");
    const room = snapshot.data() as Room;
    if (room.whiteUid !== uid && room.blackUid !== uid) {
      throw new HttpsError("permission-denied", "You are not a player in this room.");
    }
    if (room.status !== "active") {
      throw new HttpsError("failed-precondition", "This game is not active.");
    }

    transaction.update(ref, {
      status: "completed",
      result: room.whiteUid === uid ? "0-1" : "1-0",
      updatedAt: FieldValue.serverTimestamp(),
      endedAt: FieldValue.serverTimestamp(),
    });
  });

  return { roomId };
});

export const offerDraw = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = getRoomId(request.data);

  await db.runTransaction(async (transaction) => {
    const ref = roomRef(roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");
    const room = snapshot.data() as Room;
    if (room.whiteUid !== uid && room.blackUid !== uid) {
      throw new HttpsError("permission-denied", "You are not a player in this room.");
    }
    if (room.status !== "active") {
      throw new HttpsError("failed-precondition", "This game is not active.");
    }
    transaction.update(ref, {
      drawOfferUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { roomId };
});

export const acceptDraw = onCall(async (request) => {
  const uid = requireAuth(request);
  const roomId = getRoomId(request.data);

  await db.runTransaction(async (transaction) => {
    const ref = roomRef(roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");
    const room = snapshot.data() as Room;
    if (room.whiteUid !== uid && room.blackUid !== uid) {
      throw new HttpsError("permission-denied", "You are not a player in this room.");
    }
    if (room.status !== "active" || !room.drawOfferUid || room.drawOfferUid === uid) {
      throw new HttpsError("failed-precondition", "There is no draw offer to accept.");
    }
    transaction.update(ref, {
      status: "completed",
      result: "1/2-1/2",
      drawOfferUid: null,
      updatedAt: FieldValue.serverTimestamp(),
      endedAt: FieldValue.serverTimestamp(),
    });
  });

  return { roomId };
});
