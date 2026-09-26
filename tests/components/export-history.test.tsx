import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { exportConfigSchema } from "@/core/model";
import { ExportHistory } from "@/features/export/export-history";
import type { RenderJobSummary } from "@/features/export/queries";

function job(overrides: Partial<RenderJobSummary> = {}): RenderJobSummary {
  return {
    id: "job-1",
    status: "completed",
    settings: exportConfigSchema.parse({}),
    errorMessage: null,
    createdAt: "2026-09-26T10:00:00.000Z",
    completedAt: "2026-09-26T10:01:00.000Z",
    ...overrides,
  };
}

describe("export history", () => {
  it("says how to make one when there is nothing yet", () => {
    render(<ExportHistory jobs={[]} />);
    expect(screen.getByText(/Nothing exported yet/)).toBeInTheDocument();
  });

  it("describes what was exported, not just that something was", () => {
    render(<ExportHistory jobs={[job()]} />);

    expect(screen.getByText("Exported")).toBeInTheDocument();
    expect(screen.getByText(/MP4 · 1080p · 30 fps · 16:9/)).toBeInTheDocument();
  });

  it("shows why a failed export failed", () => {
    render(
      <ExportHistory jobs={[job({ status: "failed", errorMessage: "Encoder ran out of memory" })]} />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Encoder ran out of memory")).toBeInTheDocument();
  });

  it("calls a job still marked processing interrupted, since nothing is running", () => {
    // The only way a row stays `processing` is a tab that went away before it
    // could report back, so it must not read as in-progress.
    render(<ExportHistory jobs={[job({ status: "processing", completedAt: null })]} />);

    expect(screen.getByText("Interrupted")).toBeInTheDocument();
  });

  it("still lists a job whose settings no longer parse", () => {
    render(<ExportHistory jobs={[job({ settings: null })]} />);

    expect(screen.getByText("Exported")).toBeInTheDocument();
    expect(screen.queryByText(/fps/)).not.toBeInTheDocument();
  });

  it("lists the jobs it is given, in the order it is given them", () => {
    render(
      <ExportHistory
        jobs={[job({ id: "a", status: "completed" }), job({ id: "b", status: "cancelled" })]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Exported");
    expect(items[1]).toHaveTextContent("Cancelled");
  });
});
