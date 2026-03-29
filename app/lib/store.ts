// ─── Types ───────────────────────────────────────────────────────────────────

export type GameStatus = "waiting" | "playing" | "finished";

/** A concept-pair the admin enters (e.g. "Soleil" / "Lune"). */
export interface Pair {
  id: number;
  wordA: string;
  wordB: string;
}

/** A registered player. */
export interface Player {
  /** 4-digit zero-padded string, e.g. "0042". Unique. */
  code: string;
  name: string;
  /** id of the Pair this player belongs to. */
  pairId: number;
  /** Which half they hold ("A" or "B"). */
  half: "A" | "B";
  /** code of their correct partner. */
  partnerCode: string;
  /** Whether this player has found their match. */
  matched: boolean;
}

export interface GameState {
  status: GameStatus;
  /** Monotonically incrementing counter used to generate codes. */
  nextCode: number;
  pairs: Pair[];
  players: Player[];
  /** Hex colour used for the player-facing UI accent (buttons, cards). Default #000000. */
  accentColor: string;
  /** Selected game mode identifier. Currently only 'its-a-match'. */
  gameMode: string;
}

// ─── Default / empty state ───────────────────────────────────────────────────

const DEFAULT_STATE: GameState = {
  status: "waiting",
  nextCode: 1,
  pairs: [],
  players: [],
  accentColor: "#000000",
  gameMode: "its-a-match",
};

const KEY = "ttm_game";

// ─── Persistence helpers ─────────────────────────────────────────────────────

export function loadState(): GameState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return JSON.parse(raw) as GameState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: GameState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// ─── Player helpers ───────────────────────────────────────────────────────────

/** Formats a number as a zero-padded 4-digit code. */
export function formatCode(n: number): string {
  return String(n).padStart(4, "0");
}

export function getPlayerByCode(state: GameState, code: string): Player | undefined {
  return state.players.find((p) => p.code === code);
}

/**
 * Registers a new player. Assigns the next available code and a pair/half.
 * Pairs are distributed round-robin. Each pair has at most one A and one B slot.
 * Returns the new state and the created player (or null if no pairs available).
 */
export function registerPlayer(
  state: GameState,
  name: string
): { state: GameState; player: Player | null } {
  if (state.pairs.length === 0) {
    return { state, player: null };
  }

  const code = formatCode(state.nextCode);

  // Find a pair that still has an available slot
  const usedSlots = state.players.reduce<Record<number, { A: boolean; B: boolean }>>(
    (acc, p) => {
      if (!acc[p.pairId]) acc[p.pairId] = { A: false, B: false };
      acc[p.pairId][p.half] = true;
      return acc;
    },
    {}
  );

  let chosenPair: Pair | null = null;
  let chosenHalf: "A" | "B" = "A";

  for (const pair of state.pairs) {
    const slots = usedSlots[pair.id] ?? { A: false, B: false };
    if (!slots.A) {
      chosenPair = pair;
      chosenHalf = "A";
      break;
    }
    if (!slots.B) {
      chosenPair = pair;
      chosenHalf = "B";
      break;
    }
  }

  if (!chosenPair) {
    return { state, player: null };
  }

  // Find partner (the other half of the same pair, if already registered)
  const existingPartner = state.players.find(
    (p) => p.pairId === chosenPair!.id && p.half !== chosenHalf
  );

  const player: Player = {
    code,
    name,
    pairId: chosenPair.id,
    half: chosenHalf,
    partnerCode: existingPartner?.code ?? "",
    matched: false,
  };

  // Back-fill partner's partnerCode if they exist
  const updatedPlayers = state.players.map((p) =>
    p.pairId === chosenPair!.id && p.half !== chosenHalf
      ? { ...p, partnerCode: code }
      : p
  );

  const newState: GameState = {
    ...state,
    nextCode: state.nextCode + 1,
    players: [...updatedPlayers, player],
  };

  return { state: newState, player };
}

/** Marks a pair of players as matched. */
export function confirmMatch(
  state: GameState,
  codeA: string,
  codeB: string
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.code === codeA || p.code === codeB ? { ...p, matched: true } : p
    ),
  };
}

/** Returns the word this player sees as their "moitié clue". */
export function getMotieWord(state: GameState, player: Player): string {
  const pair = state.pairs.find((p) => p.id === player.pairId);
  if (!pair) return "";
  return player.half === "A" ? pair.wordA : pair.wordB;
}

/** Returns the word of the partner (shown at confirmation). */
export function getPartnerWord(state: GameState, player: Player): string {
  const pair = state.pairs.find((p) => p.id === player.pairId);
  if (!pair) return "";
  return player.half === "A" ? pair.wordB : pair.wordA;
}
