// ─── Types ───────────────────────────────────────────────────────────────────

export type GameStatus = "waiting" | "playing" | "finished";

// ─── Agents & Traitors types ─────────────────────────────────────────────────

export type ATRole = "agent" | "traitor";

export interface ATConfig {
  traitorCount: number;
  /** Total number of players expected to join. Used to size the role pool correctly. */
  expectedPlayerCount: number;
  /** Seconds between -1% passive decay. */
  decayIntervalSecs: number;
  /** Fraction of alive players needed to trigger a trial (e.g. 0.12 = 12%). */
  trialThresholdPct: number;
  /** Seconds for the defense phase. */
  trialDurationSecs: number;
  /** Minimum seconds before the same pair can scan each other again. */
  scanCooldownSecs: number;
  /** Seconds between ghost actions. */
  ghostCooldownSecs: number;
  /** Progress delta per qualifying Agent+Agent scan. */
  progressPerMatch: number;
}

export const DEFAULT_AT_CONFIG: ATConfig = {
  traitorCount: 3,
  expectedPlayerCount: 20,
  decayIntervalSecs: 30,
  trialThresholdPct: 0.12,
  trialDurationSecs: 30,
  scanCooldownSecs: 90,
  ghostCooldownSecs: 180,
  progressPerMatch: 3,
};

export type ATGhostActionType =
  | "agent_boost"      // +3% progress
  | "agent_reveal"     // randomly reveal role of an alive player to all
  | "agent_protect"    // shield a player from accusations for 90s
  | "traitor_sabotage" // -3% progress
  | "traitor_plant"    // add 2 anonymous suspicion votes to a player
  | "traitor_disrupt"; // block scan effects for 45s

export interface ATMatchEvent {
  id: string;
  scannerCode: string;
  scannedCode: string;
  /** ms timestamp when the effect should be applied. */
  applyAt: number;
  applied: boolean;
}

export interface ATTrial {
  targetCode: string;
  /** ms timestamp of the start of the current phase. */
  startedAt: number;
  durationSecs: number;
  phase: "defense" | "voting" | "resolved";
  votes: Record<string, "guilty" | "innocent">;
  outcome?: "eliminated" | "acquitted";
}

export interface ATGhostLogEntry {
  id: string;
  actorCode: string;
  type: ATGhostActionType;
  appliedAt: number;
  targetCode?: string;
  /** Message shown to all players in the ghost log. */
  publicMessage: string;
  /** Extra message shown only to the ghost who performed the action. */
  privateMessage?: string;
}

export interface ATEventEntry {
  id: string;
  at: number;
  /** "scan" = player scanned another | "accused" = player accused another | "trial_result" = verdict */
  type: "scan" | "accused" | "trial_result";
  actorCode: string;
  targetCode: string;
  note?: string; // for trial_result: "eliminated" | "acquitted"
}

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
  // ── Agents & Traitors fields (optional, only used in that mode) ──────────
  role?: ATRole;
  alive?: boolean;
  isGhost?: boolean;
  /** Codes of players who have accused this player. */
  suspicionVoters?: string[];
  lastGhostActionAt?: number;
  /** ms timestamp until protection expires. */
  protectedUntil?: number;
  /** opponentCode → last scan ms timestamp (cooldown tracking). */
  scanCooldowns?: Record<string, number>;
}

