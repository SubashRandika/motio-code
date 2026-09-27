import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildTimeline } from "@/core/animation";
import type { Project } from "@/core/model";
import { createEditorStore } from "@/features/editor/store";
import { TimelinePanel } from "@/features/editor/timeline";
import type { FrameClock } from "@/features/preview/use-frame-clock";

import { makeProject, makeTextElement, renderWithStore } from "../fixtures";

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

function renderTimeline(clock: FrameClock, frame = 0, project: Project = makeProject()) {
  const timeline = buildTimeline(project.scenes);
  const store = createEditorStore(project);

  renderWithStore(<TimelinePanel timeline={timeline} clock={{ ...clock, frame }} />, store);

  return { project, timeline, store };
}

/** jsdom has no layout, so give the clip track a width the drag maths can use. */
function stubTrackWidth(width = 1000) {
  const track = document.querySelector<HTMLElement>("[data-clip-track]");
  if (!track) throw new Error("no clip track rendered");
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: 20, right: width, bottom: 20, x: 0, y: 0 }) as DOMRect;
  return track;
}

describe("TimelinePanel transport", () => {
  it("shows the current timecode and total frame count", () => {
    renderTimeline(makeClock(), 45);

    // 45 frames at 30fps is one second and fifteen frames.
    expect(screen.getByText("00:01:15")).toBeInTheDocument();
    expect(screen.getByText(/240 frames total/)).toBeInTheDocument();
  });

  it("labels the transport button by what pressing it does", () => {
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

  it("keeps the slider a leaf, so it is a widget a screen reader can describe", () => {
    // `role="slider"` must not contain focusable children. The scene blocks are
    // real buttons on the track, so the role belongs on the playhead -- the way
    // a native range input puts it on the thumb, not the groove.
    renderTimeline(makeClock(), 60);

    const slider = screen.getByRole("slider", { name: "Playhead" });
    expect(
      slider.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'),
    ).toHaveLength(0);

    // And the scene buttons are still reachable, rather than having been made
    // inert to satisfy the rule.
    expect(screen.getByRole("button", { name: "The check" })).toBeInTheDocument();
  });

  it("scrubs with the arrow keys, ten frames at a time with shift", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    renderTimeline(clock, 30);

    screen.getByRole("slider", { name: "Playhead" }).focus();

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
    const { store, project } = renderTimeline(clock);

    await user.click(screen.getByRole("button", { name: "The check" }));

    expect(store.getState().selectedSceneId).toBe(project.scenes[1].id);
    expect(clock.seek).toHaveBeenCalledWith(150);
  });

  it("explains the empty element track instead of showing nothing", () => {
    renderTimeline(makeClock());
    expect(screen.getByText(/This scene has no elements yet/)).toBeInTheDocument();
  });
});

describe("TimelinePanel element clips", () => {
  function projectWithElement() {
    const project = makeProject();
    project.scenes[0].data.elements = [
      makeTextElement({ id: "el_1", name: "Title", from: 30, durationInFrames: 60 }),
    ];
    return project;
  }

  it("lists a clip per element with its frame range", () => {
    renderTimeline(makeClock(), 0, projectWithElement());
    expect(screen.getByText("30–90f")).toBeInTheDocument();
  });

  it("selects an element from its track label", async () => {
    const user = userEvent.setup();
    const { store } = renderTimeline(makeClock(), 0, projectWithElement());

    await user.click(screen.getByRole("button", { name: "Title" }));
    expect(store.getState().selectedElementIds).toEqual(["el_1"]);
  });

  it("drags a clip to change when the element starts", () => {
    const { store } = renderTimeline(makeClock(), 0, projectWithElement());
    stubTrackWidth(1000);

    const clip = screen.getByRole("group", { name: "Title timing" });
    // The track spans 240 frames over 1000px, so a 100px drag is 24 frames.
    fireEvent.pointerDown(clip, { clientX: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(clip, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(clip, { clientX: 300, pointerId: 1 });

    const element = store.getState().project.scenes[0].data.elements[0];
    expect(element.from).toBe(54);
    // Trimming is a separate gesture; a move keeps the length.
    expect(element.durationInFrames).toBe(60);
  });

  it("keeps a whole drag as a single undo step", () => {
    const { store } = renderTimeline(makeClock(), 0, projectWithElement());
    stubTrackWidth(1000);

    const clip = screen.getByRole("group", { name: "Title timing" });
    fireEvent.pointerDown(clip, { clientX: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(clip, { clientX: 220, pointerId: 1 });
    fireEvent.pointerMove(clip, { clientX: 260, pointerId: 1 });
    fireEvent.pointerMove(clip, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(clip, { clientX: 300, pointerId: 1 });

    expect(store.getState().history.past).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().project.scenes[0].data.elements[0].from).toBe(30);
  });

  it("never drags a clip past the start of its scene", () => {
    const { store } = renderTimeline(makeClock(), 0, projectWithElement());
    stubTrackWidth(1000);

    const clip = screen.getByRole("group", { name: "Title timing" });
    fireEvent.pointerDown(clip, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(clip, { clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(clip, { clientX: 0, pointerId: 1 });

    expect(store.getState().project.scenes[0].data.elements[0].from).toBe(0);
  });

  it("does not move a locked element", () => {
    const project = makeProject();
    project.scenes[0].data.elements = [
      makeTextElement({ id: "el_1", name: "Title", from: 30, durationInFrames: 60, locked: true }),
    ];

    const { store } = renderTimeline(makeClock(), 0, project);
    stubTrackWidth(1000);

    const clip = screen.getByRole("group", { name: "Title timing" });
    fireEvent.pointerDown(clip, { clientX: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(clip, { clientX: 400, pointerId: 1 });
    fireEvent.pointerUp(clip, { clientX: 400, pointerId: 1 });

    expect(store.getState().project.scenes[0].data.elements[0].from).toBe(30);
  });
});
