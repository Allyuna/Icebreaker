"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { loadRoom, saveRoom } from "@/app/lib/db";
import { queueATMatchInRoom } from "@/app/lib/db";
import {
  getPlayerByCode,
  getMotieWord,
  confirmMatch,
  type Player,
} from "@/app/lib/store";
import { useLang } from "@/app/lib/LangContext";

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}

function ConfirmInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const myCode = searchParams.get("myCode") ?? "";
  const theirCode = searchParams.get("theirCode") ?? "";
  const room = searchParams.get("room") ?? "";
  const { t } = useLang();

  const [me, setMe] = useState<Player | null>(null);
  const [them, setThem] = useState<Player | null>(null);
  const [myWord, setMyWord] = useState("");
  const [theirWord, setTheirWord] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [gameMode, setGameMode] = useState("its-a-match");
  const [notFound, setNotFound] = useState(false);
  const [wrongMatch, setWrongMatch] = useState(false);
  const [atError, setAtError] = useState("");

  useEffect(() => {
    if (!room) { setNotFound(true); return; }
    loadRoom(room).then((state) => {
      if (!state) { setNotFound(true); return; }
      const mePlayer = getPlayerByCode(state, myCode);
      const themPlayer = getPlayerByCode(state, theirCode);
      if (!mePlayer || !themPlayer) { setNotFound(true); return; }
      setMe(mePlayer);
      setThem(themPlayer);
      setGameMode(state.gameMode ?? "its-a-match");
      setMyWord(getMotieWord(state, mePlayer));
      setTheirWord(getMotieWord(state, themPlayer));
      setAccent(state.accentColor ?? "#000000");
    });
  }, [myCode, theirCode, room]);

  async function handleYes() {
    if (!me) return;

    // ── Agents & Traitors: queue the scan event ───────────────────────────────
    if (gameMode === "agents-traitors") {
      if (!them?.alive) {
        setAtError(t.at_confirm_dead);
        return;
      }
      const result = await queueATMatchInRoom(room, myCode, theirCode);
      if (!result.success) {
        if (result.error === "cooldown") setAtError(t.at_confirm_cooldown);
        else if (result.error === "player_not_alive") setAtError(t.at_confirm_dead);
        else setAtError(t.at_confirm_cooldown);
        return;
      }
      router.push(`/at/hub?code=${myCode}&room=${room}`);
      return;
    }

    // ── It's a Match: pair confirmation ──────────────────────────────────────
    const isCorrect = me.partnerCode === theirCode;
    if (!isCorrect) {
      setWrongMatch(true);
      return;
    }
    const state = await loadRoom(room);
    if (!state) return;
    const newState = confirmMatch(state, myCode, theirCode);
    await saveRoom(room, newState);
    router.push(`/done?myCode=${myCode}&theirName=${them?.name ?? ""}&room=${room}`);
  }

  function handleNo() {
    router.push(`/find?myCode=${myCode}&room=${room}`);
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-500">{t.confirm_notfound}</p>
        <Link href={`/find?myCode=${myCode}&room=${room}`} className="underline text-sm">
          {t.confirm_retry}
        </Link>
      </main>
    );
  }

  if (!me || !them) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-400">{t.confirm_loading}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-3xl font-bold text-center">
        {gameMode === "agents-traitors" ? t.at_confirm_title : t.confirm_title}
      </h1>

      {/* ── Agents & Traitors scan confirmation ────────────────────────────── */}
      {gameMode === "agents-traitors" ? (
        <>
          <div className="flex flex-col items-center gap-3 bg-gray-50 rounded-2xl p-6 w-full max-w-xs">
            <p className="text-sm text-gray-400 uppercase tracking-widest">{t.at_confirm_scanning}</p>
            <p className="text-3xl font-bold">{them?.name}</p>
            <p className="font-mono text-gray-400 text-sm">#{theirCode}</p>
          </div>

          {atError && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm text-center w-full max-w-xs">
              {atError}
            </div>
          )}

          <div className="flex gap-4 w-full max-w-xs">
            <button
              onClick={handleYes}
              className="flex-1 bg-green-500 text-white rounded-xl py-4 text-lg font-bold hover:bg-green-600 active:scale-95 transition"
            >
              {t.at_confirm_btn}
            </button>
            <button
              onClick={handleNo}
              className="flex-1 bg-red-100 text-red-600 rounded-xl py-4 text-lg font-bold hover:bg-red-200 active:scale-95 transition"
            >
              {t.at_confirm_cancel}
            </button>
          </div>

          <Link href={`/find?myCode=${myCode}&room=${room}`} className="text-sm text-gray-400 underline">
            {t.confirm_back}
          </Link>
        </>
      ) : (
        /* ── It's a Match pair confirmation ────────────────────────────────── */
        <>
          <div className="flex gap-4 w-full max-w-sm">
            <div className="flex-1 flex flex-col items-center gap-1 bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{t.confirm_you}</p>
              <p className="font-bold text-lg">{me?.name}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: accent }}>{myWord}</p>
            </div>
            <div className="flex items-center justify-center text-3xl text-gray-300">+</div>
            <div className="flex-1 flex flex-col items-center gap-1 bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{t.confirm_them}</p>
              <p className="font-bold text-lg">{them?.name}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: accent }}>{theirWord}</p>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm">{t.confirm_question}</p>

          {wrongMatch && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm text-center w-full max-w-xs">
              {t.confirm_wrong}
            </div>
          )}

          <div className="flex gap-4 w-full max-w-xs">
            <button
              onClick={handleYes}
              className="flex-1 bg-green-500 text-white rounded-xl py-4 text-xl font-bold hover:bg-green-600 active:scale-95 transition"
            >
              {t.confirm_yes}
            </button>
            <button
              onClick={handleNo}
              className="flex-1 bg-red-100 text-red-600 rounded-xl py-4 text-xl font-bold hover:bg-red-200 active:scale-95 transition"
            >
              {t.confirm_no}
            </button>
          </div>

          <Link href={`/mission?code=${myCode}&room=${room}`} className="text-sm text-gray-400 underline">
            {t.confirm_back}
          </Link>
        </>
      )}
    </main>
  );
}

