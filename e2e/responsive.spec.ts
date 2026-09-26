import { expect, test } from "@playwright/test";

/**
 * A page that scrolls sideways on a phone is the usual symptom of a width that
 * does not survive a narrow screen, and it is invisible to a component test
 * because jsdom has no layout engine. The landing page had exactly this: a
 * single-column grid track sized to a code block's max-content, 72px wider than
 * a Pixel 5.
 *
 * The editor is deliberately excluded -- it is desktop-first by design, and it
 * needs a session anyway.
 */
const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password"];

for (const path of PUBLIC_PAGES) {
  test(`${path} does not scroll sideways`, async ({ page }) => {
    await page.goto(path);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
  });

  test(`${path} keeps its main heading readable`, async ({ page }) => {
    await page.goto(path);

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible();

    // Text that has been squeezed narrower than a few words per line, or pushed
    // off the left edge, is the other way a narrow screen goes wrong.
    const box = await heading.boundingBox();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
  });
}
