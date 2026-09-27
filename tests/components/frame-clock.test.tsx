import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFrameClock } from "@/features/preview/use-frame-clock";

/**
 * The clock is the one piece of state the whole preview hangs off, and its
 * reduced-motion behaviour had no test at all -- which is how the bug below got
 * in. An autoplaying clock holds on its last frame for a viewer who asked for
 * less motion, and that made `playing` mean two different things: the flag said
 * true, the screen showed a paused composition.
 */
let reducedMotion = false;

function stubMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Harness({ autoPlay = false }: { autoPlay?: boolean }) {
  const clock = useFrameClock({ fps: 30, durationInFrames: 200, loop: true, autoPlay });

  return (
    <div>
      <button type="button" onClick={clock.toggle}>
        {clock.playing ? "Pause" : "Play"}
      </button>
      <output data-testid="frame">{clock.frame}</output>
    </div>
  );
}

/** Drives `seek` through the UI, which is also how the timeline scrubber does it. */
function SeekHarness() {
  const clock = useFrameClock({ fps: 30, durationInFrames: 200 });

  return (
    <div>
      <button type="button" onClick={() => clock.seek(9_999)}>
        past the end
      </button>
      <button type="button" onClick={() => clock.seek(-40)}>
        before the start
      </button>
      <output data-testid="frame">{clock.frame}</output>
    </div>
  );
}

afterEach(() => {
  reducedMotion = false;
  vi.unstubAllGlobals();
});

describe("a clock that autoplays, for a viewer who asked for reduced motion", () => {
  it("holds on the finished frame instead of looping", () => {
    reducedMotion = true;
    stubMatchMedia();
    render(<Harness autoPlay />);

    // The last frame, not the first: they see the composition's result rather
    // than a loop they did not ask for.
    expect(screen.getByTestId("frame")).toHaveTextContent("199");
    expect(screen.getByRole("button")).toHaveTextContent("Play");
  });

  it("starts playing when the Play button is pressed, rather than doing nothing", async () => {
    // The regression this exists for: `playing` was still true from autoPlay
    // while suppression held the frame, so toggling set it to false -- and the
    // button labelled Play paused an already-paused clock.
    reducedMotion = true;
    stubMatchMedia();
    const user = userEvent.setup();
    render(<Harness autoPlay />);

    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(screen.getByRole("button")).toHaveTextContent("Pause");
  });

  it("plays from the beginning once the viewer takes over", async () => {
    reducedMotion = true;
    stubMatchMedia();
    const user = userEvent.setup();
    render(<Harness autoPlay />);

    await user.click(screen.getByRole("button", { name: "Play" }));

    // Suppression lifted, so the held last frame gives way to the real one.
    expect(screen.getByTestId("frame")).toHaveTextContent("0");
  });

  it("can then be paused again, so the control keeps working", async () => {
    reducedMotion = true;
    stubMatchMedia();
    const user = userEvent.setup();
    render(<Harness autoPlay />);

    await user.click(screen.getByRole("button", { name: "Play" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByRole("button")).toHaveTextContent("Play");
  });
});

describe("a clock with no motion preference set", () => {
  it("reports itself as playing when it autoplays", () => {
    stubMatchMedia();
    render(<Harness autoPlay />);

    expect(screen.getByRole("button")).toHaveTextContent("Pause");
  });

  it("toggles both ways from a stopped start", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("button")).toHaveTextContent("Play");

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button")).toHaveTextContent("Pause");

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button")).toHaveTextContent("Play");
  });

  it("clamps a seek to the composition, so no frame outside it can be shown", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    render(<SeekHarness />);

    await user.click(screen.getByRole("button", { name: "past the end" }));
    expect(screen.getByTestId("frame")).toHaveTextContent("199");

    await user.click(screen.getByRole("button", { name: "before the start" }));
    expect(screen.getByTestId("frame")).toHaveTextContent("0");
  });
});
