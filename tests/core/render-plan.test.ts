import { describe, expect, it } from "vitest";

import { exportConfigSchema, type ExportConfig, type Project } from "@/core/model";
import { COMPOSITION_ID, canvasFrameFor, planRender, renderDurationInSeconds } from "@/core/render";

import { makeProject, makeScene } from "../fixtures";

function config(overrides: Partial<ExportConfig> = {}): ExportConfig {
  return exportConfigSchema.parse(overrides);
}

/** A project of a known length: 3 scenes of 90 frames at 30fps is 9 seconds. */
function project(overrides: Partial<Project> = {}): Project {
  return makeProject({
    scenes: [0, 1, 2].map((order) =>
      makeScene({
        id: `${order + 1}${order + 1}${order + 1}${order + 1}${order + 1}${order + 1}${order + 1}${order + 1}-1111-4111-8111-111111111111`,
        order,
        durationInFrames: 90,
        name: `Scene ${order + 1}`,
      }),
    ),
    ...overrides,
  });
}

describe("planRender", () => {
  it("registers every project under one composition id", () => {
    expect(planRender(project(), config()).compositionId).toBe(COMPOSITION_ID);
  });

  it("uses the export resolution, not the canvas resolution", () => {
    const plan = planRender(project(), config({ resolution: "720p" }));

    expect(plan.width).toBe(1280);
    expect(plan.height).toBe(720);
    expect(plan.canvasWidth).toBe(1920);
    expect(plan.canvasHeight).toBe(1080);
  });

  it("scales the canvas into the output, with no bars when the shape matches", () => {
    const plan = planRender(project(), config({ resolution: "720p" }));

    expect(plan.scale).toBeCloseTo(1280 / 1920);
    expect(plan.offsetX).toBe(0);
    expect(plan.offsetY).toBe(0);
    expect(plan.letterboxed).toBe(false);
  });

  it("upscales for a resolution above the canvas, still without bars", () => {
    const plan = planRender(project(), config({ resolution: "1440p" }));

    expect(plan.scale).toBeCloseTo(2560 / 1920);
    expect(plan.letterboxed).toBe(false);
  });

  it("fits and centres rather than cropping when the export shape differs", () => {
    // A landscape project asked for a portrait export.
    const plan = planRender(project(), config({ aspectRatio: "9:16" }));

    expect(plan.width).toBeLessThan(plan.height);
    // Width is the binding edge, so the full canvas width stays visible.
    expect(plan.canvasWidth * plan.scale).toBeCloseTo(plan.width);
    expect(plan.canvasHeight * plan.scale).toBeLessThanOrEqual(plan.height);
    expect(plan.offsetY).toBeGreaterThan(0);
    expect(plan.letterboxed).toBe(true);
  });

  it("keeps the whole canvas inside the output for every aspect ratio", () => {
    for (const aspectRatio of ["16:9", "1:1", "9:16", "4:5"] as const) {
      const plan = planRender(project(), config({ aspectRatio }));
      const drawnWidth = plan.canvasWidth * plan.scale;
      const drawnHeight = plan.canvasHeight * plan.scale;

      expect(drawnWidth, aspectRatio).toBeLessThanOrEqual(plan.width + 0.01);
      expect(drawnHeight, aspectRatio).toBeLessThanOrEqual(plan.height + 0.01);
      expect(plan.offsetX, aspectRatio).toBeGreaterThanOrEqual(0);
      expect(plan.offsetY, aspectRatio).toBeGreaterThanOrEqual(0);
    }
  });

  it("carries the authored length through when the frame rates match", () => {
    const plan = planRender(project(), config({ fps: 30 }));

    expect(plan.durationInFrames).toBe(270);
    expect(plan.frameRatio).toBe(1);
    expect(renderDurationInSeconds(plan)).toBeCloseTo(9);
  });

  it("resamples rather than retimes when the export frame rate differs", () => {
    const faster = planRender(project(), config({ fps: 60 }));
    const slower = planRender(project(), config({ fps: 15 }));

    // Twice the frames, the same nine seconds.
    expect(faster.durationInFrames).toBe(540);
    expect(renderDurationInSeconds(faster)).toBeCloseTo(9);

    expect(slower.durationInFrames).toBe(135);
    expect(renderDurationInSeconds(slower)).toBeCloseTo(9);
  });

  it("never plans a composition Remotion would reject", () => {
    // Remotion requires at least one frame, and an empty project is normal.
    const plan = planRender(makeProject({ scenes: [] }), config());
    expect(plan.durationInFrames).toBeGreaterThanOrEqual(1);
  });
});

describe("canvasFrameFor", () => {
  it("is the identity when the frame rates match", () => {
    const plan = planRender(project(), config({ fps: 30 }));

    for (const frame of [0, 1, 89, 90, 269]) {
      expect(canvasFrameFor(plan, frame)).toBe(frame);
    }
  });

  it("holds each authored frame across two output frames at double the rate", () => {
    const plan = planRender(project(), config({ fps: 60 }));

    expect(canvasFrameFor(plan, 0)).toBe(0);
    expect(canvasFrameFor(plan, 1)).toBe(1);
    expect(canvasFrameFor(plan, 2)).toBe(1);
    expect(canvasFrameFor(plan, 180)).toBe(90);
  });

  it("reaches the end of the authored timeline, so nothing is cut off", () => {
    for (const fps of [15, 24, 30, 60]) {
      const plan = planRender(project(), config({ fps }));
      const authored = canvasFrameFor(plan, plan.durationInFrames - 1);

      // 270 authored frames means the last one is 269.
      expect(authored, `${fps}fps`).toBeLessThanOrEqual(270);
      expect(authored, `${fps}fps`).toBeGreaterThanOrEqual(268);
    }
  });

  it("draws the authored frame belonging to each output frame's own timestamp", () => {
    // The invariant that makes an export faithful: an output frame shows what
    // the project looked like at that instant. It is stated with a tolerance of
    // half an authored frame because an output frame at 15fps spans two
    // authored frames, and something has to be chosen.
    for (const fps of [15, 24, 60]) {
      const plan = planRender(project(), config({ fps }));

      for (let outputFrame = 0; outputFrame < plan.durationInFrames; outputFrame += 7) {
        const seconds = outputFrame / fps;
        const expected = seconds * 30;

        expect(
          Math.abs(canvasFrameFor(plan, outputFrame) - expected),
          `${fps}fps, output frame ${outputFrame} (${seconds.toFixed(3)}s)`,
          // The epsilon is float noise at the exact boundary, not slack.
        ).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });
});
