"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Project } from "@/core/model";
import { outputFileName, planRender, videoBitrateFor, webRenderTarget } from "@/core/render";

import { finishRenderAction, startRenderAction } from "./actions";

export type RenderPhase = "idle" | "preparing" | "rendering" | "done" | "cancelled" | "error";

export interface WebRenderState {
  phase: RenderPhase;
  /** 0 to 1 while rendering. */
  progress: number;
  /** Milliseconds remaining, as estimated by the renderer, or null. */
  remainingMs: number | null;
  error: string | null;
  fileName: string | null;
}

const IDLE: WebRenderState = {
  phase: "idle",
  progress: 0,
  remainingMs: null,
  error: null,
  fileName: null,
};

/** Hands a finished blob to the browser as a download, then releases it. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; a frame is
  // enough for the click to have been taken.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/**
 * Renders a project to a video file in the browser.
 *
 * The render happens on this tab: there is no server-side renderer yet, and
 * `@remotion/web-renderer` encodes through WebCodecs without one. That shapes
 * three things:
 *
 * - **It can be refused before it starts.** `canRenderMediaOnWeb` reports whether
 *   this browser can encode the requested container and codec at these
 *   dimensions, so an unsupported browser gets a sentence instead of a failure
 *   several minutes in.
 * - **It must be cancellable.** A long render on the user's own machine that
 *   cannot be stopped is a hostage situation, so an `AbortSignal` is wired
 *   through and cancellation is recorded as an outcome rather than an error.
 * - **Progress stays local.** The job row records that a render happened and how
 *   it ended; writing progress to the database frame by frame would be a request
 *   per frame for a number only this tab is looking at.
 *
 * The renderer itself is imported on demand, so it costs nothing until an export
 * is actually asked for.
 */
export function useWebRender(project: Project) {
  const [state, setState] = useState<WebRenderState>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      // Leaving the page mid-render should stop the work, not orphan it.
      controllerRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    const target = webRenderTarget(project.export.format);

    if (!target) {
      setState({
        ...IDLE,
        phase: "error",
        error: `${project.export.format.toUpperCase()} cannot be encoded in the browser. Export as MP4 or WebM, or wait for server-side rendering.`,
      });
      return;
    }

    const plan = planRender(project, project.export);
    const fileName = outputFileName(project.name, project.export);

    setState({ ...IDLE, phase: "preparing", fileName });

    const controller = new AbortController();
    controllerRef.current = controller;

    let jobId: string | null = null;

    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { MotioComposition } = await import("@/features/preview/motio-composition");

      const capability = await canRenderMediaOnWeb({
        container: target.container,
        videoCodec: target.videoCodec,
        width: plan.width,
        height: plan.height,
        muted: true,
      });

      if (!capability.canRender) {
        const blocker = capability.issues.find((issue) => issue.severity === "error");
        throw new Error(
          blocker?.message ??
            "This browser cannot encode video. Try the latest Chrome, Edge or Firefox.",
        );
      }

      const started = await startRenderAction(project.id);
      if (started.error || !started.jobId) {
        throw new Error(started.error ?? "Could not start the export.");
      }
      jobId = started.jobId;

      if (liveRef.current) setState((current) => ({ ...current, phase: "rendering" }));

      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: plan.compositionId,
          component: MotioComposition,
          durationInFrames: plan.durationInFrames,
          fps: plan.fps,
          width: plan.width,
          height: plan.height,
          // Remotion requires both: `defaultProps` for a component with required
          // props, and `inputProps` as what is actually passed for this render.
          defaultProps: { project, plan },
        },
        inputProps: { project, plan },
        container: target.container,
        videoCodec: target.videoCodec,
        videoBitrate: videoBitrateFor(project.export.quality),
        // MotioCode compositions have no audio track at all yet, so asking for
        // one would only add an encoder that must be supported.
        muted: true,
        signal: controller.signal,
        // Declares eligibility for Remotion's Free License. This package always
        // reports a render; see docs/decisions/remotion-licensing.md.
        licenseKey: "free-license",
        onProgress: ({ progress, renderEstimatedTime }) => {
          if (!liveRef.current) return;
          setState((current) => ({
            ...current,
            progress,
            remainingMs: renderEstimatedTime,
          }));
        },
      });

      const blob = await getBlob();
      saveBlob(blob, fileName);

      await finishRenderAction({ jobId, outcome: "completed" });

      if (liveRef.current) {
        setState({ phase: "done", progress: 1, remainingMs: 0, error: null, fileName });
      }
    } catch (cause) {
      const aborted = controller.signal.aborted;
      const message =
        cause instanceof Error ? cause.message : "The export failed for an unknown reason.";

      if (jobId) {
        // Recorded on a best effort: the render already happened or did not, and
        // a failure to write history should not replace the real message.
        await finishRenderAction({
          jobId,
          outcome: aborted ? "cancelled" : "failed",
          errorMessage: aborted ? null : message,
        }).catch(() => {});
      }

      if (liveRef.current) {
        setState({
          phase: aborted ? "cancelled" : "error",
          progress: 0,
          remainingMs: null,
          error: aborted ? null : message,
          fileName,
        });
      }
    } finally {
      controllerRef.current = null;
    }
  }, [project]);

  return { ...state, start, cancel, reset };
}
