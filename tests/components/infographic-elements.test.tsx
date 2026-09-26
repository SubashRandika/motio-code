import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  canvasConfigSchema,
  createAnimation,
  createElement,
  themeConfigSchema,
  type AddableElementType,
  type Animation,
  type ChartElement,
  type ComparisonElement,
  type CounterElement,
  type ProgressElement,
  type SceneElement,
  type StepsElement,
} from "@/core/model";
import { ElementView } from "@/features/editor/element-view";

const canvas = canvasConfigSchema.parse({});
const THEME = themeConfigSchema.parse({});
const SCENE = 150;

/** A factory-built element of the wanted type, narrowed for the test. */
function make<T extends SceneElement>(
  type: T["type"] & AddableElementType,
  overrides: Partial<T> = {},
): T {
  return { ...createElement(type, { canvas, theme: THEME, index: 0 }), ...overrides } as T;
}

function paint(element: SceneElement, frame: number): HTMLElement {
  const { container } = render(
    <ElementView element={element} frame={frame} sceneDurationInFrames={SCENE} theme={THEME} />,
  );
  return container;
}

function count(durationInFrames = 30): Animation {
  return { ...createAnimation("count"), durationInFrames, easing: "linear" };
}

function reveal(durationInFrames = 30): Animation {
  return { ...createAnimation("reveal"), durationInFrames, easing: "linear" };
}

describe("a counter", () => {
  const base = make<CounterElement>("counter");

  it("shows its stored value with its prefix, suffix and label", () => {
    const element = make<CounterElement>("counter", {
      content: { ...base.content, value: 1250, decimals: 0, prefix: "$", suffix: "k", label: "Saved" },
    });

    expect(paint(element, 0).textContent).toContain("$1,250k");
    expect(paint(element, 0).textContent).toContain("Saved");
  });

  it("counts from zero to exactly the stored value", () => {
    const element = make<CounterElement>("counter", {
      content: { ...base.content, value: 1000, decimals: 0, prefix: "", suffix: "", label: "" },
      animations: [count(30)],
    });

    expect(paint(element, 0).textContent).toBe("0");
    expect(paint(element, 15).textContent).toBe("500");
    expect(paint(element, 30).textContent).toBe("1,000");
  });

  it("keeps a fixed width of decimals while counting, so the digits do not jitter", () => {
    const element = make<CounterElement>("counter", {
      content: { ...base.content, value: 99.9, decimals: 1, prefix: "", suffix: "", label: "" },
      animations: [count(30)],
    });

    expect(paint(element, 10).textContent).toMatch(/^\d+\.\d$/);
    expect(paint(element, 30).textContent).toBe("99.9");
  });

  it("uses tabular figures", () => {
    const span = paint(base, 0).querySelector("span");
    expect((span as HTMLElement).style.fontVariantNumeric).toBe("tabular-nums");
  });
});

describe("a progress bar", () => {
  const base = make<ProgressElement>("progress");

  it("fills to the fraction of its maximum", () => {
    const element = make<ProgressElement>("progress", {
      content: { ...base.content, value: 30, max: 120 },
    });

    const fill = paint(element, 0).querySelectorAll("div[style*='width']");
    const widths = Array.from(fill).map((node) => (node as HTMLElement).style.width);
    expect(widths).toContain("25%");
  });

  it("shows the value it is drawing, not the value it will reach", () => {
    const element = make<ProgressElement>("progress", {
      content: { ...base.content, value: 80, max: 100, suffix: "%", showValue: true },
      animations: [count(30)],
    });

    expect(paint(element, 15).textContent).toContain("40%");
    expect(paint(element, 30).textContent).toContain("80%");
  });

  it("can be hidden, leaving just the bar", () => {
    const element = make<ProgressElement>("progress", {
      content: { ...base.content, value: 80, showValue: false, label: "" },
    });

    expect(paint(element, 0).textContent).toBe("");
  });

  it("draws a ring with a normalised dash rather than a measured path", () => {
    const element = make<ProgressElement>("progress", {
      content: { ...base.content, shape: "ring", value: 25, max: 100 },
    });

    const arc = paint(element, 0).querySelectorAll("circle")[1];
    expect(arc.getAttribute("pathLength")).toBe("1");
    expect(arc.getAttribute("stroke-dashoffset")).toBe("0.75");
  });

  it("keeps the ring circular whatever box it is dragged into", () => {
    const element = make<ProgressElement>("progress", {
      rect: { x: 0, y: 0, width: 600, height: 200 },
      content: { ...base.content, shape: "ring" },
    });

    const svg = paint(element, 0).querySelector("svg");
    expect(svg?.getAttribute("width")).toBe(svg?.getAttribute("height"));
  });
});

