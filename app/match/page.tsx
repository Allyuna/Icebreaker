"use client";

// This route is kept for backwards compatibility.
// It redirects to /find which is the new match-finding flow.
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function MatchRedirect() {
  return (
    <Suspense>
      <MatchInner />
    </Suspense>
  );
}

function MatchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const myCode = searchParams.get("myCode") ?? searchParams.get("code") ?? "";

  useEffect(() => {
    router.replace(myCode ? `/find?myCode=${myCode}` : "/join");
  }, [myCode, router]);

  return null;
}