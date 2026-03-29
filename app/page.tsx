"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/app/lib/LangContext";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { t, toggleLang } = useLang();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError(t.landing_err_code); return; }
    router.push(`/join?room=${code}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-center relative">
      {/* Language toggle — top right */}
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition"
      >
        {t.lang_toggle}
      </button>

      <div>
        <h1 className="text-5xl font-bold">{t.landing_title}</h1>
        <p className="text-gray-500 mt-3 text-lg">{t.landing_sub}</p>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder={t.landing_placeholder}
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
          {t.landing_join}
        </button>
      </form>

      <Link href="/admin" className="text-sm text-gray-400 underline">
        {t.landing_admin}
      </Link>
    </main>
  );
}