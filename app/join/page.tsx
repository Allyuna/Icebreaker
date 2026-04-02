"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registerPlayerInRoom, subscribeRoom } from "@/app/lib/db";
import { useLang } from "@/app/lib/LangContext";

export default function Join() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const room = searchParams.get("room") ?? "";
  const { t } = useLang();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState<"unknown" | "waiting" | "playing" | "finished">("unknown");
  const [isPending, setIsPendingState] = useState(false);

  // Refs so the subscribeRoom callback always reads fresh values
  const nameRef = useRef("");
  const isPendingRef = useRef(false);
  useEffect(() => { nameRef.current = name; }, [name]);
  function setIsPending(val: boolean) {
    isPendingRef.current = val;
    setIsPendingState(val);
  }

  async function doRegister(playerName: string) {
    setLoading(true);
    setError("");
    try {
      const { player, gameMode, error: err } = await registerPlayerInRoom(room, playerName);
      if (!player) {
        if (err === "not_found") setError(t.join_err_notfound);
        else if (err === "not_playing") setError(t.join_err_notplaying);
        else if (err === "no_slots") setError(t.join_err_noslots);
        else setError(t.join_err_generic);
        setIsPending(false);
        return;
      }
      const hubPath =
        gameMode === "agents-traitors"
          ? `/at/hub?code=${player.code}&room=${room}`
          : `/mission?code=${player.code}&room=${room}`;
      router.push(hubPath);
    } catch {
      setError(t.join_err_network);
      setIsPending(false);
    } finally {
      setLoading(false);
    }
  }

  // Single subscription — auto-registers when admin launches if player pre-registered
  useEffect(() => {
    if (!room) return;
    const unsub = subscribeRoom(room, (state) => {
      setGameStatus(state.status);
      if (state.status === "playing" && isPendingRef.current) {
        setIsPending(false);
        doRegister(nameRef.current);
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!room) { setError(t.join_err_noroom); return; }
    if (gameStatus === "finished") { setError(t.join_err_finished); return; }
    if (gameStatus === "waiting") {
      setIsPending(true);
      setError("");
      return;
    }
    await doRegister(trimmed);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">{t.join_title}</h1>
      <p className="text-gray-500">{t.join_sub}</p>

      {gameStatus === "waiting" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm text-center w-full max-w-xs">
          {t.join_waiting_banner}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder={t.join_placeholder}
          value={name}
          onChange={(e) => { setName(e.target.value); if (isPending) setIsPending(false); }}
          className="border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black"
          autoFocus
          disabled={isPending || loading}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || isPending || !name.trim()}
          className="bg-black text-white rounded-lg px-4 py-3 text-lg font-semibold active:scale-95 transition disabled:opacity-50"
        >
          {loading
            ? t.join_btn_loading
            : isPending
            ? t.join_btn_pending
            : gameStatus === "waiting"
            ? t.join_btn_preinscribe
            : t.join_btn_start}
        </button>
        {isPending && (
          <button
            type="button"
            onClick={() => setIsPending(false)}
            className="text-xs text-gray-400 underline text-center"
          >
            {t.join_cancel}
          </button>
        )}
      </form>
    </main>
  );
}