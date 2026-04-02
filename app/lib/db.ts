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
import {
  type GameState,
  type Player,
  type ATGhostActionType,
  registerPlayer,
  registerATPlayer,
  queueATMatch,
  processATQueue,
  atAccuse,
  advanceATTrial,
  applyATGhostAction,
  DEFAULT_AT_CONFIG,
} from "./store";

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
 * Registers a player atomically. Handles both 'its-a-match' and 'agents-traitors' game modes.
 * Returns the created player, the room's gameMode (for redirect), and any error.
 */
export async function registerPlayerInRoom(
  roomCode: string,
  name: string
): Promise<{
  player: Player | null;
  gameMode?: string;
  error?: "not_found" | "not_playing" | "no_slots" | "unknown";
}> {
  const ref = doc(db, COLLECTION, roomCode);
  let createdPlayer: Player | null = null;
  let resolvedGameMode: string | undefined;
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      if (state.status !== "playing") throw new Error("not_playing");
      resolvedGameMode = state.gameMode;
      let newState: GameState;
      let player: Player | null;
      if (state.gameMode === "agents-traitors") {
        const result = registerATPlayer(state, name);
        newState = result.state;
        player = result.player;
      } else {
        const result = registerPlayer(state, name);
        newState = result.state;
        player = result.player;
      }
      if (!player) throw new Error("no_slots");
      transaction.set(ref, newState);
      createdPlayer = player;
    });
    return { player: createdPlayer, gameMode: resolvedGameMode };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const known = ["not_found", "not_playing", "no_slots"];
    return {
      player: null,
      gameMode: resolvedGameMode,
      error: known.includes(msg)
        ? (msg as "not_found" | "not_playing" | "no_slots")
        : "unknown",
    };
  }
}

// ─── Agents & Traitors transactions ──────────────────────────────────────────

/**
 * Queues a scan event (2–5 s delay). Enforces per-pair cooldown.
 * Both players must be alive.
 */
export async function queueATMatchInRoom(
  roomCode: string,
  scannerCode: string,
  scannedCode: string
): Promise<{ success: boolean; error?: string }> {
  const ref = doc(db, COLLECTION, roomCode);
  const now = Date.now();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      const scanner = state.players.find((p) => p.code === scannerCode);
      const scanned = state.players.find((p) => p.code === scannedCode);
      if (!scanner?.alive || !scanned?.alive) throw new Error("player_not_alive");
      const cooldownMs =
        (state.atConfig?.scanCooldownSecs ?? DEFAULT_AT_CONFIG.scanCooldownSecs) * 1000;
      if (now - (scanner.scanCooldowns?.[scannedCode] ?? 0) < cooldownMs)
        throw new Error("cooldown");
      const stateWithCooldown = {
        ...state,
        players: state.players.map((p) =>
          p.code === scannerCode
            ? { ...p, scanCooldowns: { ...(p.scanCooldowns ?? {}), [scannedCode]: now } }
            : p
        ),
      };
      tx.set(ref, queueATMatch(stateWithCooldown, scannerCode, scannedCode, now));
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Processes the match queue, applies passive decay, and advances any active trial.
 * Safe to call concurrently from multiple clients — idempotent if no change needed.
 */
export async function tickATRoom(roomCode: string): Promise<void> {
  const ref = doc(db, COLLECTION, roomCode);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const state = snap.data() as GameState;
    if (state.gameMode !== "agents-traitors" || state.status !== "playing" || state.winnerSide)
      return;
    const queued = processATQueue(state, now);
    const advanced = advanceATTrial(queued, now);
    tx.set(ref, advanced);
  });
}

/** Accuses a player. Triggers a trial when accusation threshold is reached. */
export async function accuseATPlayerInRoom(
  roomCode: string,
  accuserCode: string,
  targetCode: string
): Promise<{ success: boolean; trialTriggered: boolean; error?: string }> {
  const ref = doc(db, COLLECTION, roomCode);
  let trialTriggered = false;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      const result = atAccuse(state, accuserCode, targetCode);
      if (result.state === state) throw new Error("invalid");
      trialTriggered = result.trialTriggered;
      tx.set(ref, result.state);
    });
    return { success: true, trialTriggered };
  } catch (err) {
    return {
      success: false,
      trialTriggered: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/** Casts a GUILTY or INNOCENT vote during the trial voting phase. */
export async function voteATTrialInRoom(
  roomCode: string,
  voterCode: string,
  verdict: "guilty" | "innocent"
): Promise<{ success: boolean; error?: string }> {
  const ref = doc(db, COLLECTION, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      if (!state.trial || state.trial.phase !== "voting") throw new Error("not_voting");
      const voter = state.players.find((p) => p.code === voterCode);
      if (!voter?.alive) throw new Error("not_alive");
      tx.set(ref, {
        ...state,
        trial: { ...state.trial, votes: { ...state.trial.votes, [voterCode]: verdict } },
      });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** Uses a ghost action in the AT game. */
export async function useATGhostActionInRoom(
  roomCode: string,
  actorCode: string,
  type: ATGhostActionType,
  targetCode?: string
): Promise<{ success: boolean; error?: string }> {
  const ref = doc(db, COLLECTION, roomCode);
  const now = Date.now();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("not_found");
      const state = snap.data() as GameState;
      const newState = applyATGhostAction(state, actorCode, type, targetCode, now);
      if (newState === state) throw new Error("action_failed");
      tx.set(ref, newState);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
