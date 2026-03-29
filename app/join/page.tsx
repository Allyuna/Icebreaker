"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registerPlayerInRoom, subscribeRoom } from "@/app/lib/db";

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
      const { player, error: err } = await registerPlayerInRoom(room, playerName);
      if (!player) {
        if (err === "not_found") setError("Partie introuvable. V\u00e9rifie le code de salle.");
        else if (err === "not_playing") setError("La partie n'a pas encore commenc\u00e9.");
        else if (err === "no_slots") setError("Plus de places disponibles. Contacte le ma\u00eetre du jeu.");
        else setError("Une erreur s'est produite. R\u00e9essaie.");
        setIsPending(false);
        return;
      }
      router.push(`/mission?code=${player.code}&room=${room}`);
    } catch {
      setError("Impossible de contacter le serveur. V\u00e9rifie ta connexion.");
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
    if (!room) { setError("Code de salle manquant."); return; }
    if (gameStatus === "finished") { setError("Cette partie est termin\u00e9e."); return; }
    if (gameStatus === "waiting") {
      setIsPending(true);
      setError("");
      return;
    }
    await doRegister(trimmed);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Rejoins le jeu</h1>
      <p className="text-gray-500">Entre ton pr\u00e9nom pour commencer.</p>

      {gameStatus === "waiting" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm text-center w-full max-w-xs">
          \u23f3 La partie n&apos;a pas encore commenc\u00e9. Tu peux entrer ton pr\u00e9nom
          &nbsp;— tu seras inscrit automatiquement au lancement !
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="Ton pr\u00e9nom"
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
            ? "Inscription\u2026"
            : isPending
            ? "\u23f3 En attente du lancement\u2026"
            : gameStatus === "waiting"
            ? "Me pr\u00e9-inscrire"
            : "Commencer"}
        </button>
        {isPending && (
          <button
            type="button"
            onClick={() => setIsPending(false)}
            className="text-xs text-gray-400 underline text-center"
          >
            Annuler
          </button>
        )}
      </form>
    </main>
  );
}
