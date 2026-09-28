import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneElement } from "@/core/model";

import { makeProject, makeScene, makeTextElement } from "../fixtures";

/**
 * One element that throws should cost one element.
 *
 * This is the failure that motivated the boundaries: the canvas draws user
 * content, and losing the canvas means losing the only way to select and repair
 * the element that broke it -- along with every unsaved edit sitting in the
 * store behind it.
 *
 * The renderer wants the opposite, and that is tested here too. A contained
 * failure during an export would silently bake a placeholder into a video
 * someone is about to publish, so a render must fail rather than paper over it.
 */
const BROKEN_ID = "element-that-throws";

vi.mock("@/features/editor/element-view", () => ({
  ElementView: ({ element }: { element: SceneElement }) => {
    if (element.id === BROKEN_ID) throw new Error("this element cannot be drawn");
    return <div data-testid={`drawn-${element.id}`}>{element.name}</div>;
  },
}));

const { ProjectComposition } = await import("@/features/preview/composition");

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs every caught error itself; silenced so a deliberate throw does
  // not bury the rest of the suite's output.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

function projectWithABrokenElement() {
  return makeProject({
    scenes: [
      makeScene({
        data: {
          elements: [
            makeTextElement({ id: "before", name: "Before" }),
            makeTextElement({ id: BROKEN_ID, name: "Broken box" }),
            makeTextElement({ id: "after", name: "After" }),
          ],
          transition: null,
          background: null,
          notes: "",
          diagram: null,
        },
      }),
    ],
  });
}

describe("a scene containing an element that throws", () => {
  it("keeps drawing every other element, in the editor", () => {
    render(<ProjectComposition project={projectWithABrokenElement()} frame={0} isolateElements />);

    expect(screen.getByTestId("drawn-before")).toBeInTheDocument();
    expect(screen.getByTestId("drawn-after")).toBeInTheDocument();
  });

  it("marks the broken element in place rather than leaving a hole", () => {
    render(<ProjectComposition project={projectWithABrokenElement()} frame={0} isolateElements />);

    const broken = document.querySelector("[data-broken-element]");
    expect(broken).toBeInTheDocument();
    expect(broken).toHaveTextContent(/Broken box could not be drawn/);
  });

  it("keeps the broken element selectable, so it can be fixed or deleted", () => {
    // A fallback that could not be clicked would leave the user with a canvas
    // they cannot repair.
    render(<ProjectComposition project={projectWithABrokenElement()} frame={0} isolateElements />);

    expect(document.querySelector(`[data-element-id="${BROKEN_ID}"]`)).toBeInTheDocument();
  });

  it("names it for a screen reader, since it is otherwise only a dashed box", () => {
    render(<ProjectComposition project={projectWithABrokenElement()} frame={0} isolateElements />);

    expect(screen.getByRole("img", { name: /Broken box could not be drawn/ })).toBeInTheDocument();
  });

  it("throws instead, when rendering for export", () => {
    // Without `isolateElements` the failure propagates, which is what lets the
    // export report a failed render rather than produce a video with a red box
    // in it.
    expect(() =>
      render(<ProjectComposition project={projectWithABrokenElement()} frame={0} />),
    ).toThrow(/cannot be drawn/);
  });
});
