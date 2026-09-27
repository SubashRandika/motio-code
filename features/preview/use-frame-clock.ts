"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface FrameClockOptions {
  fps: number;
  durationInFrames: number;
  loop?: boolean;
  autoPlay?: boolean;
}

export interface FrameClock {
  frame: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (frame: number) => void;
  step: (delta: number) => void;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readMotionPreference() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Drives playback by deriving the frame from elapsed wall-clock time, so
 * playback runs at the project's frame rate regardless of the display's
 * refresh rate and never drifts on a slow tick.
 *
 * Only the *frame* leaves this hook. Everything downstream is a pure function
 * of that number, which is what keeps the editor preview and a headless render
 * in agreement.
 */
export function useFrameClock({
  fps,
  durationInFrames,
  loop = false,
  autoPlay = false,
}: FrameClockOptions): FrameClock {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  // Set once the viewer uses a transport control, which overrides the
  // reduced-motion default below.
  const [viewerTookOver, setViewerTookOver] = useState(false);
  const frameRef = useRef(0);

  // Reads the media query without a hydration mismatch: the server snapshot is
  // always false, and the client re-renders if the preference is set.
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    readMotionPreference,
    () => false,
  );

  const lastFrame = Math.max(0, durationInFrames - 1);

  // An autoplaying clock holds on its final frame for a viewer who asked for
  // reduced motion, so they see the finished composition instead of a loop.
  const suppressed = prefersReducedMotion && autoPlay && !viewerTookOver;
  const effectivePlaying = playing && !suppressed;
  const effectiveFrame = suppressed ? lastFrame : frame;

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, Math.round(next)), lastFrame);
      frameRef.current = clamped;
      setFrame(clamped);
    },
    [lastFrame],
  );

  useEffect(() => {
    if (!effectivePlaying || durationInFrames <= 0) return;

    let raf = 0;
    let origin: { time: number; frame: number } | null = null;

    const tick = (now: number) => {
      origin ??= { time: now, frame: frameRef.current };
      const elapsedFrames = Math.floor(((now - origin.time) / 1000) * fps);
      const next = origin.frame + elapsedFrames;

      if (next > lastFrame) {
        if (loop) {
          origin = { time: now, frame: 0 };
          commit(0);
        } else {
          commit(lastFrame);
          setPlaying(false);
          return;
        }
      } else {
        commit(next);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [effectivePlaying, fps, durationInFrames, lastFrame, loop, commit]);

  const play = useCallback(() => {
    setViewerTookOver(true);
    if (frameRef.current >= lastFrame) commit(0);
    setPlaying(true);
  }, [commit, lastFrame]);

  const pause = useCallback(() => {
    setViewerTookOver(true);
    setPlaying(false);
  }, []);

  /**
   * Toggles what the viewer can actually see, not the raw flag.
   *
   * These two disagree exactly when playback is suppressed for reduced motion:
   * `playing` is still true from `autoPlay` while the composition is held on its
   * last frame, so the button reads "Play" and a naive toggle would set
   * `playing` to false -- the Play button would pause an already-paused clock
   * and appear to do nothing. Reading the effective state is what keeps the
   * control honest about its own label.
   */
  const toggle = useCallback(() => {
    const showingAsPlaying = playing && !suppressed;
    setViewerTookOver(true);
    if (!showingAsPlaying && frameRef.current >= lastFrame) commit(0);
    setPlaying(!showingAsPlaying);
  }, [commit, lastFrame, playing, suppressed]);

  const seek = useCallback(
    (next: number) => {
      setViewerTookOver(true);
      setPlaying(false);
      commit(next);
    },
    [commit],
  );

  const step = useCallback(
    (delta: number) => {
      setViewerTookOver(true);
      commit(frameRef.current + delta);
    },
    [commit],
  );

  return { frame: effectiveFrame, playing: effectivePlaying, play, pause, toggle, seek, step };
}
