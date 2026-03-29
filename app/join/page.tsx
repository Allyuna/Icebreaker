"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadRoom, saveRoom } from "@/app/lib/db";
import { registerPlayer } from "@/app/lib/store";

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

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

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!room) {
      setError("Code de salle manquant. Utilise le lien fourni par le maitre du jeu.");
      return;
    }

    setLoading(true);
    try {
      const state = await withTimeout(loadRoom(room));

      if (!state) {
        setError("Partie introuvable. Verifie le code de salle.");
        return;
      }

      if (state.status === "waiting") {
        setError("La partie n'a pas encore commence. Attends le signal du maitre du jeu !");
        return;
      }

      const { state: newState, player } = registerPlayer(state, trimmed);

      if (!player) {
        setError("Plus de places disponibles. Contacte le maitre du jeu.");
        return;
      }

      await withTimeout(saveRoom(room, newState));
      router.push(`/mission?code=${player.code}&room=${room}`);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      setError(
        isTimeout
          ? "Impossible de contacter le serveur. Verifie ta connexion Wi-Fi."
          : "Une erreur s'est produite. Reessaie."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Rejoins le jeu</h1>
      <p className="text-gray-500">Entre ton prenom pour commencer.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="Ton prenom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-black"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded-lg px-4 py-3 text-lg font-semibold active:scale-95 transition disabled:opacity-50"
        >
          {loading ? "Inscription..." : "Commencer"}
        </button>
      </form>
    </main>
  );
}