describe("a bar chart", () => {
  const base = make<ChartElement>("chart");

  const withBars = (overrides: Partial<ChartElement["content"]> = {}, animations: Animation[] = []) =>
    make<ChartElement>("chart", {
      content: {
        ...base.content,
        bars: [
          { label: "Before", value: 800, color: null },
          { label: "After", value: 200, color: null },
        ],
        suffix: "ms",
        ...overrides,
      },
      animations,
    });

  it("labels each bar and prints its value", () => {
    const text = paint(withBars(), 0).textContent ?? "";

    expect(text).toContain("Before");
    expect(text).toContain("800ms");
    expect(text).toContain("After");
    expect(text).toContain("200ms");
  });

  it("scales the longest bar to full length", () => {
    const heights = Array.from(paint(withBars(), 0).querySelectorAll("div[style*='height']"))
      .map((node) => (node as HTMLElement).style.height)
      .filter((height) => height.endsWith("%"));

    expect(heights).toContain("100%");
    expect(heights).toContain("25%");
  });

  it("never prints a figure the bar does not stand for", () => {
    const element = withBars({}, [count(30)]);
    const text = paint(element, 15).textContent ?? "";

    // Half way through the count: 400 and 100, not the stored 800 and 200.
    expect(text).toContain("400ms");
    expect(text).toContain("100ms");
    expect(text).not.toContain("800ms");
  });

  it("brings the bars in one at a time under a reveal", () => {
    const element = withBars({}, [reveal(30)]);
    const text = paint(element, 7).textContent ?? "";

    expect(text).toContain("0ms");
  });

  it("can run across instead of upwards", () => {
    const element = withBars({ orientation: "horizontal" });
    const widths = Array.from(paint(element, 0).querySelectorAll("div[style*='width']"))
      .map((node) => (node as HTMLElement).style.width)
      .filter((width) => width.endsWith("%"));

    expect(widths).toContain("100%");
  });

  it("can hide the values", () => {
    expect(paint(withBars({ showValues: false }), 0).textContent).not.toContain("800");
  });
});

describe("a comparison", () => {
  const base = make<ComparisonElement>("comparison");

  it("shows both column headings and every row", () => {
    const text = paint(base, 0).textContent ?? "";

    expect(text).toContain(base.content.leftTitle);
    expect(text).toContain(base.content.rightTitle);
    expect(text).toContain(base.content.rows[0].label);
    expect(text).toContain(base.content.rows[0].right);
  });

  it("keeps its headings while the rows are still arriving", () => {
    const element = make<ComparisonElement>("comparison", { animations: [reveal(30)] });
    // A half-built table with no headings reads as broken rather than as arriving.
    expect(paint(element, 0).textContent).toContain(base.content.leftTitle);
  });

  it("brings the rows in one at a time", () => {
    const element = make<ComparisonElement>("comparison", { animations: [reveal(30)] });
    const rows = Array.from(paint(element, 0).querySelectorAll("div[style*='opacity']"));
    const opacities = rows.map((row) => (row as HTMLElement).style.opacity).filter(Boolean);

    expect(opacities.some((opacity) => opacity === "0")).toBe(true);
  });

  it("tints only the favoured column", () => {
    const element = make<ComparisonElement>("comparison", {
      content: { ...base.content, favour: "right" },
    });

    const tinted = Array.from(paint(element, 0).querySelectorAll("span")).filter(
      (span) => (span as HTMLElement).style.backgroundColor !== "",
    );

    // One heading plus one cell per row.
    expect(tinted).toHaveLength(base.content.rows.length + 1);
  });
});

describe("a step sequence", () => {
  const base = make<StepsElement>("steps");

  it("shows every step's title and detail", () => {
    const text = paint(base, 0).textContent ?? "";

    for (const step of base.content.steps) {
      expect(text).toContain(step.title);
      expect(text).toContain(step.detail);
    }
  });

  it("numbers the steps from one, and can be asked not to", () => {
    expect(paint(base, 0).textContent).toContain("1");

    const plain = make<StepsElement>("steps", {
      content: { ...base.content, numbered: false },
    });
    const markers = Array.from(plain.content.steps.keys()).map((index) => String(index + 1));
    const text = paint(plain, 0).textContent ?? "";

    expect(markers.every((marker) => !text.includes(marker))).toBe(true);
  });

  it("walks down the steps under a reveal", () => {
    const element = make<StepsElement>("steps", { animations: [reveal(30)] });
    const first = paint(element, 0);
    const opacities = Array.from(first.querySelectorAll("div[style*='opacity']")).map(
      (node) => (node as HTMLElement).style.opacity,
    );

    expect(opacities.filter((opacity) => opacity === "0").length).toBeGreaterThan(0);
  });

  it("does not draw a rail before the first step or after the last", () => {
    const rails = Array.from(paint(base, 0).querySelectorAll("span[aria-hidden='true']"));
    const visible = rails.filter((rail) => (rail as HTMLElement).style.backgroundColor !== "transparent");

    // Three steps joined by two runs of rail, each drawn as two halves.
    expect(rails).toHaveLength(base.content.steps.length * 2);
    expect(visible).toHaveLength((base.content.steps.length - 1) * 2);
  });

  it("can be laid out across as a timeline", () => {
    const element = make<StepsElement>("steps", {
      content: { ...base.content, orientation: "horizontal" },
    });

    // The element's own root sits directly inside the wrapper that carries its id.
    const root = paint(element, 0).querySelector("[data-element-id] > div");
    expect((root as HTMLElement).style.flexDirection).toBe("row");

    const down = paint(base, 0).querySelector("[data-element-id] > div");
    expect((down as HTMLElement).style.flexDirection).toBe("column");
  });
});
