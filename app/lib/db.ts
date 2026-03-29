/**
 * db.ts — Firestore adapter that replaces localStorage.
 *
 * Each game lives in a single Firestore document:
 *   /games/{roomCode}
 *
 * The document shape is identical to GameState from store.ts.
 * All player pages receive the roomCode via URL param ?room=XXXX.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { type GameState, type Player, registerPlayer } from "./store";

const COLLECTION = "games";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function loadRoom(roomCode: string): Promise<GameState | null> {
  const snap = await getDoc(doc(db, COLLECTION, roomCode));
  if (!snap.exists()) return null;
  return snap.data() as GameState;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveRoom(roomCode: string, state: GameState): Promise<void> {
  await setDoc(doc(db, COLLECTION, roomCode), state);
}

// ─── Real-time listener ───────────────────────────────────────────────────────

export function subscribeRoom(
  roomCode: string,
  onChange: (state: GameState) => void
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, roomCode), (snap) => {
    if (snap.exists()) onChange(snap.data() as GameState);
  });
}

// ─── Atomic registration (Firestore transaction) ──────────────────────────────

/**
 * Registers a player atomically. Prevents two players grabbing the same slot
 * when joining simultaneously.
 */
export async function registerPlayerInRoom(
  roomCode: string,
  name: string
): Promise<{
  player: Player | null;
  error?: "not_found" | "not_playing" | "no_slots" | "unknown";
}> {
  const ref = doc(db, COLLECTION, roomCode);
  let createdPlayer: Player | null = null;
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      if (state.status !== "playing") throw new Error("not_playing");
      const { state: newState, player } = registerPlayer(state, name);
      if (!player) throw new Error("no_slots");
      transaction.set(ref, newState);
      createdPlayer = player;
    });
    return { player: createdPlayer };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const known = ["not_found", "not_playing", "no_slots"];
    return {
      player: null,
      error: known.includes(msg)
        ? (msg as "not_found" | "not_playing" | "no_slots")
        : "unknown",
    };
  }
}
