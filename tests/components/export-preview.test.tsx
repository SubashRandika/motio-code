import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportConfigSchema, type Project } from "@/core/model";

import { makeProject } from "../fixtures";

/**
 * The Player needs real layout, which jsdom does not have. Standing in for it
 * records the contract we hand Remotion -- the composition, its dimensions, its
 * length and its frame rate -- which is the part that is ours to get right.
 * Whether the Player then plays it correctly is Remotion's own test suite.
 */
const playerProps = vi.fn();

vi.mock("@remotion/player", () => ({
  Player: (props: Record<string, unknown>) => {
    playerProps(props);
    return <div data-testid="player" />;
  },
}));

const { ExportPreview } = await import("@/features/preview/export-preview");
const { MotioComposition } = await import("@/features/preview/motio-composition");

function project(exportOverrides: Record<string, unknown> = {}): Project {
  return makeProject({ export: exportConfigSchema.parse(exportOverrides) });
}

function lastProps() {
  return playerProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("the export preview", () => {
  beforeEach(() => {
    playerProps.mockClear();
  });

  it("hands Remotion the shared composition, not a separate one", () => {
    render(<ExportPreview project={project()} onClose={() => {}} />);
    expect(lastProps().component).toBe(MotioComposition);
  });

  it("previews at the project's export settings", () => {
    render(<ExportPreview project={project({ resolution: "1080p", fps: 30 })} onClose={() => {}} />);

    const props = lastProps();
    expect(props.compositionWidth).toBe(1920);
    expect(props.compositionHeight).toBe(1080);
    expect(props.fps).toBe(30);
    // Two fixture scenes: 150 + 90 frames.
    expect(props.durationInFrames).toBe(240);
  });

  it("gives the player a length it will accept, even for an empty project", () => {
    render(<ExportPreview project={makeProject({ scenes: [] })} onClose={() => {}} />);
    expect(lastProps().durationInFrames).toBeGreaterThan(0);
  });

  it("states the output, rate and length before anyone waits for a render", () => {
    render(<ExportPreview project={project({ resolution: "720p", fps: 24 })} onClose={() => {}} />);

    expect(screen.getByText("1280×720")).toBeInTheDocument();
    expect(screen.getByText("24 fps")).toBeInTheDocument();
  });

  it("drops the preview to 720p on draft, leaving the stated export untouched", async () => {
    const user = userEvent.setup();
    render(<ExportPreview project={project({ resolution: "1440p" })} onClose={() => {}} />);

    expect(lastProps().compositionWidth).toBe(2560);

    await user.click(screen.getByRole("radio", { name: /Draft 720p/ }));

    expect(lastProps().compositionWidth).toBe(1280);
    // The export itself is still 1440p, and the readout must keep saying so.
    expect(screen.getByText("2560×1440")).toBeInTheDocument();
  });

  it("warns that a mismatched export ratio is fitted rather than cropped", () => {
    // The fixture canvas is 16:9.
    render(<ExportPreview project={project({ aspectRatio: "9:16" })} onClose={() => {}} />);

    expect(screen.getByText(/Nothing is cropped/)).toBeInTheDocument();
  });

  it("says nothing about framing when the export matches the canvas", () => {
    render(<ExportPreview project={project({ aspectRatio: "16:9" })} onClose={() => {}} />);

    expect(screen.queryByText(/Nothing is cropped/)).not.toBeInTheDocument();
  });
});
