import { describe, expect, it } from "vitest";

import { resolveElementState, resolveFocus } from "@/core/animation";
import type { Animation } from "@/core/model";

import { makeCodeElement } from "../fixtures";

function focus(overrides: Partial<Extract<Animation, { type: "focus" }>> = {}): Animation {
  return {
    id: "an_1",
    type: "focus",
    trigger: "at",
    offsetInFrames: 0,
    durationInFrames: 10,
    easing: "linear",
    fromPart: 2,
    toPart: 3,
    dim: 0.2,
    accent: "#F2A63B",
    ...overrides,
  };
}

const SCENE = 200;

describe("a focus animation", () => {
  it("does nothing before its window starts", () => {
    const element = makeCodeElement({ animations: [focus({ offsetInFrames: 50 })] });
    const state = resolveElementState(element, 10, SCENE);

    expect(state.focus).toBeNull();
    expect(resolveFocus(state, 1)).toEqual({ opacity: 1, emphasis: 0, accent: null });
  });

  it("ramps in rather than snapping", () => {
    const element = makeCodeElement({ animations: [focus()] });

    expect(resolveElementState(element, 0, SCENE).focus?.strength).toBe(0);
    expect(resolveElementState(element, 5, SCENE).focus?.strength).toBeCloseTo(0.5, 5);
    expect(resolveElementState(element, 10, SCENE).focus?.strength).toBe(1);
  });

  it("stays in force after its window, so the focus holds", () => {
    const element = makeCodeElement({ animations: [focus()] });
    expect(resolveElementState(element, 180, SCENE).focus?.strength).toBe(1);
  });

  it("dims the parts outside the range down to its dim level", () => {
    const element = makeCodeElement({ animations: [focus({ dim: 0.25 })] });
    const state = resolveElementState(element, 10, SCENE);

    expect(resolveFocus(state, 1).opacity).toBeCloseTo(0.25, 5);
    expect(resolveFocus(state, 2).opacity).toBe(1);
    expect(resolveFocus(state, 3).opacity).toBe(1);
    expect(resolveFocus(state, 4).opacity).toBeCloseTo(0.25, 5);
  });

  it("dims proportionally while it is still ramping in", () => {
    const element = makeCodeElement({ animations: [focus({ dim: 0 })] });
    const halfway = resolveElementState(element, 5, SCENE);

    expect(resolveFocus(halfway, 1).opacity).toBeCloseTo(0.5, 5);
  });

  it("gives the parts inside the range an emphasis weight and the accent", () => {
    const element = makeCodeElement({ animations: [focus({ accent: "#57D2E0" })] });
    const state = resolveElementState(element, 10, SCENE);

    expect(resolveFocus(state, 2)).toEqual({ opacity: 1, emphasis: 1, accent: "#57D2E0" });
    expect(resolveFocus(state, 9).accent).toBeNull();
  });

  it("tolerates a range written backwards", () => {
    const element = makeCodeElement({ animations: [focus({ fromPart: 7, toPart: 3 })] });
    const state = resolveElementState(element, 10, SCENE);

    expect(state.focus).toMatchObject({ fromPart: 3, toPart: 7 });
    expect(resolveFocus(state, 5).opacity).toBe(1);
  });
});

describe("several focus animations", () => {
  // A walkthrough is a chain of them. Every earlier step sits at progress 1
  // forever, so "last declared wins" would freeze on the final step; the rule is
  // that the latest window to have *started* is the one in force.
  const chain = [
    focus({ id: "an_a", offsetInFrames: 0, fromPart: 1, toPart: 2 }),
    focus({ id: "an_b", offsetInFrames: 40, fromPart: 3, toPart: 4 }),
    focus({ id: "an_c", offsetInFrames: 80, fromPart: 5, toPart: 6 }),
  ];

  it("hands over at each step's start frame", () => {
    const element = makeCodeElement({ animations: chain });

    expect(resolveElementState(element, 20, SCENE).focus).toMatchObject({ fromPart: 1, toPart: 2 });
    expect(resolveElementState(element, 60, SCENE).focus).toMatchObject({ fromPart: 3, toPart: 4 });
    expect(resolveElementState(element, 120, SCENE).focus).toMatchObject({ fromPart: 5, toPart: 6 });
  });

  it("does not depend on the order they are declared in", () => {
    const shuffled = makeCodeElement({ animations: [chain[2], chain[0], chain[1]] });

    expect(resolveElementState(shuffled, 60, SCENE).focus).toMatchObject({
      fromPart: 3,
      toPart: 4,
    });
  });

  it("breaks a tie on the later-declared one", () => {
    const element = makeCodeElement({
      animations: [
        focus({ id: "an_a", offsetInFrames: 10, fromPart: 1, toPart: 1 }),
        focus({ id: "an_b", offsetInFrames: 10, fromPart: 9, toPart: 9 }),
      ],
    });

    expect(resolveElementState(element, 30, SCENE).focus).toMatchObject({ fromPart: 9 });
  });

  it("leaves the element alone until the first step begins", () => {
    const element = makeCodeElement({
      animations: [focus({ offsetInFrames: 30 })],
    });

    expect(resolveElementState(element, 29, SCENE).focus).toBeNull();
    expect(resolveElementState(element, 30, SCENE).focus).not.toBeNull();
  });
});

describe("focus alongside the other animations", () => {
  it("does not touch opacity, scale or the reveal", () => {
    const element = makeCodeElement({ animations: [focus()] });
    const state = resolveElementState(element, 10, SCENE);

    expect(state.opacity).toBe(1);
    expect(state.scale).toBe(1);
    expect(state.revealProgress).toBe(1);
  });

  it("is dropped entirely while the element is not on screen", () => {
    const element = makeCodeElement({ from: 50, animations: [focus()] });
    expect(resolveElementState(element, 10, SCENE).focus).toBeNull();
  });
});