export interface GameState {
  status: GameStatus;
  /** Monotonically incrementing counter used to generate codes. */
  nextCode: number;
  pairs: Pair[];
  players: Player[];
  /** Hex colour used for the player-facing UI accent (buttons, cards). Default #000000. */
  accentColor: string;
  /** Selected game mode identifier. */
  gameMode: string;
  // ── Agents & Traitors mode state (optional) ─────────────────────────────
  atConfig?: ATConfig;
  /** Pre-shuffled role assignments; index = player join order. */
  atRolePool?: ATRole[];
  /** Global progress bar value 0–100. Starts at 50. */
  globalProgress?: number;
  /** ms timestamp of last match event (used for passive decay calculation). */
  lastMatchAt?: number;
  matchQueue?: ATMatchEvent[];
  trial?: ATTrial | null;
  ghostLog?: ATGhostLogEntry[];
  /** Persistent event log for player history. */
  eventLog?: ATEventEntry[];
  /** ms timestamp until scan disruption expires. */
  disruptedUntil?: number;
  /** Publicly revealed roles (code → role). */
  revealedRoles?: Record<string, ATRole>;
  winnerSide?: "agents" | "traitors" | null;
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

// ─── Agents & Traitors helpers ────────────────────────────────────────────────

/**
 * Registers an AT player.
 * Role is pulled from the pre-shuffled pool; defaults to "agent" if pool is exhausted.
 */
export function registerATPlayer(
  state: GameState,
  name: string
): { state: GameState; player: Player | null } {
  const pool = state.atRolePool ?? [];
  const playerIndex = state.players.length;
  const role: ATRole = playerIndex < pool.length ? pool[playerIndex] : "agent";
  const code = formatCode(state.nextCode);
  const player: Player = {
    code,
    name,
    pairId: -1,
    half: "A",
    partnerCode: "",
    matched: false,
    role,
    alive: true,
    isGhost: false,
    suspicionVoters: [],
    lastGhostActionAt: 0,
    protectedUntil: 0,
    scanCooldowns: {},
  };
  return {
    state: { ...state, nextCode: state.nextCode + 1, players: [...state.players, player] },
    player,
  };
}

/** Queues a delayed match event (2–5 s random delay). */
export function queueATMatch(
  state: GameState,
  scannerCode: string,
  scannedCode: string,
  now: number = Date.now()
): GameState {
  const delayMs = 2000 + Math.random() * 3000;
  const event: ATMatchEvent = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    scannerCode,
    scannedCode,
    applyAt: now + delayMs,
    applied: false,
  };
  return { ...state, matchQueue: [...(state.matchQueue ?? []), event] };
}

/** Passive decay: subtract 1% progress per completed decay interval since lastMatchAt. */
function applyATDecay(state: GameState, now: number): GameState {
  if (state.winnerSide) return state;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const lastMatchAt = state.lastMatchAt ?? now;
  const intervalMs = config.decayIntervalSecs * 1000;
  const decayTicks = Math.floor((now - lastMatchAt) / intervalMs);
  if (decayTicks === 0) return state;
  const progress = Math.max(0, (state.globalProgress ?? 50) - decayTicks);
  return {
    ...state,
    globalProgress: progress,
    lastMatchAt: lastMatchAt + decayTicks * intervalMs,
    winnerSide: progress <= 0 ? "traitors" : state.winnerSide ?? null,
  };
}

/**
 * Processes all ready queued match events and applies progress changes.
 * Also runs passive decay.
 */
export function processATQueue(state: GameState, now: number = Date.now()): GameState {
  const queue = state.matchQueue ?? [];
  const readyEvents = queue.filter((e) => !e.applied && e.applyAt <= now);

  if (readyEvents.length === 0) return applyATDecay(state, now);

  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const disrupted = (state.disruptedUntil ?? 0) > now;
  let progress = state.globalProgress ?? 50;

  for (const event of readyEvents) {
    if (disrupted) continue;
    const scanner = state.players.find((p) => p.code === event.scannerCode);
    const scanned = state.players.find((p) => p.code === event.scannedCode);
    if (!scanner?.alive || !scanned?.alive) continue;
    if (scanner.role === "agent" && scanned.role === "agent") {
      progress = Math.min(100, progress + config.progressPerMatch);
    } else {
      progress = Math.max(0, progress - config.progressPerMatch);
    }
  }

  const newQueue = queue.map((e) =>
    readyEvents.some((r) => r.id === e.id) ? { ...e, applied: true } : e
  );
  let winnerSide = state.winnerSide ?? null;
  if (progress >= 100) winnerSide = "agents";
  if (progress <= 0) winnerSide = "traitors";

  return applyATDecay(
    { ...state, matchQueue: newQueue, globalProgress: progress, lastMatchAt: now, winnerSide },
    now
  );
}

/**
 * Computes what the progress bar should display right now, including unwritten decay.
 * Pure calculation — does not mutate state.
 */
export function computeATVisualProgress(state: GameState, now: number = Date.now()): number {
  if (state.winnerSide) return state.globalProgress ?? 50;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const lastMatchAt = state.lastMatchAt ?? now;
  const intervalMs = config.decayIntervalSecs * 1000;
  const decayTicks = Math.floor((now - lastMatchAt) / intervalMs);
  return Math.max(0, (state.globalProgress ?? 50) - decayTicks);
}

/**
 * Accuses a player. Returns new state and whether a trial was triggered.
 */
