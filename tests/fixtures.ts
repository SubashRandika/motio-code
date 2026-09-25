import {
  canvasConfigSchema,
  exportConfigSchema,
  themeConfigSchema,
  type Project,
  type Scene,
} from "@/core/model";

export function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Opening",
    order: 0,
    durationInFrames: 150,
    data: { elements: [], transition: null, background: null, notes: "" },
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11",
    ownerId: "8b1d2c3e-1d1a-4a4b-9f6c-2f4a1d6b8c12",
    name: "Auth flow walkthrough",
    description: null,
    contentType: "code",
    templateId: null,
    thumbnailPath: null,
    dataVersion: 1,
    lastOpenedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    canvas: canvasConfigSchema.parse({}),
    theme: themeConfigSchema.parse({}),
    export: exportConfigSchema.parse({}),
    scenes: [
      makeScene(),
      makeScene({
        id: "22222222-2222-4222-8222-222222222222",
        name: "The check",
        order: 1,
        durationInFrames: 90,
      }),
    ],
    ...overrides,
  };
}
