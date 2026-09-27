import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportConfigSchema, type Project } from "@/core/model";

import { makeProject } from "../fixtures";

const startRenderAction = vi.fn<(projectId: string) => Promise<{ jobId?: string; error?: string }>>(
  async () => ({ jobId: "job-1" }),
);
const finishRenderAction = vi.fn<(input: unknown) => Promise<{ ok: boolean }>>(async () => ({
  ok: true,
}));

vi.mock("@/features/export/actions", () => ({
  startRenderAction: (projectId: string) => startRenderAction(projectId),
  finishRenderAction: (input: unknown) => finishRenderAction(input),
}));

interface CanRenderResult {
  canRender: boolean;
  issues: { type: string; message: string; severity: string }[];
}

const canRenderMediaOnWeb = vi.fn<(options: unknown) => Promise<CanRenderResult>>(async () => ({
  canRender: true,
  issues: [],
}));
const renderMediaOnWeb = vi.fn();

vi.mock("@remotion/web-renderer", () => ({
  canRenderMediaOnWeb: (options: unknown) => canRenderMediaOnWeb(options),
  renderMediaOnWeb: (options: unknown) => renderMediaOnWeb(options),
}));

// The composition is imported dynamically by the hook but never rendered here.
vi.mock("@/features/preview/motio-composition", () => ({ MotioComposition: () => null }));

const { ExportControls } = await import("@/features/export/export-controls");

function project(exportOverrides: Record<string, unknown> = {}): Project {
  return makeProject({ name: "Auth flow", export: exportConfigSchema.parse(exportOverrides) });
}

/** A render whose completion this test controls. */
function deferredRender() {
  let finish: (() => void) | undefined;
  let progress: ((value: number) => void) | undefined;

  renderMediaOnWeb.mockImplementation(async (options: Record<string, never>) => {
    const onProgress = options.onProgress as (p: Record<string, number>) => void;
    progress = (value) => onProgress({ progress: value, renderEstimatedTime: 20_000 });

    return {
      getBlob: () =>
        new Promise<Blob>((resolve) => {
          finish = () => resolve(new Blob(["video"], { type: "video/mp4" }));
        }),
    };
  });

  return {
    progress: (value: number) => progress?.(value),
    finish: () => finish?.(),
  };
}

beforeEach(() => {
  startRenderAction.mockClear();
  startRenderAction.mockResolvedValue({ jobId: "job-1" });
  finishRenderAction.mockClear();
  canRenderMediaOnWeb.mockClear();
  canRenderMediaOnWeb.mockResolvedValue({ canRender: true, issues: [] });
  renderMediaOnWeb.mockReset();

  // jsdom implements neither of these.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

describe("exporting a video from the browser", () => {
  it("renders, saves a file, and records the job as completed", async () => {
    const user = userEvent.setup();
    const control = deferredRender();
    render(<ExportControls project={project()} />);

    await user.click(screen.getByRole("button", { name: /Export video/ }));

    await waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalled());
    expect(startRenderAction).toHaveBeenCalledWith(project().id);

    control.finish();

    // Twice over: once visibly, once in the live region that announces it.
    await waitFor(() => expect(screen.getAllByText(/auth-flow-1080p\.mp4/)).toHaveLength(2));
    expect(screen.getByRole("status")).toHaveTextContent(/Export finished/);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(finishRenderAction).toHaveBeenCalledWith({ jobId: "job-1", outcome: "completed" });
  });

  it("renders the composition at the planned size and frame count", async () => {
    const user = userEvent.setup();
    deferredRender();
    render(<ExportControls project={project({ resolution: "720p", fps: 30 })} />);

    await user.click(screen.getByRole("button", { name: /Export video/ }));
    await waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalled());

    const options = renderMediaOnWeb.mock.calls[0][0] as Record<string, never>;
    const composition = options.composition as unknown as Record<string, number>;

    expect(composition.width).toBe(1280);
    expect(composition.height).toBe(720);
    expect(composition.fps).toBe(30);
    // Two fixture scenes: 150 + 90 frames.
    expect(composition.durationInFrames).toBe(240);
    expect(options.container).toBe("mp4");
    expect(options.videoCodec).toBe("h264");
  });

  it("reports progress while it runs, and offers a way out", async () => {
    const user = userEvent.setup();
    const control = deferredRender();
    render(<ExportControls project={project()} />);

    await user.click(screen.getByRole("button", { name: /Export video/ }));
    await waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalled());

    control.progress(0.42);

    await waitFor(() => expect(screen.getByText("42%")).toBeInTheDocument());
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("records a cancelled export as cancelled, not as a failure", async () => {
    const user = userEvent.setup();

    renderMediaOnWeb.mockImplementation(async (options: Record<string, never>) => {
      const signal = options.signal as unknown as AbortSignal;
      return {
        getBlob: () =>
          new Promise<Blob>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("Render was cancelled")));
          }),
      };
    });

    render(<ExportControls project={project()} />);
    await user.click(screen.getByRole("button", { name: /Export video/ }));
    await waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getAllByText(/Export cancelled/)).not.toHaveLength(0));
    expect(finishRenderAction).toHaveBeenCalledWith({
      jobId: "job-1",
      outcome: "cancelled",
      errorMessage: null,
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Export cancelled/);
  });

  it("shows why a render failed and records the failure", async () => {
    const user = userEvent.setup();
    renderMediaOnWeb.mockRejectedValue(new Error("Encoder ran out of memory"));

    render(<ExportControls project={project()} />);
    await user.click(screen.getByRole("button", { name: /Export video/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/out of memory/));
    expect(finishRenderAction).toHaveBeenCalledWith({
      jobId: "job-1",
      outcome: "failed",
      errorMessage: "Encoder ran out of memory",
    });
  });

  it("does not open a job when the browser cannot encode at all", async () => {
    const user = userEvent.setup();
    canRenderMediaOnWeb.mockResolvedValue({
      canRender: false,
      issues: [{ type: "webcodecs-unavailable", message: "WebCodecs is not available.", severity: "error" }],
    });

    render(<ExportControls project={project()} />);
    await user.click(screen.getByRole("button", { name: /Export video/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/WebCodecs/));
    // A job that could never have run should not appear in export history.
    expect(startRenderAction).not.toHaveBeenCalled();
    expect(renderMediaOnWeb).not.toHaveBeenCalled();
  });

  it("refuses gif up front instead of exporting the wrong thing", () => {
    render(<ExportControls project={project({ format: "gif" })} />);

    expect(screen.getByText(/cannot be encoded in the browser/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export video/ })).not.toBeInTheDocument();
    expect(renderMediaOnWeb).not.toHaveBeenCalled();
  });

  it("surfaces a refusal from the server without starting a render", async () => {
    const user = userEvent.setup();
    startRenderAction.mockResolvedValue({ error: "That project no longer exists." });

    render(<ExportControls project={project()} />);
    await user.click(screen.getByRole("button", { name: /Export video/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no longer exists/));
    expect(renderMediaOnWeb).not.toHaveBeenCalled();
  });
});
