import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Colour contrast, checked against the stylesheet rather than a copy of it.
 *
 * This exists because the failure it guards against is silent. A designer
 * nudging a grey a shade darker sees a slightly calmer interface; a user with
 * low vision loses the frame counts, the durations and the element counts
 * entirely. Nothing in a screenshot, a type check or a component test notices.
 *
 * The tokens are parsed out of `globals.css` so this cannot drift from what
 * actually ships -- a duplicated palette here would pass forever while the real
 * one regressed.
 */
const CSS = readFileSync(join(import.meta.dirname, "../../app/globals.css"), "utf8");

function tokens(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, value] of CSS.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    found[name] = value;
  }
  return found;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every surface a token is painted on. `raised` is the lightest, so it decides. */
const SURFACES = ["ink", "ink-sunk", "panel", "raised"] as const;

describe("the palette in globals.css", () => {
  const palette = tokens();

  it("defines every token the tests below rely on", () => {
    for (const name of [...SURFACES, "mist", "mist-dim", "paper", "edge", "amber", "cyan"]) {
      expect(palette[name], `--color-${name} is missing`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  /**
   * 4.5:1 is the AA threshold for normal text, and all three of these carry
   * normal text -- `mist-dim` in particular is used at 10.5px, which is nowhere
   * near the 24px that would let it use the 3:1 large-text threshold instead.
   */
  describe("text passes AA on every surface it is used on", () => {
    for (const name of ["mist-dim", "mist", "paper"] as const) {
      for (const surface of SURFACES) {
        it(`${name} on ${surface}`, () => {
          expect(contrast(palette[name], palette[surface])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  /**
   * The text ramp has to stay a ramp. Making `mist-dim` legible is pointless if
   * it ends up indistinguishable from `mist`, because then the interface has one
   * grey pretending to be two and the hierarchy the design depends on is gone.
   */
  it("keeps three distinguishable steps of emphasis", () => {
    const dim = contrast(palette["mist-dim"], palette.panel);
    const mid = contrast(palette.mist, palette.panel);
    const bright = contrast(palette.paper, palette.panel);

    expect(mid).toBeGreaterThan(dim * 1.2);
    expect(bright).toBeGreaterThan(mid * 1.2);
  });

  /**
   * WCAG 1.4.11: the visual boundary of a control needs 3:1 against what is
   * behind it. A text field here is `bg-ink-sunk` on `bg-panel`, and those two
   * are 1.12:1 apart -- so the fill cannot be what identifies the control and
   * the whole job falls to the border.
   */
  it("gives form controls a border that can actually be seen", () => {
    for (const surface of ["ink", "panel", "raised"] as const) {
      expect(contrast(palette.edge, palette[surface]), `edge on ${surface}`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("does not let the fill of a control be mistaken for its boundary", () => {
    // Documents the measurement the `edge` token exists because of. If a future
    // change makes the fill itself a 3:1 boundary, this test should be revisited
    // rather than deleted.
    expect(contrast(palette["ink-sunk"], palette.panel)).toBeLessThan(3);
  });

  /**
   * The focus ring is the single most important non-text contrast in a keyboard
   * interface: it is the only thing telling someone where they are.
   */
  it("gives the focus ring 3:1 against every surface", () => {
    for (const surface of SURFACES) {
      expect(contrast(palette.amber, palette[surface]), `amber on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps amber legible as a button fill, where ink is the text", () => {
    expect(contrast(palette.ink, palette.amber)).toBeGreaterThanOrEqual(4.5);
  });

  /** The two status colours carry words, not just decoration. */
  it("keeps status text readable", () => {
    for (const name of ["danger", "ok", "cyan"] as const) {
      for (const surface of SURFACES) {
        expect(contrast(palette[name], palette[surface]), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