export function atAccuse(
  state: GameState,
  accuserCode: string,
  targetCode: string,
  now: number = Date.now()
): { state: GameState; trialTriggered: boolean } {
  if (accuserCode === targetCode) return { state, trialTriggered: false };
  if (state.trial && state.trial.phase !== "resolved") return { state, trialTriggered: false };
  const target = state.players.find((p) => p.code === targetCode);
  const accuser = state.players.find((p) => p.code === accuserCode);
  if (!target?.alive || !accuser?.alive) return { state, trialTriggered: false };
  if ((target.protectedUntil ?? 0) > now) return { state, trialTriggered: false };
  if ((target.suspicionVoters ?? []).includes(accuserCode)) return { state, trialTriggered: false };

  const updatedTarget = { ...target, suspicionVoters: [...(target.suspicionVoters ?? []), accuserCode] };
  const updatedPlayers = state.players.map((p) => (p.code === targetCode ? updatedTarget : p));
  const aliveCount = updatedPlayers.filter((p) => p.alive).length;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const votesNeeded = Math.max(1, Math.min(aliveCount - 1, Math.max(2, Math.ceil(aliveCount * config.trialThresholdPct))));
  let trialTriggered = false;
  let newState: GameState = { ...state, players: updatedPlayers };

  if ((updatedTarget.suspicionVoters?.length ?? 0) >= votesNeeded) {
    trialTriggered = true;
    newState = {
      ...newState,
      trial: {
        targetCode,
        startedAt: now,
        durationSecs: config.trialDurationSecs,
        phase: "defense",
        votes: {},
      },
      // Reset suspicion votes once trial starts
      players: updatedPlayers.map((p) => (p.code === targetCode ? { ...p, suspicionVoters: [] } : p)),
    };
  }
  if (trialTriggered) {
    const trialEvent: ATEventEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      at: now,
      type: "accused",
      actorCode: accuserCode,
      targetCode,
    };
    newState = { ...newState, eventLog: [...(newState.eventLog ?? []), trialEvent] };
  }
  return { state: newState, trialTriggered };
}

/**
 * Resolves the voting phase of an active trial.
 * Can be called immediately (all voted) or after timer expiry.
 */
export function resolveATVoting(state: GameState, now: number = Date.now()): GameState {
  const trial = state.trial;
  if (!trial || trial.phase !== "voting") return state;

  const guiltyCount = Object.values(trial.votes).filter((v) => v === "guilty").length;
  const innocentCount = Object.values(trial.votes).filter((v) => v === "innocent").length;
  const outcome: "eliminated" | "acquitted" =
    guiltyCount > innocentCount ? "eliminated" : "acquitted";

  const newRevealedRoles = { ...(state.revealedRoles ?? {}) };
  const players = state.players.map((p) => {
    if (p.code !== trial.targetCode) return p;
    if (outcome === "eliminated") {
      newRevealedRoles[p.code] = p.role!;
      return { ...p, alive: false, isGhost: true, suspicionVoters: [] };
    }
    return { ...p, suspicionVoters: [] };
  });

  const totalTraitors = players.filter((p) => p.role === "traitor").length;
  const aliveTraitors = players.filter((p) => p.alive && p.role === "traitor").length;
  let winnerSide = state.winnerSide ?? null;
  if (totalTraitors > 0 && aliveTraitors === 0) winnerSide = "agents";

  const eventEntry: ATEventEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    at: now,
    type: "trial_result",
    actorCode: trial.targetCode,
    targetCode: trial.targetCode,
    note: outcome,
  };

  return {
    ...state,
    players,
    trial: { ...trial, phase: "resolved", outcome },
    revealedRoles: newRevealedRoles,
    winnerSide,
    eventLog: [...(state.eventLog ?? []), eventEntry],
  };
}

/**
 * Advances the trial to the next phase (defense → voting → resolved).
 * Should be called periodically by the client tick.
 */
export function advanceATTrial(state: GameState, now: number = Date.now()): GameState {
  const trial = state.trial;
  if (!trial || trial.phase === "resolved") return state;

  const phaseEnd = trial.startedAt + trial.durationSecs * 1000;
  if (now < phaseEnd) return state;

  if (trial.phase === "defense") {
    return { ...state, trial: { ...trial, phase: "voting", startedAt: now, durationSecs: 30 } };
  }

  if (trial.phase === "voting") {
    return resolveATVoting(state, now);
  }
  return state;
}

/**
 * Applies a ghost action to the state.
 * Returns the unchanged state if the action is invalid (cooldown, wrong role, etc.).
 */
