import { describe, expect, it } from "vitest";

import { resolveElementState } from "@/core/animation";
import {
  animatedValue,
  chartLayout,
  chartMax,
  formatNumber,
  partFactors,
  progressFraction,
} from "@/core/infographic";
import {
  canvasConfigSchema,
  createAnimation,
  createElement,
  themeConfigSchema,
  type AddableElementType,
  type Animation,
  type ChartBar,
  type ChartElement,
  type CounterElement,
  type SceneElement,
} from "@/core/model";

const canvas = canvasConfigSchema.parse({});
const theme = themeConfigSchema.parse({});
const SCENE = 150;

/** A factory-built element of the wanted type, narrowed for the test. */
function make<T extends SceneElement>(
  type: T["type"] & AddableElementType,
  overrides: Partial<T> = {},
): T {
  return { ...createElement(type, { canvas, theme, index: 0 }), ...overrides } as T;
}

function count(durationInFrames = 30): Animation {
  return { ...createAnimation("count"), durationInFrames, easing: "linear" };
}

function reveal(durationInFrames = 30): Animation {
  return { ...createAnimation("reveal"), durationInFrames, easing: "linear" };
}

describe("formatNumber", () => {
  it("groups thousands without asking the runtime about locale", () => {
    // toLocaleString would answer differently on a machine with another locale,
    // which would make the editor and the renderer disagree.
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1000)).toBe("1,000");
  });

  it("can be asked not to group", () => {
    expect(formatNumber(1234567, { separator: false })).toBe("1234567");
  });

  it("keeps a fixed number of decimals so the width does not jump while counting", () => {
    expect(formatNumber(99.5, { decimals: 1 })).toBe("99.5");
    expect(formatNumber(99, { decimals: 1 })).toBe("99.0");
    expect(formatNumber(99.04, { decimals: 2 })).toBe("99.04");
  });

  it("puts the sign outside the prefix", () => {
    expect(formatNumber(-1500, { prefix: "$" })).toBe("-$1,500");
  });

  it("wraps the number in a prefix and suffix", () => {
    expect(formatNumber(42, { prefix: "$", suffix: "m" })).toBe("$42m");
  });

  it("groups only the whole part, not the decimals", () => {
    expect(formatNumber(1234.5678, { decimals: 4 })).toBe("1,234.5678");
  });

  it("falls back to zero rather than printing NaN on a slide", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
    expect(formatNumber(Number.POSITIVE_INFINITY, { suffix: "%" })).toBe("0%");
  });
});

describe("partFactors", () => {
  it("is all ones when nothing is animating, so the element shows its data", () => {
    const element = make<ChartElement>("chart");
    expect(partFactors(resolveElementState(element, 0, SCENE), 3)).toEqual([1, 1, 1]);
  });

  it("brings parts in one at a time under a reveal", () => {
    const element = make<ChartElement>("chart", { animations: [reveal(30)] });

    expect(partFactors(resolveElementState(element, 0, SCENE), 3)).toEqual([0, 0, 0]);
    expect(partFactors(resolveElementState(element, 15, SCENE), 3)).toEqual([1, 0.5, 0]);
    expect(partFactors(resolveElementState(element, 30, SCENE), 3)).toEqual([1, 1, 1]);
  });

  it("returns nothing for no parts", () => {
    expect(partFactors(resolveElementState(make("chart"), 0, SCENE), 0)).toEqual([]);
  });
});

describe("animatedValue", () => {
  it("reaches exactly the stored value, never a rounded approximation", () => {
    const element = make<CounterElement>("counter", {
      content: { ...make<CounterElement>("counter").content, value: 99.9 },
      animations: [count(30)],
    });

    expect(animatedValue(99.9, resolveElementState(element, 30, SCENE))).toBe(99.9);
  });

  it("starts at zero and rises", () => {
    const element = make<CounterElement>("counter", { animations: [count(30)] });

    expect(animatedValue(500, resolveElementState(element, 0, SCENE))).toBe(0);
    expect(animatedValue(500, resolveElementState(element, 15, SCENE))).toBeCloseTo(250, 5);
  });

  it("shows the true value when there is no animation at all", () => {
    expect(animatedValue(500, resolveElementState(make("counter"), 0, SCENE))).toBe(500);
  });

  it("counts down through an exit, because the curve runs in reverse", () => {
    const element = make<CounterElement>("counter", {
      durationInFrames: 60,
      animations: [{ ...count(30), trigger: "exit" }],
    });

    expect(animatedValue(100, resolveElementState(element, 30, SCENE))).toBeCloseTo(100, 5);
    expect(animatedValue(100, resolveElementState(element, 59, SCENE))).toBeLessThan(10);
  });
});

describe("chartMax", () => {
  const bars: ChartBar[] = [
    { label: "a", value: 30, color: null },
    { label: "b", value: 90, color: null },
  ];

  it("scales to the largest bar when no maximum is declared", () => {
    expect(chartMax(bars, null)).toBe(90);
  });

  it("honours a declared maximum, so two charts can share a scale", () => {
    expect(chartMax(bars, 200)).toBe(200);
  });

  it("ignores a declared maximum of zero rather than dividing by it", () => {
    expect(chartMax(bars, 0)).toBe(90);
  });

  it("never returns zero, so an all-zero chart draws flat rather than infinite", () => {
    const zeros: ChartBar[] = [{ label: "a", value: 0, color: null }];
    expect(chartMax(zeros, null)).toBe(1);
  });

  it("scales to magnitude, so a negative bar still fits the axis", () => {
    expect(chartMax([{ label: "a", value: -120, color: null }], null)).toBe(120);
  });
});

