"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError("Entre le code de la salle."); return; }
    router.push(`/join?room=${code}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <h1 className="text-5xl font-bold">Trouve ta moitié</h1>
        <p className="text-gray-500 mt-3 text-lg">Le jeu de brise-glace — retrouve ta moitié !</p>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Code de la salle (ex: AB3KP)"
          value={roomCode}
          onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(""); }}
          maxLength={5}
          className="border-2 rounded-xl px-4 py-3 text-xl font-mono text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-black"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-black text-white rounded-xl px-8 py-4 text-xl font-semibold active:scale-95 transition"
        >
          Rejoindre la partie
        </button>
      </form>

      <Link href="/admin" className="text-sm text-gray-400 underline">
        Accès maître du jeu
      </Link>
    </main>
  );
}