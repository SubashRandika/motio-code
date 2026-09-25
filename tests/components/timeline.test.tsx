import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildTimeline } from "@/core/animation";
import { TimelinePanel } from "@/features/editor/timeline";
import type { FrameClock } from "@/features/preview/use-frame-clock";

import { makeProject } from "../fixtures";

function makeClock(overrides: Partial<FrameClock> = {}): FrameClock {
  return {
    frame: 0,
    playing: false,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    seek: vi.fn(),
    step: vi.fn(),
    ...overrides,
  };
}

function renderTimeline(clock: FrameClock, frame = 0) {
  const project = makeProject();
  const timeline = buildTimeline(project.scenes);
  const onSelectScene = vi.fn();
  const onSelectElement = vi.fn();

  render(
    <TimelinePanel
      project={project}
      timeline={timeline}
      clock={{ ...clock, frame }}
      activeSceneId={project.scenes[0].id}
      selectedElementId={null}
      onSelectScene={onSelectScene}
      onSelectElement={onSelectElement}
    />,
  );

  return { project, timeline, onSelectScene, onSelectElement };
}

describe("TimelinePanel transport", () => {
  it("shows the current timecode and total frame count", () => {
    renderTimeline(makeClock(), 45);

    // 45 frames at 30fps is one second and fifteen frames.
    expect(screen.getByText("00:01:15")).toBeInTheDocument();
    expect(screen.getByText(/240 frames total/)).toBeInTheDocument();
  });

  it("labels the transport button by what pressing it does", () => {
    const { unmount } = render(<div />);
    unmount();

    renderTimeline(makeClock({ playing: false }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("steps one frame at a time", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    renderTimeline(clock);

    await user.click(screen.getByRole("button", { name: "Next frame" }));
    expect(clock.step).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(clock.step).toHaveBeenCalledWith(-1);
  });

  it("jumps to the start", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    renderTimeline(clock, 120);

    await user.click(screen.getByRole("button", { name: "Go to start" }));
    expect(clock.seek).toHaveBeenCalledWith(0);
  });

  it("exposes the playhead as a slider with the frame as its value", () => {
    renderTimeline(makeClock(), 60);

    const slider = screen.getByRole("slider", { name: "Playhead" });
    expect(slider).toHaveAttribute("aria-valuenow", "60");
    expect(slider).toHaveAttribute("aria-valuemax", "239");
    expect(slider).toHaveAttribute("aria-valuetext", "Frame 60");
  });

  it("scrubs with the arrow keys, ten frames at a time with shift", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    renderTimeline(clock, 30);

    const slider = screen.getByRole("slider", { name: "Playhead" });
    slider.focus();

    await user.keyboard("{ArrowRight}");
    expect(clock.step).toHaveBeenCalledWith(1);

    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(clock.step).toHaveBeenCalledWith(-10);

    await user.keyboard("{End}");
    expect(clock.seek).toHaveBeenCalledWith(239);
  });

  it("moves the playhead to a scene when its block is clicked", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    const { onSelectScene, project } = renderTimeline(clock);

    await user.click(screen.getByRole("button", { name: "The check" }));

    expect(onSelectScene).toHaveBeenCalledWith(project.scenes[1].id);
    expect(clock.seek).toHaveBeenCalledWith(150);
  });

  it("explains the empty element track instead of showing nothing", () => {
    renderTimeline(makeClock());
    expect(screen.getByText(/This scene has no elements yet/)).toBeInTheDocument();
  });
});
