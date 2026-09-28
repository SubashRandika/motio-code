"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Failures in the editor.
 *
 * The editor gets its own boundary because the honest message here is different
 * from anywhere else in the app: the working copy lives in a store inside this
 * segment, so by the time this renders, unsaved edits since the last save are
 * gone. Saying "try again" without saying that would be misleading -- reloading
 * brings back the last *saved* state, not what was on screen.
 *
 * Most element-level failures never reach this boundary: the canvas isolates
 * each element, so one that throws becomes one broken box rather than a dead
 * editor. What lands here is a failure in the shell itself -- the store, the
 * timeline, the panels -- which is rarer and worth reporting.
 */
export default function EditorError({
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
      <div className="max-w-lg text-center">
        <p className="tabular text-[11px] tracking-[0.18em] text-danger uppercase">Editor error</p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">The editor stopped</h1>

        <p className="mt-3 text-[14px] leading-relaxed text-mist">
          Reopening the project loads it from the last save. Any edits made since then are not
          recoverable — MotioCode saves automatically a moment after you stop typing, so this is
          usually seconds of work rather than a session.
        </p>

        <p className="mt-3 text-[13px] leading-relaxed text-mist-dim">
          {error.message || "The editor could not finish rendering."}
        </p>

        {error.digest ? (
          <p className="tabular mt-2 text-[12px] text-mist-dim">Reference {error.digest}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Reopen the project</Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Back to projects
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
