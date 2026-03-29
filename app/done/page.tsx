"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadRoom } from "@/app/lib/db";

export default function DonePage() {
  return (
    <Suspense>
      <DoneInner />
    </Suspense>
  );
}

function DoneInner() {
  const searchParams = useSearchParams();
  const myCode = searchParams.get("myCode") ?? "";
  const theirName = searchParams.get("theirName") ?? "";
  const room = searchParams.get("room") ?? "";
  const [accent, setAccent] = useState("#000000");

  useEffect(() => {
    if (room) loadRoom(room).then((s) => { if (s) setAccent(s.accentColor ?? "#000000"); });
  }, [room]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="text-7xl">🎉</div>
      <h1 className="text-4xl font-bold">Bravo !</h1>
      <p className="text-xl text-gray-600">
        {theirName
          ? `Tu as trouvé ta moitié : ${theirName} !`
          : "Vous êtes une paire parfaite !"}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
        {myCode && (
          <Link
            href={`/mission?code=${myCode}&room=${room}`}
            className="text-white rounded-lg px-4 py-3 text-base font-semibold active:scale-95 transition"
            style={{ backgroundColor: accent }}
          >
            Revoir ma mission
          </Link>
        )}
        <Link
          href={room ? `/join?room=${room}` : "/"}
          className="bg-gray-100 text-gray-700 rounded-lg px-4 py-3 text-base font-semibold hover:bg-gray-200 active:scale-95 transition"
        >
          Nouvelle partie
        </Link>
      </div>
    </main>
  );
}