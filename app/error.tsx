"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="tabular text-[11px] tracking-[0.18em] text-danger uppercase">Error</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Something broke on our side</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-mist">
          {error.message || "The page could not finish loading."}
        </p>
        {error.digest ? (
          <p className="tabular mt-2 text-[12px] text-mist-dim">Reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
