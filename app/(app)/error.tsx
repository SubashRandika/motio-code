"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Failures inside the signed-in app.
 *
 * This exists rather than letting `app/error.tsx` handle everything because of
 * where a segment boundary sits: it replaces the segment's children but keeps
 * the layout above it, so the header and its navigation survive. The root
 * boundary replaces all of that, leaving someone on a dead page whose only exit
 * is the browser's back button.
 *
 * Most of what lands here is a query that could not reach the database, which
 * is usually transient -- so "Try again" comes first and re-runs the failed
 * render rather than reloading the whole page.
 */
export default function AppError({
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
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="tabular text-[11px] tracking-[0.18em] text-danger uppercase">
          Something went wrong
        </p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          This page could not be loaded
        </h1>

        <p className="mt-3 text-[14px] leading-relaxed text-mist">
          {/* In production Next replaces a server error's message with a generic
              one, so this shows the useful text in development and a safe
              sentence in production without needing to know which it is. */}
          {error.message || "The page could not finish loading."}
        </p>

        {error.digest ? (
          <p className="tabular mt-2 text-[12px] text-mist-dim">Reference {error.digest}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Go to your projects
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
