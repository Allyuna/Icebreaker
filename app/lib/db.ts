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
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { type GameState } from "./store";

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
