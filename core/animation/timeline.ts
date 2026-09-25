import type { Transition } from "@/core/model/animation";
import type { Scene } from "@/core/model/scene";

import { clamp, clamp01 } from "./easing";

export interface TimelineSegment {
  sceneId: string;
  sceneIndex: number;
  /** First frame of the scene on the project timeline. */
  start: number;
  /** One past the last frame of the scene on the project timeline. */
  end: number;
  durationInFrames: number;
  /** How this scene enters from the previous one. */
  transition: Transition | null;
  /** Frames this scene overlaps the previous one. 0 for a cut. */
  overlapInFrames: number;
}

export interface Timeline {
  segments: TimelineSegment[];
  durationInFrames: number;
}

/**
 * Lays scenes end to end on a single frame axis.
 *
 * A scene with an incoming transition starts *before* the previous scene ends,
 * by the transition's duration, so the two overlap. The overlap is capped so a
 * transition can never consume an entire scene.
 */
export function buildTimeline(scenes: Scene[]): Timeline {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  ordered.forEach((scene, index) => {
    const transition = scene.data.transition;
    const requested =
      index === 0 || !transition || transition.type === "cut" ? 0 : transition.durationInFrames;

    const previous = segments[index - 1];
    const maxOverlap = previous
      ? Math.max(0, Math.min(previous.durationInFrames - 1, scene.durationInFrames - 1))
      : 0;
    const overlapInFrames = clamp(requested, 0, maxOverlap);

    const start = index === 0 ? 0 : cursor - overlapInFrames;
    const end = start + scene.durationInFrames;

    segments.push({
      sceneId: scene.id,
      sceneIndex: index,
      start,
      end,
      durationInFrames: scene.durationInFrames,
      transition: transition ?? null,
      overlapInFrames,
    });

    cursor = end;
  });

  return {
    segments,
    durationInFrames: segments.length === 0 ? 0 : segments[segments.length - 1].end,
  };
}

export interface ActiveSegment {
  segment: TimelineSegment;
  /** Frame within the scene, starting at 0. */
  localFrame: number;
  /**
   * 0 while the scene is still transitioning in, 1 once it fully owns the
   * frame. The outgoing scene below it uses `1 - transitionProgress`.
   */
  transitionProgress: number;
}

/**
 * Every scene visible at a frame, back to front. During a transition two
 * scenes are returned; outside one, exactly one.
 */
export function getActiveSegments(timeline: Timeline, frame: number): ActiveSegment[] {
  const active: ActiveSegment[] = [];

  for (const segment of timeline.segments) {
    if (frame < segment.start || frame >= segment.end) continue;

    const intoScene = frame - segment.start;
    const transitionProgress =
      segment.overlapInFrames > 0 ? clamp01(intoScene / segment.overlapInFrames) : 1;

    active.push({ segment, localFrame: intoScene, transitionProgress });
  }

  return active;
}

/** The scene that owns a frame: the topmost active one. */
export function getPrimarySegment(timeline: Timeline, frame: number): ActiveSegment | null {
  const active = getActiveSegments(timeline, frame);
  return active.length === 0 ? null : active[active.length - 1];
}

/** Project frame where a scene begins. Returns 0 for an unknown scene. */
export function sceneStartFrame(timeline: Timeline, sceneId: string): number {
  return timeline.segments.find((segment) => segment.sceneId === sceneId)?.start ?? 0;
}

/** Clamp a frame to the timeline's playable range. */
export function clampFrame(timeline: Timeline, frame: number): number {
  if (timeline.durationInFrames <= 0) return 0;
  return clamp(Math.round(frame), 0, timeline.durationInFrames - 1);
}
