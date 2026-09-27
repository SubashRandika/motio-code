import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility, checked in a browser because that is the only place most of it
 * exists. Contrast needs computed styles, a focus ring needs a rendered outline,
 * and a skip link needs a real viewport to be off-screen in -- jsdom has no
 * layout engine and reports none of it.
 *
 * Two kinds of check live here, and they do different jobs:
 *
 * - The axe sweep catches the long tail of WCAG rule violations across a whole
 *   page. It is good at breadth and knows nothing about intent.
 * - The written specs below it check the things that are about this product:
 *   whether the skip link goes anywhere, whether the sign-in form can be
 *   completed without a pointer, whether a focused control is visibly focused.
 *
 * Neither replaces using a screen reader. A page can satisfy every rule here and
 * still be miserable to listen to, which is why the store of real judgement is
 * in the component tests and the code comments rather than in a score.
 */

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password"] as const;

/**
 * Contrast is checked in both places on purpose, because each catches what the
 * other cannot. tests/core/contrast.test.ts measures every design token against
 * every surface it is painted on, including combinations that happen not to be
 * on screen. axe measures what is actually rendered, which is the only way to
 * catch a blended colour -- `text-paper/85`, a one-off hex in the hero -- that
 * no token describes.
 */
function builder(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
}

/**
 * The landing page's hero is excluded, and only from this sweep.
 *
 * It is a mock video: a real MotioCode timeline that loops forever, fading its
 * panel in from nothing at the start of every cycle. axe samples whatever
 * opacity it catches, so it reports the code inside the panel as failing
 * contrast a fraction of the time -- which is true of any frame of any video
 * mid-fade, and is not what 1.4.3 is about. The frames are the illustration, not
 * the page's text; `<figcaption>` carries the text alternative, and the test
 * below asserts it is there so this exclusion has to stay earned.
 *
 * The tokens used inside it are still measured, statically and on every surface,
 * by tests/core/contrast.test.ts.
 */
const HERO = "[data-hero-composition]";

async function scan(page: Page) {
  return builder(page).exclude(HERO).analyze();
}

function describeViolations(violations: Awaited<ReturnType<typeof scan>>["violations"]) {
  return violations
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      return `${violation.id} (${violation.impact}): ${violation.help}\n    at ${where}`;
    })
    .join("\n");
}

test.describe("automated WCAG sweep", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.goto(path);
      const results = await scan(page);

      expect(describeViolations(results.violations)).toBe("");
    });
  }
});

test.describe("the landing page hero", () => {
  test("still carries a text alternative, which is why it is excluded above", async ({ page }) => {
    await page.goto("/");

    const caption = page.locator(`${HERO} figcaption`);
    await expect(caption).toHaveCount(1);
    expect((await caption.textContent())?.trim().length ?? 0).toBeGreaterThan(40);
  });

  test("passes every rule except the one its animation makes meaningless", async ({ page }) => {
    // Everything else about the hero is still checked: the transport buttons
    // have names, the timeline has structure, nothing inside it is unreachable.
    await page.goto("/");

    const results = await builder(page).include(HERO).disableRules(["color-contrast"]).analyze();

    expect(describeViolations(results.violations)).toBe("");
  });
});

