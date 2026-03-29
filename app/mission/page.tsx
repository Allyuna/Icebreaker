"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { loadRoom } from "@/app/lib/db";
import {
  getPlayerByCode,
  getMotieWord,
  type Player,
} from "@/app/lib/store";

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
  const [player, setPlayer] = useState<Player | null>(null);
  const [motieWord, setMotieWord] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code || !room) { setNotFound(true); return; }
    loadRoom(room).then((state) => {
      if (!state) { setNotFound(true); return; }
      const p = getPlayerByCode(state, code);
      if (!p) { setNotFound(true); return; }
      setPlayer(p);
      setMotieWord(getMotieWord(state, p));
      setAccent(state.accentColor ?? "#000000");
    });
  }, [code, room]);

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-500">
          Code introuvable.{" "}
          <Link href={room ? `/join?room=${room}` : "/"} className="underline">
            Recommencer
          </Link>
          .
        </p>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-400">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">Bonjour</p>
        <h1 className="text-4xl font-bold">{player.name}</h1>
      </div>

      {/* Player's own code + QR */}
      <div className="flex flex-col items-center gap-3 bg-gray-50 rounded-2xl p-6 w-full max-w-xs">
        <p className="text-sm text-gray-500 uppercase tracking-widest">Ton code</p>
        <p className="text-5xl font-mono font-bold tracking-widest">{player.code}</p>
        <QRCodeSVG value={player.code} size={140} fgColor={accent} />
        <p className="text-xs text-gray-400 text-center">
          Montre ce QR code aux autres joueurs ou donne-leur ton code à 4 chiffres.
        </p>
      </div>

      {/* Moitié clue */}
      <div
        className="flex flex-col items-center gap-2 rounded-2xl p-6 w-full max-w-xs text-white"
        style={{ backgroundColor: accent }}
      >
        <p className="text-sm uppercase tracking-widest opacity-60">Ta moitié</p>
        <p className="text-4xl font-bold">{motieWord}</p>
        <p className="text-sm opacity-70 text-center">
          Trouve la personne dont la moitié complète la tienne !
        </p>
      </div>

      {player.matched ? (
        <div className="text-center text-green-600 font-semibold text-lg">
          🎉 Tu as déjà trouvé ta moitié !
        </div>
      ) : (
        <Link
          href={`/find?myCode=${player.code}&room=${room}`}
          className="text-white rounded-lg px-8 py-3 text-lg font-semibold active:scale-95 transition"
          style={{ backgroundColor: accent }}
        >
          J&apos;ai trouvé ma moitié →
        </Link>
      )}
    </main>
  );
}