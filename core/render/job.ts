import type { ExportConfig } from "@/core/model";

/** Mirrors the `render_status` Postgres enum. */
export const RENDER_STATUSES = ["queued", "processing", "completed", "failed", "cancelled"] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

const TERMINAL: readonly RenderStatus[] = ["completed", "failed", "cancelled"];

export function isTerminal(status: RenderStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * The lifecycle a render job may move through.
 *
 * Stated as data rather than as scattered `if`s because the renderer is the
 * browser: a tab can be closed, a render cancelled, a network call retried, and
 * the same finish can arrive twice. Rejecting a transition is how a late
 * "failed" is stopped from overwriting a "completed", and how a job that already
 * ended stays ended.
 */
const TRANSITIONS: Record<RenderStatus, readonly RenderStatus[]> = {
  queued: ["processing", "failed", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: RenderStatus, to: RenderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface WebRenderTarget {
  container: "mp4" | "webm";
  videoCodec: "h264" | "vp8";
  extension: string;
  mimeType: string;
}

/**
 * What the browser renderer should produce for a chosen format, or `null` when
 * it cannot produce it at all.
 *
 * GIF is the null case. `@remotion/web-renderer` encodes through WebCodecs,
 * whose containers are mp4, webm, mkv, mov and the audio-only ones -- GIF is not
 * among them. The format stays in the project model rather than being removed,
 * because a project may already have it saved and because a server-side renderer
 * can produce one later; the UI refuses the export and says why instead of
 * quietly handing back an mp4 named `.gif`.
 */
export function webRenderTarget(format: ExportConfig["format"]): WebRenderTarget | null {
  switch (format) {
    case "mp4":
      return { container: "mp4", videoCodec: "h264", extension: "mp4", mimeType: "video/mp4" };
    case "webm":
      return { container: "webm", videoCodec: "vp8", extension: "webm", mimeType: "video/webm" };
    case "gif":
      return null;
  }
}

/** Our quality steps in the renderer's vocabulary. */
export function videoBitrateFor(quality: ExportConfig["quality"]): "low" | "medium" | "high" {
  switch (quality) {
    case "draft":
      return "low";
    case "standard":
      return "medium";
    case "high":
      return "high";
  }
}

const MAX_STEM = 60;

/**
 * A download filename built from the project name.
 *
 * The project name is user input on its way to a filesystem, so this keeps only
 * an allowlist of characters: anything else becomes a hyphen. That removes path
 * separators, `..`, leading dots, control characters, quotes and the Windows
 * reserved set in one rule, rather than trying to enumerate what is dangerous.
 */
export function outputFileName(projectName: string, config: ExportConfig): string {
  const target = webRenderTarget(config.format);
  const extension = target?.extension ?? config.format;

  const stem = projectName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_STEM)
    .replace(/-+$/g, "")
    .toLowerCase();

  // Every project name could reduce to nothing, e.g. one written entirely in a
  // script the allowlist drops.
  const safe = stem === "" ? "motiocode-export" : stem;

  return `${safe}-${config.resolution}.${extension}`;
}
