"use client";

import { useState, useEffect } from "react";
import {
  type Pair,
  type GameState,
  type ATConfig,
  DEFAULT_AT_CONFIG,
} from "@/app/lib/store";
import { loadRoom, saveRoom, subscribeRoom } from "@/app/lib/db";
import { useLang } from "@/app/lib/LangContext";

// ─── Game modes registry ──────────────────────────────────────────────────────
const GAME_MODES = [
  { id: "its-a-match", label: "🃏 It's a Match", available: true },
  { id: "agents-traitors", label: "🕵️ Agents & Traîtres", available: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 confusables
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ─── Pair editor row ──────────────────────────────────────────────────────────
function PairRow({
  pair,
  onChange,
  onDelete,
}: {
  pair: Pair;
  onChange: (updated: Pair) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        placeholder="Moitié A"
        value={pair.wordA}
        onChange={(e) => onChange({ ...pair, wordA: e.target.value })}
        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <span className="text-gray-400 font-bold">↔</span>
      <input
        type="text"
        placeholder="Moitié B"
        value={pair.wordB}
        onChange={(e) => onChange({ ...pair, wordB: e.target.value })}
        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <button
        onClick={onDelete}
        className="text-red-400 hover:text-red-600 text-lg px-1"
        aria-label="Supprimer"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Admin page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const { t, toggleLang } = useLang();

  const [roomCode, setRoomCode] = useState<string>("");
  const [roomInput, setRoomInput] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState("");

  // Restore PIN + room from sessionStorage (single effect — order matters)
  useEffect(() => {
    const pinOk = sessionStorage.getItem("ttm_admin_pin") === "ok";
    if (!pinOk) return; // PIN not yet verified — don't touch Firebase
    setPinUnlocked(true);
    const savedRoom = sessionStorage.getItem("ttm_admin_room");
    if (savedRoom) loadExistingRoom(savedRoom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!roomCode) return;
    const unsub = subscribeRoom(roomCode, (s) => setState(s));
    return () => unsub();
  }, [roomCode]);

  function handlePin(e: React.FormEvent) {
    e.preventDefault();
    if (pinInput === "3112") {
      sessionStorage.setItem("ttm_admin_pin", "ok");
      setPinUnlocked(true);
      // Try to restore last room now that PIN is validated
      const savedRoom = sessionStorage.getItem("ttm_admin_room");
      if (savedRoom) loadExistingRoom(savedRoom);
    } else {
      setPinError("Code incorrect.");
      setPinInput("");
    }
  }

  // Races a promise against a timeout to avoid infinite loading when Firebase
  // is unreachable (e.g. missing .env.local).
  function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      ),
    ]);
  }

  async function createNewRoom() {
    const code = generateRoomCode();
    const fresh: GameState = {
      status: "waiting",
      nextCode: 1,
      pairs: [],
      players: [],
      accentColor: "#000000",
      gameMode: "its-a-match",
    };
    setLoading(true);
    setError("");
    try {
      await withTimeout(saveRoom(code, fresh));
      sessionStorage.setItem("ttm_admin_room", code);
      setRoomCode(code);
      setState(fresh);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      setError(
        isTimeout
          ? "Firebase ne répond pas. Vérifie que le fichier .env.local est configuré correctement."
          : "Impossible de créer la partie. Vérifie ta connexion et la configuration Firebase."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadExistingRoom(code: string) {
    setLoading(true);
    setError("");
    try {
      const s = await withTimeout(loadRoom(code.toUpperCase().trim()));
      if (!s) {
        setError("Aucune partie trouvée avec ce code.");
        return;
      }
      sessionStorage.setItem("ttm_admin_room", code.toUpperCase().trim());
      setRoomCode(code.toUpperCase().trim());
      setState(s);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      setError(
        isTimeout
          ? "Firebase ne répond pas. Vérifie que le fichier .env.local est configuré correctement."
          : "Impossible de contacter Firebase. Vérifie ta connexion et le fichier .env.local."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Pair management ──────────────────────────────────────────────────────────
  function addPair() {
    setState((s) => {
      if (!s) return s;
      return { ...s, pairs: [...s.pairs, { id: Date.now(), wordA: "", wordB: "" }] };
    });
  }

  function updatePair(updated: Pair) {
    setState((s) => {
      if (!s) return s;
      return { ...s, pairs: s.pairs.map((p) => (p.id === updated.id ? updated : p)) };
    });
  }

  function deletePair(id: number) {
    setState((s) => {
      if (!s) return s;
      return { ...s, pairs: s.pairs.filter((p) => p.id !== id) };
    });
  }

  function shufflePairs() {
    setState((s) => {
      if (!s) return s;
      const arr = [...s.pairs];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return { ...s, pairs: arr };
    });
  }

  // ── Persist ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!state || !roomCode) return;
    await saveRoom(roomCode, state);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Game control ─────────────────────────────────────────────────────────────
  async function handleLaunch() {
    if (!state || !roomCode) return;
    setIsLaunching(true);
    setError("");

    // ── Agents & Traitors launch ──────────────────────────────────────────────
    if (state.gameMode === "agents-traitors") {
      try {
        const config: ATConfig = state.atConfig ?? { ...DEFAULT_AT_CONFIG };
        // Generate a pre-shuffled role pool for up to 100 players
        const pool: ("agent" | "traitor")[] = [];
        for (let i = 0; i < config.traitorCount; i++) pool.push("traitor");
        while (pool.length < 100) pool.push("agent");
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const newState: GameState = {
          ...state,
          status: "playing",
          players: [],
          nextCode: 1,
          atConfig: config,
          atRolePool: pool,
          globalProgress: 50,
          lastMatchAt: Date.now(),
          matchQueue: [],
          trial: null,
          ghostLog: [],
          disruptedUntil: 0,
          revealedRoles: {},
          winnerSide: null,
        };
        await saveRoom(roomCode, newState);
        setState(newState);
      } catch {
        setError("Impossible de lancer la partie. Vérifie ta connexion Firebase.");
      } finally {
        setIsLaunching(false);
      }
      return;
    }

    // ── It's a Match launch ───────────────────────────────────────────────────
    const validPairs = state.pairs.filter((p) => p.wordA.trim() && p.wordB.trim());
    if (validPairs.length === 0) {
      setError("Ajoute au moins une paire avant de lancer !");
      setIsLaunching(false);
      return;
    }
    try {
      const newState: GameState = {
        ...state,
        pairs: validPairs,
        status: "playing",
        players: [],
        nextCode: 1,
      };
      await saveRoom(roomCode, newState);
      setState(newState);
    } catch {
      setError("Impossible de lancer la partie. Vérifie ta connexion Firebase.");
    } finally {
      setIsLaunching(false);
    }
  }

  async function handleStop() {
    if (!state || !roomCode) return;
    const newState: GameState = { ...state, status: "finished" };
    await saveRoom(roomCode, newState);
    setState(newState);
  }

  async function handleReset() {
    if (!confirm("Remettre à zéro toute la partie ?")) return;
    if (!roomCode) return;
    const fresh: GameState = {
      status: "waiting",
      nextCode: 1,
      pairs: state?.pairs ?? [],
      players: [],
      accentColor: state?.accentColor ?? "#000000",
      gameMode: state?.gameMode ?? "its-a-match",
      atConfig: state?.atConfig,
      atRolePool: undefined,
      globalProgress: undefined,
      lastMatchAt: undefined,
      matchQueue: undefined,
      trial: undefined,
      ghostLog: undefined,
      disruptedUntil: undefined,
      revealedRoles: undefined,
      winnerSide: undefined,
    };
    await saveRoom(roomCode, fresh);
    setState(fresh);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const matchedCount = (state?.players.filter((p) => p.matched).length ?? 0) / 2;
  const openSlots =
    (state?.pairs.filter((p) => p.wordA.trim() && p.wordB.trim()).length ?? 0) * 2 -
    (state?.players.length ?? 0);

  const statusLabel: Record<string, string> = {
    waiting: "⏳ En attente",
    playing: "🟢 En jeu",
    finished: "🔴 Terminée",
  };

  const accent = state?.accentColor ?? "#000000";
  const joinUrl =
    roomCode && typeof window !== "undefined"
      ? `${window.location.origin}/join?room=${roomCode}`
      : "";

  // ── PIN gate ──────────────────────────────────────────────────────────────────
  if (!pinUnlocked) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 max-w-xs mx-auto relative">
        <button
          onClick={toggleLang}
          className="absolute top-4 right-4 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition"
        >
          {t.lang_toggle}
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Maître du jeu</h1>
          <p className="text-gray-400 text-sm mt-1">Entrez le code d&apos;accès pour continuer.</p>
        </div>
        <form onSubmit={handlePin} className="flex flex-col gap-4 w-full">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Code PIN"
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value); setPinError(""); }}
            className="border-2 rounded-xl px-4 py-4 text-3xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-black"
            autoFocus
            autoComplete="off"
          />
          {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}
          <button
            type="submit"
            className="bg-black text-white rounded-xl py-3 font-bold text-lg active:scale-95 transition"
          >
            Accéder
          </button>
        </form>
      </main>
    );
  }

  // ── Room selector screen ──────────────────────────────────────────────────────
  if (!roomCode) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 max-w-sm mx-auto relative">
        <button
          onClick={toggleLang}
          className="absolute top-4 right-4 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition"
        >
          {t.lang_toggle}
        </button>
        <h1 className="text-2xl font-bold text-center">Admin — Maître du jeu</h1>

        <button
          onClick={createNewRoom}
          disabled={loading}
          className="w-full bg-black text-white rounded-xl py-4 font-bold text-lg hover:bg-gray-800 active:scale-95 transition disabled:opacity-50"
        >
          {loading ? "Création…" : "✨ Créer une nouvelle partie"}
        </button>

        <div className="w-full flex flex-col gap-3">
          <p className="text-center text-gray-400 text-sm">ou rejoindre une partie existante</p>
          <input
            type="text"
            placeholder="Code de salle (ex : LION4)"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            className="border rounded-lg px-4 py-3 text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-black uppercase"
            maxLength={5}
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={() => loadExistingRoom(roomInput)}
            disabled={loading || roomInput.length < 4}
            className="bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Rejoindre"}
          </button>
        </div>
      </main>
    );
  }

  if (!state) return <main className="p-6 text-gray-400">Chargement…</main>;

  // ── Main admin panel ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Admin — Maître du jeu</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Salle : {roomCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition"
          >
            {t.lang_toggle}
          </button>
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100">
            {statusLabel[state.status]}
          </span>
        </div>
      </div>

      {/* Join URL */}
      <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Code joueurs</p>
        <p className="text-5xl font-mono font-bold tracking-widest text-center py-2">{roomCode}</p>
        <p className="text-xs text-gray-400 text-center">
          Les joueurs entrent ce code sur la page d&apos;accueil du jeu.
        </p>
        <div className="border-t pt-3 flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Lien direct</p>
          <p className="text-xs font-mono break-all text-gray-500">{joinUrl}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(joinUrl)}
              className="text-xs underline text-gray-400"
            >
              Copier le lien
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(roomCode)}
              className="text-xs underline text-gray-400"
            >
              Copier le code
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {state.gameMode === "agents-traitors" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t.at_admin_stats_alive, value: state.players.filter((p) => p.alive).length },
              {
                label: t.at_admin_stats_traitors,
                value: state.players.filter((p) => p.alive && p.role === "traitor").length,
              },
              { label: "Joueurs inscrits", value: state.players.length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center gap-1">
                <span className="text-3xl font-bold">{value}</span>
                <span className="text-xs text-gray-400 text-center">{label}</span>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          {state.status === "playing" && (
            <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-gray-400 uppercase tracking-widest">
                <span>{t.at_admin_stats_progress}</span>
                <span className="font-bold text-gray-700">{state.globalProgress ?? 50}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${state.globalProgress ?? 50}%`,
                    backgroundColor:
                      (state.globalProgress ?? 50) > 60
                        ? "#22c55e"
                        : (state.globalProgress ?? 50) > 35
                        ? "#f59e0b"
                        : "#ef4444",
                  }}
                />
              </div>
            </div>
          )}
          {/* Player role list (admin view) */}
          {state.players.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Joueurs & rôles</p>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {state.players.map((p) => (
                  <div key={p.code} className="flex items-center justify-between text-sm">
                    <span className={p.alive ? "font-medium" : "text-gray-400 line-through"}>
                      {p.name}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.role === "traitor"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {p.role === "traitor" ? "TRAÎTRE" : "AGENT"}
                      {p.isGhost ? " 👻" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Joueurs inscrits", value: state.players.length },
            { label: "Matchs trouvés", value: matchedCount },
            { label: "Places restantes", value: openSlots > 0 ? openSlots : 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center gap-1">
              <span className="text-3xl font-bold">{value}</span>
              <span className="text-xs text-gray-400 text-center">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Game controls */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        {state.status === "waiting" && (
          <button
            onClick={handleLaunch}
            disabled={isLaunching}
            className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold hover:bg-green-600 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLaunching ? "Lancement…" : "🚀 Lancer la partie"}
          </button>
        )}
        {state.status === "playing" && (
          <button
            onClick={handleStop}
            className="flex-1 bg-red-500 text-white rounded-xl py-3 font-bold hover:bg-red-600 active:scale-95 transition"
          >
            ⏹ Arrêter la partie
          </button>
        )}
        <button
          onClick={handleReset}
          className="bg-gray-100 text-gray-600 rounded-xl px-4 py-3 font-semibold hover:bg-gray-200 active:scale-95 transition text-sm"
        >
          Remise à zéro
        </button>
      </div>

      {/* Settings — only editable when not actively playing */}
      {state.status !== "playing" && (
        <section className="flex flex-col gap-6">

          {/* Game mode */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Mode de jeu</h2>
            <div className="flex flex-col gap-2">
              {GAME_MODES.map((mode) => (
                <label
                  key={mode.id}
                  className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition ${
                    !mode.available ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  style={
                    state.gameMode === mode.id
                      ? { borderColor: accent, color: accent }
                      : { borderColor: "#e5e7eb" }
                  }
                >
                  <input
                    type="radio"
                    name="gameMode"
                    value={mode.id}
                    checked={state.gameMode === mode.id}
                    disabled={!mode.available}
                    onChange={() =>
                      setState((s) => {
                        if (!s) return s;
                        const next = { ...s, gameMode: mode.id };
                        // Initialise AT config when switching to that mode
                        if (mode.id === "agents-traitors" && !next.atConfig) {
                          next.atConfig = { ...DEFAULT_AT_CONFIG };
                        }
                        return next;
                      })
                    }
                  />
                  <span className="font-medium">{mode.label}</span>
                  {!mode.available && (
                    <span className="ml-auto text-xs text-gray-400">Bientôt</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* ── AT config panel (only for Agents & Traitors mode) ─────────── */}
          {state.gameMode === "agents-traitors" && (
            <div className="flex flex-col gap-4 bg-gray-50 rounded-2xl p-4">
              <h2 className="text-lg font-semibold">{t.at_admin_config_title}</h2>
              {(
                [
                  { key: "traitorCount", label: t.at_admin_traitor_count, min: 1, max: 20 },
                  { key: "decayIntervalSecs", label: t.at_admin_decay, min: 10, max: 240 },
                  {
                    key: "trialThresholdPct",
                    label: t.at_admin_trial_threshold,
                    min: 5,
                    max: 30,
                    scale: 100,
                  },
                  { key: "trialDurationSecs", label: t.at_admin_trial_duration, min: 10, max: 120 },
                  { key: "scanCooldownSecs", label: t.at_admin_scan_cooldown, min: 10, max: 300 },
                  { key: "ghostCooldownSecs", label: t.at_admin_ghost_cooldown, min: 30, max: 600 },
                  { key: "progressPerMatch", label: t.at_admin_progress_per_match, min: 1, max: 10 },
                ] as { key: keyof typeof DEFAULT_AT_CONFIG; label: string; min: number; max: number; scale?: number }[]
              ).map(({ key, label, min, max, scale }) => {
                const cfg = state.atConfig ?? DEFAULT_AT_CONFIG;
                const raw = cfg[key] as number;
                const display = scale ? Math.round(raw * scale) : raw;
                return (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-gray-700 flex-1">{label}</label>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={display}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (isNaN(v)) return;
                        const stored = scale ? v / scale : v;
                        setState((s) =>
                          s
                            ? { ...s, atConfig: { ...(s.atConfig ?? DEFAULT_AT_CONFIG), [key]: stored } }
                            : s
                        );
                      }}
                      className="border rounded-lg px-2 py-1 w-20 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Accent colour */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Couleur du thème joueur</h2>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={state.accentColor}
                onChange={(e) =>
                  setState((s) => (s ? { ...s, accentColor: e.target.value } : s))
                }
                className="w-12 h-12 rounded-lg border cursor-pointer"
              />
              <input
                type="text"
                value={state.accentColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val))
                    setState((s) => (s ? { ...s, accentColor: val } : s));
                }}
                maxLength={7}
                className="border rounded-lg px-3 py-2 font-mono text-sm w-28 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="#000000"
              />
              <div
                className="w-10 h-10 rounded-lg border"
                style={{ backgroundColor: state.accentColor }}
              />
            </div>
          </div>

          {/* Pair editor — only for It's a Match */}
          {state.gameMode !== "agents-traitors" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Paires de mots</h2>
              <button onClick={shufflePairs} className="text-sm text-gray-500 underline">
                Mélanger
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {state.pairs.map((pair) => (
                <PairRow
                  key={pair.id}
                  pair={pair}
                  onChange={updatePair}
                  onDelete={() => deletePair(pair.id)}
                />
              ))}
            </div>

            <button
              onClick={addPair}
              className="border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition text-sm"
            >
              + Ajouter une paire
            </button>

            <button
              onClick={handleSave}
              className="text-white rounded-lg py-3 font-semibold active:scale-95 transition"
              style={{ backgroundColor: accent }}
            >
              {saved ? "✓ Enregistré !" : "Enregistrer"}
            </button>
          </div>
          )}

          {/* Save for AT mode */}
          {state.gameMode === "agents-traitors" && (
            <button
              onClick={handleSave}
              className="text-white rounded-lg py-3 font-semibold active:scale-95 transition"
              style={{ backgroundColor: accent }}
            >
              {saved ? "✓ Enregistré !" : "Enregistrer"}
            </button>
          )}
        </section>
      )}

      {/* Player list */}
      {state.players.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Joueurs ({state.players.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Prénom</th>
                  <th className="py-2 pr-4">Moitié</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((p) => {
                  const pair = state.pairs.find((pr) => pr.id === p.pairId);
                  const word = pair
                    ? p.half === "A"
                      ? pair.wordA
                      : pair.wordB
                    : "—";
                  return (
                    <tr key={p.code} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono font-bold">{p.code}</td>
                      <td className="py-2 pr-4">{p.name}</td>
                      <td className="py-2 pr-4">{word}</td>
                      <td className="py-2">
                        {p.matched ? (
                          <span className="font-semibold" style={{ color: accent }}>
                            ✓ Trouvé
                          </span>
                        ) : (
                          <span className="text-gray-400">En recherche</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
