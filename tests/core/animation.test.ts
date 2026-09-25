import { describe, expect, it } from "vitest";

import {
  animationWindow,
  formatTimecode,
  interpolate,
  isElementVisible,
  resolveElementState,
  resolveReveal,
} from "@/core/animation";
import type { Animation } from "@/core/model/animation";
import type { SceneElement, TextElement } from "@/core/model/element";

function textElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: "el_1",
    name: "Title",
    type: "text",
    rect: { x: 0, y: 0, width: 400, height: 100 },
    layer: 0,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: {
      fill: null,
      stroke: null,
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
      padding: 0,
      shadow: false,
    },
    animations: [],
    content: {
      text: "Hello",
      font: "sans",
      fontSize: 48,
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: 0,
      align: "left",
      color: "#E8ECF2",
      uppercase: false,
    },
    ...overrides,
  };
}

const fadeIn: Animation = {
  id: "an_1",
  type: "fade",
  trigger: "enter",
  offsetInFrames: 0,
  durationInFrames: 20,
  easing: "linear",
  from: 0,
  to: 1,
};

describe("interpolate", () => {
  it("maps a frame onto an output range", () => {
    expect(interpolate(0, [0, 10], [0, 100])).toBe(0);
    expect(interpolate(5, [0, 10], [0, 100])).toBe(50);
    expect(interpolate(10, [0, 10], [0, 100])).toBe(100);
  });

  it("clamps outside the input range by default", () => {
    expect(interpolate(-5, [0, 10], [0, 100])).toBe(0);
    expect(interpolate(20, [0, 10], [0, 100])).toBe(100);
  });

  it("extrapolates when clamping is off", () => {
    expect(interpolate(20, [0, 10], [0, 100], { clamp: false })).toBe(200);
  });

  it("treats a zero-length input range as a step", () => {
    expect(interpolate(4, [5, 5], [0, 1])).toBe(0);
    expect(interpolate(5, [5, 5], [0, 1])).toBe(1);
  });

  it("is deterministic for the same frame", () => {
    const once = interpolate(7, [0, 30], [0, 1], { easing: "easeInOut" });
    const twice = interpolate(7, [0, 30], [0, 1], { easing: "easeInOut" });
    expect(once).toBe(twice);
  });
});

describe("formatTimecode", () => {
  it("formats frames as mm:ss:ff", () => {
    expect(formatTimecode(0, 30)).toBe("00:00:00");
    expect(formatTimecode(45, 30)).toBe("00:01:15");
    expect(formatTimecode(1830, 30)).toBe("01:01:00");
  });
});

describe("element visibility", () => {
  it("is bounded by from and duration", () => {
    const element = textElement({ from: 10, durationInFrames: 20 });
    expect(isElementVisible(element, 9, 100)).toBe(false);
    expect(isElementVisible(element, 10, 100)).toBe(true);
    expect(isElementVisible(element, 29, 100)).toBe(true);
    expect(isElementVisible(element, 30, 100)).toBe(false);
  });

  it("runs to the end of the scene when duration is null", () => {
    const element = textElement({ from: 0, durationInFrames: null });
    expect(isElementVisible(element, 99, 100)).toBe(true);
    expect(isElementVisible(element, 100, 100)).toBe(false);
  });

  it("honours the hidden flag", () => {
    expect(isElementVisible(textElement({ hidden: true }), 0, 100)).toBe(false);
  });
});

describe("resolveElementState", () => {
  it("runs an enter fade across its window", () => {
    const element = textElement({ animations: [fadeIn] });
    expect(resolveElementState(element, 0, 100).opacity).toBe(0);
    expect(resolveElementState(element, 10, 100).opacity).toBeCloseTo(0.5);
    expect(resolveElementState(element, 20, 100).opacity).toBe(1);
    // Holds its end value afterwards.
    expect(resolveElementState(element, 80, 100).opacity).toBe(1);
  });

  it("plays an exit animation in reverse, ending on the last frame", () => {
    const exitFade: Animation = { ...fadeIn, trigger: "exit" };
    const element = textElement({ animations: [exitFade] });

    // The scene is 100 frames, so the exit occupies frames 80-100.
    expect(animationWindow(exitFade, element, 100)).toEqual({ start: 80, end: 100 });
    expect(resolveElementState(element, 0, 100).opacity).toBe(1);
    expect(resolveElementState(element, 90, 100).opacity).toBeCloseTo(0.5);
    expect(resolveElementState(element, 99, 100).opacity).toBeCloseTo(0.05);
  });

  it("multiplies overlapping opacities and accumulates offsets", () => {
    const element = textElement({
      animations: [
        fadeIn,
        { ...fadeIn, id: "an_2" },
        {
          id: "an_3",
          type: "slide",
          trigger: "enter",
          offsetInFrames: 0,
          durationInFrames: 20,
          easing: "linear",
          direction: "up",
          distance: 100,
        },
      ],
    });

    const state = resolveElementState(element, 10, 100);
    expect(state.opacity).toBeCloseTo(0.25); // 0.5 * 0.5
    expect(state.translateY).toBeCloseTo(50); // half of the 100 unit travel remains
  });

  it("returns zero opacity before the element starts", () => {
    const element = textElement({ from: 30, animations: [fadeIn] });
    const state = resolveElementState(element, 0, 100);
    expect(state.visible).toBe(false);
    expect(state.opacity).toBe(0);
  });

  it("returns to identity scale at both ends of an emphasis pulse", () => {
    const element = textElement({
      animations: [
        {
          id: "an_4",
          type: "emphasis",
          trigger: "at",
          offsetInFrames: 10,
          durationInFrames: 20,
          easing: "linear",
          peak: 1.2,
        },
      ],
    });

    expect(resolveElementState(element, 10, 100).scale).toBeCloseTo(1);
    expect(resolveElementState(element, 20, 100).scale).toBeCloseTo(1.2);
    expect(resolveElementState(element, 30, 100).scale).toBeCloseTo(1);
  });

  it("respects the element's base opacity", () => {
    const element = textElement({
      style: { ...textElement().style, opacity: 0.5 },
      animations: [fadeIn],
    });
    expect(resolveElementState(element, 20, 100).opacity).toBeCloseTo(0.5);
  });
});

describe("resolveReveal", () => {
  const element: SceneElement = textElement({
    animations: [
      {
        id: "an_5",
        type: "reveal",
        trigger: "enter",
        offsetInFrames: 0,
        durationInFrames: 40,
        easing: "linear",
        staggerInFrames: 4,
      },
    ],
  });

  it("shows parts progressively", () => {
    expect(resolveReveal(resolveElementState(element, 0, 100), 4).shown).toBe(0);
    expect(resolveReveal(resolveElementState(element, 20, 100), 4).shown).toBe(2);
    expect(resolveReveal(resolveElementState(element, 40, 100), 4).shown).toBe(4);
  });

  it("shows everything when no reveal animation is present", () => {
    const plain = textElement();
    expect(resolveReveal(resolveElementState(plain, 0, 100), 7).shown).toBe(7);
  });

  it("handles an empty part list", () => {
    expect(resolveReveal(resolveElementState(element, 20, 100), 0)).toEqual({
      shown: 0,
      partialProgress: 0,
    });
  });
});
