import { describe, expect, it } from "vitest";

import { buildTimeline, clampFrame, getActiveSegments, getPrimarySegment } from "@/core/animation";
import { CUT_TRANSITION } from "@/core/model/animation";
import type { Scene } from "@/core/model/scene";

function scene(id: string, order: number, duration: number, overlap = 0): Scene {
  return {
    id,
    name: id,
    order,
    durationInFrames: duration,
    data: {
      elements: [],
      transition:
        overlap > 0
          ? { type: "fade", durationInFrames: overlap, direction: "left", easing: "easeInOut" }
          : CUT_TRANSITION,
      background: null,
      notes: "",
    },
  };
}

describe("buildTimeline", () => {
  it("lays cut scenes end to end", () => {
    const timeline = buildTimeline([scene("a", 0, 60), scene("b", 1, 90)]);

    expect(timeline.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 60],
      [60, 150],
    ]);
    expect(timeline.durationInFrames).toBe(150);
  });

  it("sorts by scene order rather than array order", () => {
    const timeline = buildTimeline([scene("b", 1, 90), scene("a", 0, 60)]);
    expect(timeline.segments.map((s) => s.sceneId)).toEqual(["a", "b"]);
  });

  it("overlaps a transitioning scene into the previous one", () => {
    const timeline = buildTimeline([scene("a", 0, 60), scene("b", 1, 90, 15)]);

    expect(timeline.segments[1].start).toBe(45);
    expect(timeline.segments[1].overlapInFrames).toBe(15);
    // 15 frames are shared, so the total is shorter than the sum.
    expect(timeline.durationInFrames).toBe(135);
  });

  it("never lets a transition consume a whole scene", () => {
    const timeline = buildTimeline([scene("a", 0, 10), scene("b", 1, 90, 400)]);
    expect(timeline.segments[1].overlapInFrames).toBe(9);
  });

  it("ignores a transition on the first scene", () => {
    const timeline = buildTimeline([scene("a", 0, 60, 20)]);
    expect(timeline.segments[0].start).toBe(0);
    expect(timeline.segments[0].overlapInFrames).toBe(0);
  });

  it("reports a zero-length timeline for no scenes", () => {
    expect(buildTimeline([])).toEqual({ segments: [], durationInFrames: 0 });
  });
});

describe("getActiveSegments", () => {
  const timeline = buildTimeline([scene("a", 0, 60), scene("b", 1, 90, 15)]);

  it("returns one scene outside a transition", () => {
    expect(getActiveSegments(timeline, 10).map((s) => s.segment.sceneId)).toEqual(["a"]);
    expect(getActiveSegments(timeline, 100).map((s) => s.segment.sceneId)).toEqual(["b"]);
  });

  it("returns both scenes during the overlap", () => {
    const active = getActiveSegments(timeline, 50);
    expect(active.map((s) => s.segment.sceneId)).toEqual(["a", "b"]);
    // 5 frames into a 15 frame transition.
    expect(active[1].transitionProgress).toBeCloseTo(5 / 15);
    expect(active[1].localFrame).toBe(5);
  });

  it("gives the incoming scene full ownership once the overlap ends", () => {
    expect(getPrimarySegment(timeline, 60)?.transitionProgress).toBe(1);
  });

  it("returns nothing past the end", () => {
    expect(getActiveSegments(timeline, timeline.durationInFrames)).toEqual([]);
  });
});

describe("clampFrame", () => {
  const timeline = buildTimeline([scene("a", 0, 60)]);

  it("keeps frames inside the playable range", () => {
    expect(clampFrame(timeline, -5)).toBe(0);
    expect(clampFrame(timeline, 59)).toBe(59);
    expect(clampFrame(timeline, 1000)).toBe(59);
  });
});
