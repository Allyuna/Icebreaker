"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  subscribeRoom,
  accuseATPlayerInRoom,
  voteATTrialInRoom,
  useATGhostActionInRoom,
  tickATRoom,
} from "@/app/lib/db";
import {
  getPlayerByCode,
  computeATVisualProgress,
  DEFAULT_AT_CONFIG,
  type GameState,
  type Player,
  type ATGhostActionType,
} from "@/app/lib/store";
import { useLang } from "@/app/lib/LangContext";
import type { Translations } from "@/app/lib/i18n";

export default function ATHubPage() {
  return (
    <Suspense>
      <ATHubInner />
    </Suspense>
  );
}

// ─── Scratch card overlay ─────────────────────────────────────────────────────

function ScratchCardScreen({
  player,
  fellowTraitors,
  t,
  onDone,
}: {
  player: Player;
  fellowTraitors: Player[];
  t: Translations;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverageDone = useRef(false);
  const [showContinue, setShowContinue] = useState(false);
  const isTraitor = player.role === "traitor";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = Math.round(rect.width) || window.innerWidth;
    const H = Math.round(rect.height) || window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    const fontSize = Math.max(13, Math.round(W * 0.042));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(t.at_scratch_hint, W / 2, H / 2 - 14);

    const brushR = Math.max(24, Math.round(W * 0.1));
    let scratchCount = 0;
    let drawing = false;

    function scratchAt(x: number, y: number) {
      if (coverageDone.current) return;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushR, 0, Math.PI * 2);
      ctx.fill();
      scratchCount++;
      if (scratchCount % 4 !== 0) return;
      const d = ctx.getImageData(0, 0, W, H).data;
      let transparent = 0;
      for (let i = 3; i < d.length; i += 64) {
        if (d[i] < 128) transparent++;
      }
      if (transparent / (d.length / 64) > 0.5) {
        coverageDone.current = true;
        setShowContinue(true);
      }
    }

    const onTS = (e: TouchEvent) => {
      e.preventDefault(); drawing = true;
      const r = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++)
        scratchAt(e.touches[i].clientX - r.left, e.touches[i].clientY - r.top);
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault(); if (!drawing) return;
      const r = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++)
        scratchAt(e.touches[i].clientX - r.left, e.touches[i].clientY - r.top);
    };
    const onTE = () => { drawing = false; };
    const onMD = (e: MouseEvent) => {
      drawing = true;
      const r = canvas.getBoundingClientRect();
      scratchAt(e.clientX - r.left, e.clientY - r.top);
    };
    const onMM = (e: MouseEvent) => {
      if (!drawing) return;
      const r = canvas.getBoundingClientRect();
      scratchAt(e.clientX - r.left, e.clientY - r.top);
    };
    const onMU = () => { drawing = false; };

    canvas.addEventListener("touchstart", onTS, { passive: false });
    canvas.addEventListener("touchmove", onTM, { passive: false });
    canvas.addEventListener("touchend", onTE);
    canvas.addEventListener("mousedown", onMD);
    canvas.addEventListener("mousemove", onMM);
    canvas.addEventListener("mouseup", onMU);
    canvas.addEventListener("mouseleave", onMU);
    return () => {
      canvas.removeEventListener("touchstart", onTS);
      canvas.removeEventListener("touchmove", onTM);
      canvas.removeEventListener("touchend", onTE);
      canvas.removeEventListener("mousedown", onMD);
      canvas.removeEventListener("mousemove", onMM);
      canvas.removeEventListener("mouseup", onMU);
      canvas.removeEventListener("mouseleave", onMU);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: isTraitor ? "#dc2626" : "#1d4ed8" }}
    >
      {/* Role content visible underneath the scratch layer */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-white text-center pointer-events-none select-none">
        <p className="text-sm uppercase tracking-widest opacity-60">{t.at_role_label}</p>
        <p className="text-7xl font-black tracking-wider">
          {isTraitor ? t.at_role_traitor : t.at_role_agent}
        </p>
        <p className="text-sm opacity-80 max-w-xs leading-relaxed">
          {isTraitor ? t.at_role_hint_traitor : t.at_role_hint_agent}
        </p>
        {isTraitor && fellowTraitors.length > 0 && (
          <div className="bg-white/20 rounded-2xl p-4 w-full max-w-xs text-left mt-2">
            <p className="text-xs uppercase tracking-widest opacity-60 mb-2">{t.at_fellow_traitors}</p>
            {fellowTraitors.map((fp) => (
              <p key={fp.code} className="font-bold text-xl">{fp.name}</p>
            ))}
          </div>
        )}
      </div>
      {/* Canvas scratch layer */}
      {!showContinue ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: "none", cursor: "crosshair" }}
        />
      ) : (
        <div className="absolute bottom-12 inset-x-0 flex flex-col items-center gap-3 px-8 pointer-events-auto">
          <p className="text-white/70 text-sm text-center max-w-xs">{t.at_scratch_memorize}</p>
          <button
            onClick={onDone}
            className="bg-white text-gray-900 rounded-2xl px-10 py-4 text-xl font-black active:scale-95 transition shadow-2xl"
          >
            {t.at_scratch_done}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const color = value > 65 ? "#22c55e" : value > 35 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full bg-gray-200 rounded-full h-5 relative overflow-hidden">
      <div
        className="h-5 rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
        {value}%
      </span>
    </div>
  );
}