describe("chartLayout", () => {
  const bars: ChartBar[] = [
    { label: "Before", value: 800, color: null },
    { label: "After", value: 200, color: "#57D2E0" },
  ];

  it("keeps the label and the bar in step, because both come from one number", () => {
    const element = make<ChartElement>("chart", { animations: [count(30)] });
    const halfway = chartLayout(bars, null, resolveElementState(element, 15, SCENE));

    expect(halfway[0].shownValue).toBeCloseTo(400, 5);
    expect(halfway[0].fraction).toBeCloseTo(400 / 800, 5);
  });

  it("draws the full data when nothing is animating", () => {
    const still = chartLayout(bars, null, resolveElementState(make("chart"), 0, SCENE));

    expect(still.map((bar) => bar.fraction)).toEqual([1, 0.25]);
    expect(still.map((bar) => bar.shownValue)).toEqual([800, 200]);
  });

  it("grows every bar together under a count", () => {
    const element = make<ChartElement>("chart", { animations: [count(30)] });
    const mid = chartLayout(bars, null, resolveElementState(element, 15, SCENE));

    expect(mid[0].fraction).toBeGreaterThan(0);
    expect(mid[1].fraction).toBeGreaterThan(0);
  });

  it("grows them one at a time under a reveal", () => {
    const element = make<ChartElement>("chart", { animations: [reveal(30)] });
    const early = chartLayout(bars, null, resolveElementState(element, 7, SCENE));

    expect(early[0].fraction).toBeGreaterThan(0);
    expect(early[1].fraction).toBe(0);
  });

  it("composes the two: staggered and still counting", () => {
    const element = make<ChartElement>("chart", { animations: [count(30), reveal(30)] });

    // Frame 20 of 30 over two bars: the reveal is 2/3 through, so the first bar
    // is fully in and the second is a third of the way.
    const mid = chartLayout(bars, null, resolveElementState(element, 20, SCENE));

    expect(mid[0].shownValue).toBeCloseTo(800 * (2 / 3), 5);
    expect(mid[1].shownValue).toBeCloseTo(200 * (2 / 3) * (1 / 3), 5);
  });

  it("has the second bar at exactly zero on the frame the first one finishes", () => {
    // The handover frame is worth pinning: 15 of 30 over two bars puts the
    // reveal exactly on the boundary, and a bar must not start before its turn.
    const element = make<ChartElement>("chart", { animations: [count(30), reveal(30)] });
    const boundary = chartLayout(bars, null, resolveElementState(element, 15, SCENE));

    expect(boundary[0].shownValue).toBeCloseTo(400, 5);
    expect(boundary[1].shownValue).toBe(0);
  });

  it("reaches exactly the stored values at the end", () => {
    const element = make<ChartElement>("chart", { animations: [count(30), reveal(30)] });
    const done = chartLayout(bars, null, resolveElementState(element, 30, SCENE));

    expect(done.map((bar) => bar.shownValue)).toEqual([800, 200]);
  });

  it("carries each bar's own colour through untouched", () => {
    const laid = chartLayout(bars, null, resolveElementState(make("chart"), 0, SCENE));
    expect(laid.map((bar) => bar.color)).toEqual([null, "#57D2E0"]);
  });

  it("clamps a bar that exceeds a declared maximum instead of overflowing", () => {
    const laid = chartLayout(bars, 400, resolveElementState(make("chart"), 0, SCENE));
    expect(laid[0].fraction).toBe(1);
    // The label still tells the truth about the value.
    expect(laid[0].shownValue).toBe(800);
  });
});

describe("progressFraction", () => {
  it("is the value over the maximum", () => {
    const state = resolveElementState(make("progress"), 0, SCENE);
    expect(progressFraction(30, 120, state).fraction).toBe(0.25);
  });

  it("clamps above the maximum rather than overflowing its track", () => {
    const state = resolveElementState(make("progress"), 0, SCENE);
    expect(progressFraction(300, 100, state).fraction).toBe(1);
  });

  it("survives a maximum of zero", () => {
    const state = resolveElementState(make("progress"), 0, SCENE);
    expect(progressFraction(5, 0, state).fraction).toBe(1);
    expect(Number.isFinite(progressFraction(5, 0, state).fraction)).toBe(true);
  });

  it("fills as the count runs, and reports the value it is showing", () => {
    const element = make("progress", { animations: [count(30)] });
    const mid = progressFraction(80, 100, resolveElementState(element, 15, SCENE));

    expect(mid.shownValue).toBeCloseTo(40, 5);
    expect(mid.fraction).toBeCloseTo(0.4, 5);
  });
});

describe("the count animation", () => {
  it("leaves everything else about the element alone", () => {
    const element = make("counter", { animations: [count(30)] });
    const state = resolveElementState(element, 15, SCENE);

    expect(state.opacity).toBe(1);
    expect(state.scale).toBe(1);
    expect(state.translateX).toBe(0);
    expect(state.revealProgress).toBe(1);
  });

  it("takes the most restrictive of two, so neither can be overshot", () => {
    const element = make("counter", { animations: [count(30), count(60)] });
    const state = resolveElementState(element, 30, SCENE);

    expect(state.valueProgress).toBeCloseTo(0.5, 5);
  });

  it("holds at the full value after its window", () => {
    const element = make("counter", { animations: [count(30)] });
    expect(resolveElementState(element, 140, SCENE).valueProgress).toBe(1);
  });
});
