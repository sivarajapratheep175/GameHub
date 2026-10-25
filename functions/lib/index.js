"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptDraw = exports.offerDraw = exports.resignGame = exports.submitMove = exports.joinRoom = exports.createRoom = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const chess_js_1 = require("chess.js");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
function requireAuth(request) {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    return request.auth.uid;
}
function getRoomId(data) {
    if (typeof data !== "object" ||
        data === null ||
        !("roomId" in data) ||
        typeof data.roomId !== "string" ||
        !/^[A-Z0-9]{6}$/.test(data.roomId)) {
        throw new https_1.HttpsError("invalid-argument", "A valid room code is required.");
    }
    return data.roomId;
}
function roomRef(roomId) {
    return db.collection("rooms").doc(roomId);
}
exports.createRoom = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const room = {
        whiteUid: uid,
        blackUid: null,
        fen: new chess_js_1.Chess().fen(),
        moves: [],
        turn: "w",
        status: "waiting",
        result: null,
    };
    await roomRef(roomId).set({
        ...room,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { roomId };
});
exports.joinRoom = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = getRoomId(request.data);
    await db.runTransaction(async (transaction) => {
        const ref = roomRef(roomId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
            throw new https_1.HttpsError("not-found", "Room not found.");
        }
        const room = snapshot.data();
        if (room.status !== "waiting" || room.blackUid) {
            throw new https_1.HttpsError("already-exists", "Room is already full.");
        }
        if (room.whiteUid === uid) {
            throw new https_1.HttpsError("failed-precondition", "You created this room.");
        }
        transaction.update(ref, {
            blackUid: uid,
            status: "active",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { roomId };
});
exports.submitMove = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = getRoomId(request.data);
    const data = request.data;
    if (typeof data.from !== "string" ||
        typeof data.to !== "string" ||
        (data.promotion !== undefined && typeof data.promotion !== "string")) {
        throw new https_1.HttpsError("invalid-argument", "A valid chess move is required.");
    }
    const from = data.from;
    const to = data.to;
    return db.runTransaction(async (transaction) => {
        const ref = roomRef(roomId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Room not found.");
        const room = snapshot.data();
        const isWhite = room.whiteUid === uid;
        const isBlack = room.blackUid === uid;
        if (!isWhite && !isBlack) {
            throw new https_1.HttpsError("permission-denied", "You are not a player in this room.");
        }
        if (room.status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "This game is not active.");
        }
        if ((room.turn === "w" && !isWhite) || (room.turn === "b" && !isBlack)) {
            throw new https_1.HttpsError("failed-precondition", "It is not your turn.");
        }
        const chess = new chess_js_1.Chess(room.fen);
        let move;
        try {
            move = chess.move({
                from,
                to,
                promotion: data.promotion,
            });
        }
        catch {
            throw new https_1.HttpsError("invalid-argument", "Illegal chess move.");
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
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            ...(completed ? { endedAt: firestore_1.FieldValue.serverTimestamp() } : {}),
        });
        return { san: move.san, result };
    });
});
exports.resignGame = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = getRoomId(request.data);
    await db.runTransaction(async (transaction) => {
        const ref = roomRef(roomId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Room not found.");
        const room = snapshot.data();
        if (room.whiteUid !== uid && room.blackUid !== uid) {
            throw new https_1.HttpsError("permission-denied", "You are not a player in this room.");
        }
        if (room.status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "This game is not active.");
        }
        transaction.update(ref, {
            status: "completed",
            result: room.whiteUid === uid ? "0-1" : "1-0",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            endedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { roomId };
});
exports.offerDraw = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = getRoomId(request.data);
    await db.runTransaction(async (transaction) => {
        const ref = roomRef(roomId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Room not found.");
        const room = snapshot.data();
        if (room.whiteUid !== uid && room.blackUid !== uid) {
            throw new https_1.HttpsError("permission-denied", "You are not a player in this room.");
        }
        if (room.status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "This game is not active.");
        }
        transaction.update(ref, {
            drawOfferUid: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { roomId };
});
exports.acceptDraw = (0, https_1.onCall)(async (request) => {
    const uid = requireAuth(request);
    const roomId = getRoomId(request.data);
    await db.runTransaction(async (transaction) => {
        const ref = roomRef(roomId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "Room not found.");
        const room = snapshot.data();
        if (room.whiteUid !== uid && room.blackUid !== uid) {
            throw new https_1.HttpsError("permission-denied", "You are not a player in this room.");
        }
        if (room.status !== "active" || !room.drawOfferUid || room.drawOfferUid === uid) {
            throw new https_1.HttpsError("failed-precondition", "There is no draw offer to accept.");
        }
        transaction.update(ref, {
            status: "completed",
            result: "1/2-1/2",
            drawOfferUid: null,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            endedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { roomId };
});
