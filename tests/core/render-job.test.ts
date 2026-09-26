import { describe, expect, it } from "vitest";

import { exportConfigSchema, type ExportConfig } from "@/core/model";
import {
  RENDER_STATUSES,
  canTransition,
  isTerminal,
  outputFileName,
  videoBitrateFor,
  webRenderTarget,
  type RenderStatus,
} from "@/core/render";

function config(overrides: Partial<ExportConfig> = {}): ExportConfig {
  return exportConfigSchema.parse(overrides);
}

describe("the render job lifecycle", () => {
  it("lets a queued job start, and a started job finish", () => {
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("processing", "completed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
  });

  it("lets a job fail or be cancelled before it starts", () => {
    // The tab can go away between opening the job and the first frame.
    expect(canTransition("queued", "failed")).toBe(true);
    expect(canTransition("queued", "cancelled")).toBe(true);
  });

  it("never reopens a job that already ended", () => {
    // The browser is the renderer, so a late report is normal: a cancellation
    // can land after a success, and a retry can report twice.
    for (const from of ["completed", "failed", "cancelled"] as const) {
      for (const to of RENDER_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("never moves a job backwards into processing", () => {
    expect(canTransition("completed", "processing")).toBe(false);
    expect(canTransition("processing", "queued")).toBe(false);
  });

  it("agrees with itself about which states are final", () => {
    for (const status of RENDER_STATUSES) {
      const hasExits = RENDER_STATUSES.some((to) => canTransition(status, to));
      expect(isTerminal(status as RenderStatus), status).toBe(!hasExits);
    }
  });
});

describe("what the browser can encode", () => {
  it("maps mp4 and webm to a container and codec pair", () => {
    expect(webRenderTarget("mp4")).toEqual({
      container: "mp4",
      videoCodec: "h264",
      extension: "mp4",
      mimeType: "video/mp4",
    });
    expect(webRenderTarget("webm")?.container).toBe("webm");
  });

  it("refuses gif rather than silently producing something else", () => {
    // WebCodecs has no GIF container. Returning a video target here would hand
    // the user an mp4 named .gif.
    expect(webRenderTarget("gif")).toBeNull();
  });

  it("translates every quality step", () => {
    expect(videoBitrateFor("draft")).toBe("low");
    expect(videoBitrateFor("standard")).toBe("medium");
    expect(videoBitrateFor("high")).toBe("high");
  });
});

describe("the download filename", () => {
  it("is built from the project name and what was exported", () => {
    expect(outputFileName("Auth flow walkthrough", config({ resolution: "1080p" }))).toBe(
      "auth-flow-walkthrough-1080p.mp4",
    );
    expect(outputFileName("Auth flow", config({ format: "webm", resolution: "720p" }))).toBe(
      "auth-flow-720p.webm",
    );
  });

  it("keeps a path out of the filename", () => {
    // A project name is user input on its way to a filesystem.
    const name = outputFileName("../../etc/passwd", config());

    expect(name).not.toContain("/");
    expect(name).not.toContain("\\");
    expect(name).not.toContain("..");
    expect(name).toBe("etc-passwd-1080p.mp4");
  });

  it("drops characters a filesystem or a header would object to", () => {
    const name = outputFileName('My "project": v2 <final> | 100%', config());

    expect(name).toMatch(/^[a-z0-9-]+\.mp4$/);
    expect(name).toBe("my-project-v2-final-100-1080p.mp4");
  });

  it("never produces a name that is only an extension", () => {
    // Every character can be dropped: a name written entirely in a script the
    // allowlist does not cover, or only punctuation.
    expect(outputFileName("日本語", config())).toBe("motiocode-export-1080p.mp4");
    expect(outputFileName("...", config())).toBe("motiocode-export-1080p.mp4");
    expect(outputFileName("", config())).toBe("motiocode-export-1080p.mp4");
  });

  it("stays a sane length however long the project name is", () => {
    const name = outputFileName("a".repeat(500), config());

    expect(name.length).toBeLessThan(90);
    expect(name).toMatch(/^a+-1080p\.mp4$/);
  });

  it("never leaves a hyphen dangling where the name was cut", () => {
    // Truncation can land exactly on a separator.
    for (let length = 55; length <= 70; length += 1) {
      const projectName = `${"word ".repeat(20)}`.slice(0, length);
      const name = outputFileName(projectName, config());

      expect(name, `length ${length}`).not.toContain("--");
      expect(name, `length ${length}`).not.toContain("-1080p.mp4".repeat(2));
      expect(name, `length ${length}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*-1080p\.mp4$/);
    }
  });

  it("uses the chosen format's extension even when the browser cannot encode it", () => {
    // The settings say gif; the UI refuses the render. The name should still
    // describe what was asked for rather than claim to be an mp4.
    expect(outputFileName("Pipeline", config({ format: "gif" }))).toBe("pipeline-1080p.gif");
  });
});