test.describe("the skip link", () => {
  // A skip link that points at nothing is the most common accessibility feature
  // to be present and broken, because it is invisible until focused and so never
  // gets clicked by the person who added it.
  for (const path of PUBLIC_PAGES) {
    test(`reaches the main landmark on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press("Tab");

      const skip = page.getByRole("link", { name: /Skip to content/i });
      await expect(skip).toBeFocused();

      // Hidden until focused, and genuinely on screen once it is -- not merely
      // present with a class that was supposed to reveal it.
      await expect(skip).toBeInViewport();

      const target = await skip.getAttribute("href");
      expect(target).toBe("#main");
      await expect(page.locator("#main")).toHaveCount(1);
    });
  }

  test("moves reading position past the header", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    expect(new URL(page.url()).hash).toBe("#main");
  });
});

test.describe("page structure", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has one h1 and no skipped heading levels`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator("h1")).toHaveCount(1);

      // A jump from h1 straight to h3 tells a screen-reader user a section is
      // nested inside something that is not there.
      const levels = await page
        .locator("h1, h2, h3, h4, h5, h6")
        .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName[1])));

      let previous = levels[0];
      for (const level of levels.slice(1)) {
        expect(level, `heading order on ${path}: ${levels.join(" → ")}`).toBeLessThanOrEqual(
          previous + 1,
        );
        previous = level;
      }
    });
  }

  test("declares its language, so a screen reader picks the right voice", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("keyboard only", () => {
  test("signs in without a pointer", async ({ page }) => {
    // Not whether the inputs exist -- whether they can be reached in order and
    // filled, which is the whole of WCAG 2.1.1 for this form.
    await page.goto("/login");

    await page.getByLabel("Email").focus();
    await page.keyboard.type("someone@example.com");
    await page.keyboard.press("Tab");
    await page.keyboard.type("a-password");

    await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
    await expect(page.getByLabel("Password")).toHaveValue("a-password");

    // Tab from the password field must reach the submit button, possibly via a
    // "forgot password" link, without leaving the form.
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press("Tab");
      if (await page.getByRole("button", { name: "Sign in" }).evaluate(
        (button) => button === document.activeElement,
      )) {
        return;
      }
    }
    throw new Error("Tab never reached the Sign in button from the password field.");
  });

  test("shows a focus ring on every control it can reach", async ({ page }) => {
    // The focus ring is the only thing telling a keyboard user where they are.
    // One missing `outline: none` somewhere is enough to lose them.
    await page.goto("/login");

    const focusable = page.locator(
      // `[type=hidden]` is excluded because it is not focusable at all -- the
      // login form carries the redirect target in one.
      "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea",
    );
    const count = await focusable.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const control = focusable.nth(index);
      await control.focus();

      const ring = await control.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          boxShadow: style.boxShadow,
          borderColor: style.borderColor,
        };
      });

      const hasOutline = ring.outlineStyle !== "none" && ring.outlineWidth > 0;
      const hasShadow = ring.boxShadow !== "none" && ring.boxShadow !== "";
      const description = await control.evaluate(
        (node) => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}`,
      );

      expect(hasOutline || hasShadow, `no visible focus on ${description}`).toBe(true);
    }
  });

  test("does not trap focus anywhere on the page", async ({ page }) => {
    await page.goto("/signup");

    const seen = new Set<string>();
    let repeats = 0;

    // Tab all the way round. Landing on the same element twice in a row, away
    // from the start, means focus is stuck.
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press("Tab");
      const here = await page.evaluate(() => {
        const node = document.activeElement;
        if (!node || node === document.body) return "body";
        return `${node.tagName}:${node.getAttribute("name") ?? node.textContent?.slice(0, 20) ?? ""}`;
      });

      if (seen.has(here)) repeats += 1;
      seen.add(here);
    }

    // Having cycled at least once is expected; never moving at all is not.
    expect(seen.size).toBeGreaterThan(3);
    expect(repeats).toBeLessThan(38);
  });
});

test.describe("reduced motion", () => {
  test("holds the hero on its finished frame instead of looping", async ({ page }) => {
    // The landing page animation is a real timeline that loops forever. For a
    // viewer who asked for less motion it settles on the last frame, which is
    // both the accessible behaviour and the better first impression.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const timecode = page.locator("figure").getByText(/\d+:\d+/).first();
    await expect(timecode).toBeVisible();

    const first = await timecode.textContent();
    await expect(async () => {
      expect(await timecode.textContent()).toBe(first);
    }).toPass({ timeout: 3_000 });
  });

  test("still lets the viewer start it deliberately", async ({ page }) => {
    // Reduced motion is a default, not a prohibition: asking for the animation
    // explicitly has to still work.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await page.getByRole("button", { name: "Play the demo" }).click();
    await expect(page.getByRole("button", { name: "Pause the demo" })).toBeVisible();
  });
});
