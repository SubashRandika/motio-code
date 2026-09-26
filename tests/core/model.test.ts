import { describe, expect, it } from "vitest";

import {
  CANVAS_PRESETS,
  canvasForAspectRatio,
  createBlankProjectDraft,
  exportConfigSchema,
  exportDimensions,
  projectSchema,
  sceneDataSchema,
} from "@/core/model";

describe("canvas presets", () => {
  it("matches its declared aspect ratio", () => {
    for (const [ratio, preset] of Object.entries(CANVAS_PRESETS)) {
      const [a, b] = ratio.split(":").map(Number);
      expect(preset.width / preset.height).toBeCloseTo(a / b, 3);
    }
  });

  it("builds a canvas from an aspect ratio", () => {
    expect(canvasForAspectRatio("9:16", 60)).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 60,
    });
  });
});

describe("exportDimensions", () => {
  it("keeps the long edge horizontal for landscape", () => {
    expect(exportDimensions(exportConfigSchema.parse({ aspectRatio: "16:9" }))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("flips for portrait", () => {
    expect(exportDimensions(exportConfigSchema.parse({ aspectRatio: "9:16" }))).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("always produces even dimensions, which h.264 requires", () => {
    for (const aspectRatio of ["16:9", "1:1", "9:16", "4:5"] as const) {
      for (const resolution of ["720p", "1080p", "1440p"] as const) {
        const { width, height } = exportDimensions(
          exportConfigSchema.parse({ aspectRatio, resolution }),
        );
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      }
    }
  });
});

describe("sceneDataSchema", () => {
  it("fills in defaults for an empty payload", () => {
    expect(sceneDataSchema.parse({})).toEqual({
      elements: [],
      transition: null,
      background: null,
      notes: "",
      diagram: null,
    });
  });

  it("rejects an unknown element type", () => {
    const result = sceneDataSchema.safeParse({ elements: [{ type: "hologram" }] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed colour", () => {
    expect(sceneDataSchema.safeParse({ background: "salmon" }).success).toBe(false);
    expect(sceneDataSchema.safeParse({ background: "#0E1116" }).success).toBe(true);
  });
});

describe("createBlankProjectDraft", () => {
  it("produces a project that satisfies the project schema", () => {
    const draft = createBlankProjectDraft({
      name: "API request lifecycle",
      contentType: "diagram",
      aspectRatio: "16:9",
    });

    const parsed = projectSchema.safeParse({
      ...draft,
      id: "3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11",
      ownerId: "8b1d2c3e-1d1a-4a4b-9f6c-2f4a1d6b8c12",
      description: null,
      templateId: null,
      thumbnailPath: null,
      dataVersion: 1,
      lastOpenedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(parsed.success).toBe(true);
    expect(draft.scenes).toHaveLength(1);
    expect(draft.export.aspectRatio).toBe("16:9");
  });

  it("requires at least one scene", () => {
    expect(projectSchema.safeParse({ scenes: [] }).success).toBe(false);
  });
});
