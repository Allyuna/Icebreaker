"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadRoom } from "@/app/lib/db";
import type { IScannerControls } from "@zxing/browser";

export default function FindPage() {
  return (
    <Suspense>
      <FindInner />
    </Suspense>
  );
}

function FindInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const myCode = searchParams.get("myCode") ?? "";
  const room = searchParams.get("room") ?? "";

  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (room) {
      loadRoom(room).then((s) => {
        if (s) setAccent(s.accentColor ?? "#000000");
      });
    }
  }, [room]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  async function startScanner() {
    setError("");
    setScanning(true);
    // Dynamic import — keeps bundle small for users who never scan
    const { BrowserQRCodeReader } = await import("@zxing/browser");
    const reader = new BrowserQRCodeReader();
    try {
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err) => {
          if (!result) return;
          const code = result.getText().trim();
          controls.stop();
          controlsRef.current = null;
          setScanning(false);
          if (!/^\d{4}$/.test(code)) {
            setError("QR code invalide — ce n'est pas un code joueur.");
            return;
          }
          if (code === myCode) {
            setError("Tu ne peux pas te matcher avec toi-même !");
            return;
          }
          router.push(`/confirm?myCode=${myCode}&theirCode=${code}&room=${room}`);
        }
      );
      controlsRef.current = controls;
    } catch {
      setScanning(false);
      setError("Scan annulé ou caméra inaccessible.");
    }
  }

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = manualCode.trim();
    if (!/^\d{4}$/.test(code)) {
      setError("Le code doit être composé de 4 chiffres.");
      return;
    }
    if (code === myCode) {
      setError("Tu ne peux pas te matcher avec toi-même !");
      return;
    }
    router.push(`/confirm?myCode=${myCode}&theirCode=${code}&room=${room}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Valider un match</h1>
        <p className="text-gray-500 mt-2">
          Scanne le QR code ou entre le code à 4 chiffres.
        </p>
      </div>

      {/* QR Scanner */}
      {scanning ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <video
            ref={videoRef}
            className="w-full rounded-2xl border-4"
            style={{ borderColor: accent }}
          />
          <button
            onClick={stopScanner}
            className="text-sm text-gray-500 underline"
          >
            Annuler le scan
          </button>
        </div>
      ) : (
        <button
          onClick={startScanner}
          className="flex items-center gap-2 text-white rounded-xl px-6 py-4 text-lg font-semibold active:scale-95 transition w-full max-w-xs justify-center"
          style={{ backgroundColor: accent }}
        >
          📷 Scanner un QR code
        </button>
      )}

      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-gray-400 text-sm">ou</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Manual entry */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="tel"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="0000"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
          className="border-2 rounded-xl px-4 py-4 text-4xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-black"
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="text-white rounded-lg px-4 py-3 text-lg font-semibold active:scale-95 transition"
          style={{ backgroundColor: accent }}
        >
          Confirmer →
        </button>
      </form>

      <Link
        href={`/mission?code=${myCode}&room=${room}`}
        className="text-sm text-gray-400 underline"
      >
        ← Retour à ma mission
      </Link>
    </main>
  );
}
