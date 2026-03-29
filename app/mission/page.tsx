"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { subscribeRoom } from "@/app/lib/db";
import { getPlayerByCode, getMotieWord, type Player } from "@/app/lib/store";
import { useLang } from "@/app/lib/LangContext";

export default function MissionPage() {
  return (
    <Suspense>
      <MissionInner />
    </Suspense>
  );
}

function MissionInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const room = searchParams.get("room") ?? "";
  const { t } = useLang();

  const [player, setPlayer] = useState<Player | null>(null);
  const [motieWord, setMotieWord] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code || !room) { setNotFound(true); return; }
    // Real-time: updates instantly when partner joins or match is confirmed
    const unsub = subscribeRoom(room, (state) => {
      const p = getPlayerByCode(state, code);
      if (!p) { setNotFound(true); return; }
      setPlayer(p);
      setMotieWord(getMotieWord(state, p));
      setAccent(state.accentColor ?? "#000000");
    });
    return () => unsub();
  }, [code, room]);

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-500">
          {t.mission_notfound}{" "}
          <Link href={room ? `/join?room=${room}` : "/"} className="underline">
            {t.mission_restart}
          </Link>
          .
        </p>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-400">{t.mission_loading}</p>
      </main>
    );
  }

  const hasPartner = player.partnerCode !== "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">{t.mission_hello}</p>
        <h1 className="text-4xl font-bold">{player.name}</h1>
      </div>

      {/* Player code + QR — white bg + explicit dark text so it is always readable on Android */}
      <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-6 w-full max-w-xs shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 uppercase tracking-widest">{t.mission_yourcode}</p>
        <p className="text-5xl font-mono font-bold tracking-widest text-gray-900">{player.code}</p>
        <QRCodeSVG value={player.code} size={140} fgColor={accent} />
        <p className="text-xs text-gray-400 text-center">{t.mission_qr_hint}</p>
      </div>

      {/* Moitie clue */}
      <div
        className="flex flex-col items-center gap-2 rounded-2xl p-6 w-full max-w-xs text-white"
        style={{ backgroundColor: accent }}
      >
        <p className="text-sm uppercase tracking-widest opacity-60">{t.mission_yourhalf}</p>
        <p className="text-4xl font-bold">{motieWord}</p>
        <p className="text-sm opacity-70 text-center">{t.mission_find_hint}</p>
      </div>

      {player.matched ? (
        <div className="text-center text-green-600 font-semibold text-lg">
          {t.mission_matched}
        </div>
      ) : !hasPartner ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-amber-600 font-semibold">{t.mission_waiting_partner}</p>
          <p className="text-xs text-gray-400 max-w-xs">{t.mission_waiting_partner_sub}</p>
        </div>
      ) : (
        <Link
          href={`/find?myCode=${player.code}&room=${room}`}
          className="text-white rounded-lg px-8 py-3 text-lg font-semibold active:scale-95 transition"
          style={{ backgroundColor: accent }}
        >
          {t.mission_find_btn}
        </Link>
      )}
    </main>
  );
}