// ─── Main hub page ────────────────────────────────────────────────────────────

function ATHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";
  const room = searchParams.get("room") ?? "";
  const { t } = useLang();

  const [state, setState] = useState<GameState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scratchDone, setScratchDone] = useState(false);
  const [peeking, setPeeking] = useState(false);

  // UI state
  const [accuseTarget, setAccuseTarget] = useState<string | null>(null);
  const [ghostAction, setGhostAction] = useState<ATGhostActionType | null>(null);
  const [ghostTarget, setGhostTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState("");
  const [flash, setFlash] = useState("");

  // Check sessionStorage to skip scratch card if already done this session
  useEffect(() => {
    if (!room || !code) return;
    if (sessionStorage.getItem(`at_scratched_${room}_${code}`) === "1") {
      setScratchDone(true);
    }
  }, [room, code]);

  function markScratchDone() {
    sessionStorage.setItem(`at_scratched_${room}_${code}`, "1");
    setScratchDone(true);
  }

  function handlePeek() {
    setPeeking(true);
    setTimeout(() => setPeeking(false), 4000);
  }

  // Subscribe to room state
  useEffect(() => {
    if (!room) return;
    const unsub = subscribeRoom(room, (s) => {
      setState(s);
      const p = getPlayerByCode(s, code);
      setPlayer(p ?? null);
    });
    return () => unsub();
  }, [room, code]);

  // Clock tick — 1 s for countdown display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Game tick — 2 s: process match queue, advance trial, apply decay
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => { tickATRoom(room); }, 2000);
    return () => clearInterval(interval);
  }, [room]);

  // Redirect to join page if room becomes "finished"
  useEffect(() => {
    if (state?.status === "finished" && !state.winnerSide) {
      const id = setTimeout(() => router.push(`/join?room=${room}`), 3000);
      return () => clearTimeout(id);
    }
  }, [state?.status, state?.winnerSide, room, router]);

  if (!state || !player) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t.at_loading}</p>
      </main>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const accent = state.accentColor ?? "#000000";
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const role = player.role ?? "agent";
  const isGhost = player.isGhost ?? false;
  const isAlive = player.alive ?? true;
  const visualProgress = computeATVisualProgress(state, now);

  const alivePlayers = state.players.filter((p) => p.alive && p.code !== code);
  const revealedRoles = state.revealedRoles ?? {};
  const fellowTraitors =
    role === "traitor"
      ? state.players.filter((p) => p.role === "traitor" && p.code !== code)
      : [];

  const trial = state.trial ?? null;
  const trialTarget = trial ? state.players.find((p) => p.code === trial.targetCode) : null;
  const trialPhaseEnd = trial ? trial.startedAt + trial.durationSecs * 1000 : 0;
  const trialSecsLeft = Math.max(0, Math.ceil((trialPhaseEnd - now) / 1000));
  const myVote = trial?.votes[code];

  const ghostCooldownMs = config.ghostCooldownSecs * 1000;
  const ghostReady = (player.lastGhostActionAt ?? 0) + ghostCooldownMs <= now;
  const ghostSecsLeft = Math.max(
    0,
    Math.ceil(((player.lastGhostActionAt ?? 0) + ghostCooldownMs - now) / 1000)
  );

  const ghostLog = (state.ghostLog ?? []).slice(-4).reverse();
  const isDisrupted = (state.disruptedUntil ?? 0) > now;
  const disruptSecsLeft = Math.max(0, Math.ceil(((state.disruptedUntil ?? 0) - now) / 1000));
  const imAccused = (player.suspicionVoters?.length ?? 0) > 0;
  const amOnTrial = trial?.targetCode === code && trial.phase !== "resolved";

  // ── Handlers ────────────────────────────────────────────────────────────────

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  }

  async function handleAccuse(targetCode: string) {
    setLoading("accuse");
    const result = await accuseATPlayerInRoom(room, code, targetCode);
    setLoading("");
    setAccuseTarget(null);
    if (!result.success) {
      showFlash(result.error === "invalid" ? t.at_already_accused : t.at_cannot_accuse_protected);
    }
  }

  async function handleVote(verdict: "guilty" | "innocent") {
    if (loading) return;
    setLoading("vote");
    await voteATTrialInRoom(room, code, verdict);
    setLoading("");
  }

  async function handleGhostAction() {
    if (!ghostAction || !ghostReady) return;
    const needsTarget =
      ghostAction === "agent_protect" ||
      ghostAction === "traitor_plant";
    if (needsTarget && !ghostTarget) return;
    setLoading("ghost");
    const result = await useATGhostActionInRoom(room, code, ghostAction, ghostTarget ?? undefined);
    setLoading("");
    setGhostAction(null);
    setGhostTarget(null);
    if (!result.success) showFlash("Erreur.");
    else showFlash("✅ Action accomplie !");
  }

  // ── Scratch card gate ────────────────────────────────────────────────────────
  if (!scratchDone) {
    return (
      <>
        <main className="min-h-screen" />
        <ScratchCardScreen
          player={player}
          fellowTraitors={fellowTraitors}
          t={t}
          onDone={markScratchDone}
        />
      </>
    );
  }

  // ── Game over screen ────────────────────────────────────────────────────────
  if (state.winnerSide) {
    const agentsWon = state.winnerSide === "agents";
    const traitors = state.players.filter((p) => p.role === "traitor");
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="text-7xl">{agentsWon ? "🎉" : "🦹"}</div>
        <h1 className="text-4xl font-bold">
          {agentsWon ? t.at_winner_agents : t.at_winner_traitors}
        </h1>
        <p className="text-sm text-gray-500">
          {t.at_role_label} : <strong>{role === "traitor" ? t.at_role_traitor : t.at_role_agent}</strong>
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 w-full max-w-xs text-left">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">
            {t.at_traitors_revealed}
          </p>
          {traitors.map((p) => (
            <p key={p.code} className="font-semibold text-red-600">
              {p.name} {!p.alive ? "⚰️" : ""}
            </p>
          ))}
        </div>
        <Link
          href={`/join?room=${room}`}
          className="text-white rounded-lg px-6 py-3 font-semibold active:scale-95 transition"
          style={{ backgroundColor: accent }}
        >
          Rejouer
        </Link>
      </main>
    );
  }

  // ── Ghost view ──────────────────────────────────────────────────────────────
  if (isGhost) {
    const agentGhostActions: ATGhostActionType[] = ["agent_boost", "agent_reveal", "agent_protect"];
    const traitorGhostActions: ATGhostActionType[] = [
      "traitor_sabotage",
      "traitor_plant",
      "traitor_disrupt",
    ];
    const availableActions = role === "agent" ? agentGhostActions : traitorGhostActions;
    const actionLabels: Record<ATGhostActionType, string> = {
      agent_boost: t.at_ghost_boost,
      agent_reveal: t.at_ghost_reveal,
      agent_protect: t.at_ghost_protect,
      traitor_sabotage: t.at_ghost_sabotage,
      traitor_plant: t.at_ghost_plant,
      traitor_disrupt: t.at_ghost_disrupt,
    };
    const needsTarget = (a: ATGhostActionType) =>
      a === "agent_protect" || a === "traitor_plant";

    return (
      <main className="min-h-screen flex flex-col gap-6 p-6 max-w-md mx-auto">
        {/* Ghost header */}
        <div
          className="rounded-2xl p-5 flex flex-col items-center gap-2 text-white opacity-80"
          style={{ backgroundColor: role === "agent" ? "#3b82f6" : "#ef4444" }}
        >
          <p className="text-xs uppercase tracking-widest opacity-70">{t.at_you_are_ghost}</p>
          <p className="text-3xl font-bold">👻 {player.name}</p>
          <p className="text-sm opacity-70">
            {role === "agent" ? t.at_role_agent : t.at_role_traitor}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">{t.at_progress_label}</p>
          <ProgressBar value={visualProgress} />
          <p className="text-xs text-gray-400 text-center">{t.at_progress_target}</p>
        </div>

        {isDisrupted && (
          <div className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-2 text-sm text-center">
            {t.at_disrupted_banner} ({disruptSecsLeft}s)
          </div>
        )}

        {/* Ghost actions */}
        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.at_ghost_title}</h2>
            {ghostReady ? (
              <span className="text-xs text-green-600 font-semibold">{t.at_ghost_ready}</span>
            ) : (
              <span className="text-xs text-gray-400">
                {t.at_ghost_cooldown} {ghostSecsLeft}s
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 italic">{t.at_ghost_hint}</p>

          {/* Action selector */}
          <div className="flex flex-col gap-2">
            {availableActions.map((a) => (
              <button
                key={a}
                onClick={() => { setGhostAction(a); setGhostTarget(null); }}
                disabled={!ghostReady}
                className={`rounded-xl py-3 px-4 text-sm font-semibold text-left transition active:scale-95 ${
                  ghostAction === a
                    ? "ring-2 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-40`}
                style={ghostAction === a ? { backgroundColor: accent } : {}}
              >
                {actionLabels[a]}
              </button>
            ))}
          </div>

          {/* Target selection for actions that need it */}
          {ghostAction && needsTarget(ghostAction) && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">{t.at_ghost_select_target}</p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {alivePlayers.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => setGhostTarget(p.code)}
                    className={`rounded-lg py-2 px-3 text-sm font-medium text-left transition ${
                      ghostTarget === p.code
                        ? "text-white"
                        : "bg-white border text-gray-700 hover:bg-gray-50"
                    }`}
                    style={ghostTarget === p.code ? { backgroundColor: accent } : {}}
                  >
                    {p.name}
                    {revealedRoles[p.code] && (
                      <span className="ml-2 text-xs opacity-70">
                        ({revealedRoles[p.code] === "traitor" ? "TRAÎTRE" : "AGENT"})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ghostAction && (
            <div className="flex gap-3">
              <button
                onClick={handleGhostAction}
                disabled={
                  !ghostReady ||
                  loading === "ghost" ||
                  (needsTarget(ghostAction) && !ghostTarget)
                }
                className="flex-1 text-white rounded-xl py-3 font-bold active:scale-95 transition disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {loading === "ghost" ? "…" : t.at_ghost_confirm}
              </button>
              <button
                onClick={() => { setGhostAction(null); setGhostTarget(null); }}
                className="bg-gray-100 text-gray-600 rounded-xl px-4 py-3 font-semibold"
              >
                {t.at_ghost_cancel}
              </button>
            </div>
          )}
        </div>

        {/* Ghost log */}
        {ghostLog.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest">{t.at_ghost_log_title}</p>
            {ghostLog.map((entry) => (
              <p key={entry.id} className={`text-sm italic ${
                entry.actorCode === code ? "text-indigo-600 font-semibold" : "text-gray-500"
              }`}>
                {entry.actorCode === code && entry.privateMessage
                  ? entry.privateMessage
                  : entry.publicMessage}
              </p>
            ))}
          </div>
        )}
      </main>
    );
  }

  // ── Alive player view ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col gap-6 p-6 max-w-md mx-auto pb-16">
      {/* Flash message */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg">
          {flash}
        </div>
      )}

      {/* Peek overlay — tappable, auto-dismisses in 4s */}
      {peeking && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 p-8 text-white text-center"
          style={{ backgroundColor: role === "agent" ? "#1d4ed8ee" : "#dc2626ee" }}
          onClick={() => setPeeking(false)}
        >
          <p className="text-sm uppercase tracking-widest opacity-60">{t.at_role_label}</p>
          <p className="text-7xl font-black tracking-wider">
            {role === "agent" ? t.at_role_agent : t.at_role_traitor}
          </p>
          {fellowTraitors.length > 0 && (
            <div className="bg-white/20 rounded-2xl p-4 w-full max-w-xs text-left">
              <p className="text-xs uppercase tracking-widest opacity-60 mb-2">{t.at_fellow_traitors}</p>
              {fellowTraitors.map((p) => (
                <p key={p.code} className="font-bold text-xl">{p.name}</p>
              ))}
            </div>
          )}
          <p className="text-sm opacity-50 mt-4">Appuyez pour masquer</p>
        </div>
      )}

      {/* Discreet header — name + peek button */}
      <div className="flex items-center justify-between">
        <p className="font-bold text-lg">{player.name}</p>
        <button
          onClick={handlePeek}
          className="text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          {t.at_peek_role}
        </button>
      </div>

      {/* Player code + QR */}
      <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Ton code</p>
        <p className="text-5xl font-mono font-bold tracking-widest text-gray-900">{code}</p>
        <QRCodeSVG value={code} size={120} fgColor={accent} />
        <p className="text-xs text-gray-400 text-center">Montre ce QR aux autres joueurs</p>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400 uppercase tracking-widest">{t.at_progress_label}</p>
        <ProgressBar value={visualProgress} />
        <p className="text-xs text-gray-400 text-center">{t.at_progress_target}</p>
      </div>

      {/* Disruption banner */}
      {isDisrupted && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-2 text-sm text-center font-semibold">
          {t.at_disrupted_banner} ({disruptSecsLeft}s)
        </div>
      )}

      {/* Suspicion meter — only show if someone voted against me */}
      {imAccused && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 text-center">
          ⚠️ {player.suspicionVoters?.length ?? 0} {t.at_suspicion_votes} contre toi !
        </div>
      )}

      {/* Scan button */}
      <Link
        href={`/find?myCode=${code}&room=${room}`}
        className="flex items-center justify-center gap-2 text-white rounded-xl px-6 py-4 text-lg font-semibold active:scale-95 transition"
        style={{ backgroundColor: accent }}
      >
        {t.at_scan_btn}
      </Link>

      {/* ── Trial overlay ─────────────────────────────────────────────────── */}
      {trial && trial.phase !== "resolved" && (
        <div className="border-2 border-yellow-400 rounded-2xl p-5 flex flex-col gap-4 bg-yellow-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-yellow-800">{t.at_trial_banner}</h2>
            <span className="text-2xl font-mono font-bold text-yellow-700">{trialSecsLeft}s</span>
          </div>
          <p className="text-sm text-yellow-700">
            {t.at_trial_defendant}{" "}
            <span className="font-bold">{trialTarget?.name}</span>
          </p>

          {trial.phase === "defense" && (
            <>
              <p className="text-sm text-yellow-600 font-semibold">{t.at_trial_defense_phase}</p>
              {amOnTrial && (
                <p className="text-sm bg-yellow-100 rounded-lg p-3 text-yellow-800">
                  {t.at_trial_defense_hint}
                </p>
              )}
            </>
          )}

          {trial.phase === "voting" && (
            <>
              <p className="text-sm font-bold text-yellow-700">{t.at_trial_voting_phase}</p>
              {myVote ? (
                <p className="text-sm text-center">
                  {t.at_my_vote}{" "}
                  <span className="font-bold">
                    {myVote === "guilty" ? t.at_vote_guilty : t.at_vote_innocent}
                  </span>
                </p>
              ) : (
                trial.targetCode !== code && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleVote("guilty")}
                      disabled={loading === "vote"}
                      className="flex-1 bg-red-500 text-white rounded-xl py-3 font-bold active:scale-95 transition disabled:opacity-50"
                    >
                      {t.at_vote_guilty}
                    </button>
                    <button
                      onClick={() => handleVote("innocent")}
                      disabled={loading === "vote"}
                      className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold active:scale-95 transition disabled:opacity-50"
                    >
                      {t.at_vote_innocent}
                    </button>
                  </div>
                )
              )}
              <p className="text-xs text-yellow-500 text-center">
                {Object.keys(trial.votes).length} vote(s) enregistré(s)
              </p>
            </>
          )}
        </div>
      )}

      {/* Trial resolved banner */}
      {trial?.phase === "resolved" && (
        <div
          className={`rounded-2xl p-4 text-center font-bold ${
            trial.outcome === "eliminated"
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {trialTarget?.name} :{" "}
          {trial.outcome === "eliminated"
            ? t.at_trial_resolved_eliminated
            : t.at_trial_resolved_acquitted}
          {trial.outcome === "eliminated" && revealedRoles[trial.targetCode] && (
            <p className="text-sm font-normal mt-1 opacity-70">
              {t.at_revealed_role} :{" "}
              {revealedRoles[trial.targetCode] === "traitor" ? "TRAÎTRE" : "AGENT"}
            </p>
          )}
        </div>
      )}

      {/* ── Accusation panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-700">{t.at_accuse_title}</h2>
        <p className="text-xs text-gray-400">{t.at_accuse_hint}</p>
        {alivePlayers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun autre joueur en vie.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {alivePlayers.map((p) => {
              const votes = p.suspicionVoters?.filter((v) => !v.startsWith("__ghost_")).length ?? 0;
              const totalVotes = p.suspicionVoters?.length ?? 0;
              const aliveCount = state.players.filter((pl) => pl.alive).length;
              const config2 = state.atConfig ?? DEFAULT_AT_CONFIG;
              const needed = Math.max(2, Math.ceil(aliveCount * config2.trialThresholdPct));
              const isProtected = (p.protectedUntil ?? 0) > now;
              const iAlreadyAccused = p.suspicionVoters?.includes(code) ?? false;
              return (
                <div
                  key={p.code}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {totalVotes > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="flex gap-0.5">
                            {Array.from({ length: needed }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${i < totalVotes ? "bg-red-400" : "bg-gray-200"}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {totalVotes}/{needed}
                          </span>
                        </div>
                      )}
                      {isProtected && (
                        <span className="text-xs text-blue-500">{t.at_protected}</span>
                      )}
                      {revealedRoles[p.code] && (
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            revealedRoles[p.code] === "traitor"
                              ? "bg-red-100 text-red-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {revealedRoles[p.code] === "traitor" ? "TRAÎTRE" : "AGENT"}
                        </span>
                      )}
                    </div>
                  </div>
                  {accuseTarget === p.code ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccuse(p.code)}
                        disabled={loading === "accuse"}
                        className="bg-red-500 text-white text-xs font-bold rounded-lg px-3 py-1.5 active:scale-95 transition"
                      >
                        {loading === "accuse" ? "…" : t.at_accuse_confirm}
                      </button>
                      <button
                        onClick={() => setAccuseTarget(null)}
                        className="bg-gray-200 text-gray-600 text-xs rounded-lg px-3 py-1.5"
                      >
                        {t.at_accuse_cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (iAlreadyAccused) { showFlash(t.at_already_accused); return; }
                        if (isProtected) { showFlash(t.at_cannot_accuse_protected); return; }
                        if (trial && trial.phase !== "resolved") return;
                        setAccuseTarget(p.code);
                      }}
                      disabled={iAlreadyAccused || isProtected || (!!trial && trial.phase !== "resolved")}
                      className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-30"
                    >
                      {t.at_accuse_confirm}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ghost log */}
      {ghostLog.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">{t.at_ghost_log_title}</p>
          {ghostLog.map((entry) => (
            <p key={entry.id} className={`text-sm italic ${
              entry.actorCode === code ? "text-indigo-600 font-semibold" : "text-gray-500"
            }`}>
              {entry.actorCode === code && entry.privateMessage
                ? entry.privateMessage
                : entry.publicMessage}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
