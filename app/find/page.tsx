"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadRoom, queueATMatchInRoom } from "@/app/lib/db";
import type { IScannerControls } from "@zxing/browser";
import { useLang } from "@/app/lib/LangContext";

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
  const { t } = useLang();

  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [gameMode, setGameMode] = useState("its-a-match");
  const [scanning, setScanning] = useState(false);
  const [atStatus, setAtStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (room) {
      loadRoom(room).then((s) => {
        if (s) {
          setAccent(s.accentColor ?? "#000000");
          setGameMode(s.gameMode ?? "its-a-match");
        }
      });
    }
  }, [room]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  async function handleATScan(targetCode: string) {
    setAtStatus("loading");
    setError("");
    const result = await queueATMatchInRoom(room, myCode, targetCode);
    if (result.success) {
      setAtStatus("success");
      setTimeout(() => router.push(`/at/hub?code=${myCode}&room=${room}&scanned=1`), 1200);
    } else {
      setAtStatus("error");
      if (result.error === "cooldown") setError(t.at_confirm_cooldown);
      else if (result.error === "player_not_alive") setError(t.at_confirm_dead);
      else setError(t.find_err_invalid_qr);
    }
  }

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
            setError(t.find_err_invalid_qr);
            return;
          }
          if (code === myCode) {
            setError(t.find_err_self);
            return;
          }
          if (gameMode === "agents-traitors") {
            handleATScan(code);
          } else {
            router.push(`/confirm?myCode=${myCode}&theirCode=${code}&room=${room}`);
          }
        }
      );
      controlsRef.current = controls;
    } catch {
      setScanning(false);
      setError(t.find_err_camera);
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
      setError(t.find_err_digits);
      return;
    }
    if (code === myCode) {
      setError(t.find_err_self);
      return;
    }
    if (gameMode === "agents-traitors") {
      handleATScan(code);
    } else {
      router.push(`/confirm?myCode=${myCode}&theirCode=${code}&room=${room}`);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      {/* AT mode: success/loading overlay */}
      {atStatus === "success" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-500 text-white gap-4">
          <p className="text-7xl">✅</p>
          <p className="text-2xl font-bold">{t.at_scan_recorded}</p>
        </div>
      )}
      {atStatus === "loading" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/80 text-white">
          <p className="text-2xl font-bold animate-pulse">{t.at_loading}</p>
        </div>
      )}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t.find_title}</h1>
        <p className="text-gray-500 mt-2">{t.find_sub}</p>
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
            {t.find_stop}
          </button>
        </div>
      ) : (
        <button
          onClick={startScanner}
          className="flex items-center gap-2 text-white rounded-xl px-6 py-4 text-lg font-semibold active:scale-95 transition w-full max-w-xs justify-center"
          style={{ backgroundColor: accent }}
        >
          {t.find_scan}
        </button>
      )}

      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-gray-400 text-sm">{t.find_or}</span>
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
          {t.find_confirm}
        </button>
      </form>

      <Link
        href={
          gameMode === "agents-traitors"
            ? `/at/hub?code=${myCode}&room=${room}`
            : `/mission?code=${myCode}&room=${room}`
        }
        className="text-sm text-gray-400 underline"
      >
        {t.find_back}
      </Link>
    </main>
  );
}