export function applyATGhostAction(
  state: GameState,
  actorCode: string,
  type: ATGhostActionType,
  targetCode: string | undefined,
  now: number = Date.now()
): GameState {
  const actor = state.players.find((p) => p.code === actorCode);
  if (!actor?.isGhost) return state;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  if ((actor.lastGhostActionAt ?? 0) + config.ghostCooldownSecs * 1000 > now) return state;

  let newState: GameState = { ...state };
  let publicMessage = "";
  let privateMessage: string | undefined;

  switch (type) {
    case "agent_boost": {
      const progress = Math.min(100, (newState.globalProgress ?? 50) + 3);
      newState = {
        ...newState,
        globalProgress: progress,
        lastMatchAt: now,
        winnerSide: progress >= 100 ? "agents" : (newState.winnerSide ?? null),
      };
      publicMessage = "👻 Un agent fantôme envoie un signal de renfort ! (+3%)";
      privateMessage = `👻 Tu as renforcé le réseau. Progression : ${progress}%`;
      break;
    }
    case "agent_reveal": {
      const unrevealed = state.players.filter(
        (p) => p.alive && !(state.revealedRoles ?? {})[p.code]
      );
      if (unrevealed.length === 0) return state;
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      newState = {
        ...newState,
        revealedRoles: { ...(newState.revealedRoles ?? {}), [pick.code]: pick.role! },
      };
      publicMessage = `🔍 Un agent fantôme a révélé l'identité de ${pick.name} !`;      privateMessage = `🔍 Tu as révélé que ${pick.name} est : ${pick.role === "traitor" ? "TRAÎTRE 🔴" : "AGENT 🔵"}`;      break;
    }
    case "agent_protect": {
      if (!targetCode) return state;
      const tgt = state.players.find((p) => p.code === targetCode);
      if (!tgt?.alive) return state;
      newState = {
        ...newState,
        players: newState.players.map((p) =>
          p.code === targetCode ? { ...p, protectedUntil: now + 90_000 } : p
        ),
      };
      publicMessage = `🛡️ Un agent fantôme protège ${tgt.name} pendant 90 secondes !`;
      privateMessage = `🛡️ Tu as protégé ${tgt.name} contre les accusations pendant 90 secondes.`;
      break;
    }
    case "traitor_sabotage": {
      const progress = Math.max(0, (newState.globalProgress ?? 50) - 3);
      newState = {
        ...newState,
        globalProgress: progress,
        winnerSide: progress <= 0 ? "traitors" : (newState.winnerSide ?? null),
      };
      publicMessage = "💣 Un traître fantôme sabote le réseau ! (-3%)";
      privateMessage = `💣 Tu as saboté le réseau. Progression : ${progress}%`;
      break;
    }
    case "traitor_plant": {
      if (!targetCode) return state;
      const tgt = state.players.find((p) => p.code === targetCode);
      if (!tgt?.alive) return state;
      const syntheticVotes = [`__ghost_${actorCode}_1`, `__ghost_${actorCode}_2`];
      const newVoters = [...new Set([...(tgt.suspicionVoters ?? []), ...syntheticVotes])];
      let updatedPlayers = newState.players.map((p) =>
        p.code === targetCode ? { ...p, suspicionVoters: newVoters } : p
      );
      publicMessage = `👁️ Quelque chose de louche rôde autour de ${tgt.name}…`;
      privateMessage = `👁️ Tu as planté des votes de suspicion sur ${tgt.name}.`;
      // Check if this plants enough votes for a trial
      const aliveCount = updatedPlayers.filter((p) => p.alive).length;
      const votesNeeded = Math.max(1, Math.min(aliveCount - 1, Math.max(2, Math.ceil(aliveCount * config.trialThresholdPct))));
      if (newVoters.length >= votesNeeded && (!newState.trial || newState.trial.phase === "resolved")) {
        newState = {
          ...newState,
          players: updatedPlayers.map((p) => (p.code === targetCode ? { ...p, suspicionVoters: [] } : p)),
          trial: { targetCode, startedAt: now, durationSecs: config.trialDurationSecs, phase: "defense", votes: {} },
        };
      } else {
        newState = { ...newState, players: updatedPlayers };
      }
      break;
    }
    case "traitor_disrupt": {
      newState = { ...newState, disruptedUntil: now + 45_000 };
      publicMessage = "📡 Les connexions sont brouillées ! Les scans sont perturbés pendant 45 secondes.";
      privateMessage = "📡 Tu as brouillé le réseau. Les scans sont bloqués pendant 45 secondes.";
      break;
    }
  }

  newState = {
    ...newState,
    players: newState.players.map((p) =>
      p.code === actorCode ? { ...p, lastGhostActionAt: now } : p
    ),
    ghostLog: [
      ...(newState.ghostLog ?? []),
      {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        actorCode,
        type,
        appliedAt: now,
        targetCode,
        publicMessage,
        privateMessage,
      },
    ],
  };
  return newState;
}
