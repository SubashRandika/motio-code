import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Error pages are the ones nobody looks at until they are needed, which is
 * exactly why they rot. They are also where an accessibility or layout mistake
 * hurts most: someone reaching one is already stuck, and a page with no way out
 * leaves them stuck for good.
 *
 * What a browser can settle that a component test cannot: the real status code,
 * whether the root layout still applies, and whether the page is reachable and
 * navigable once it renders.
 */
test.describe("the not-found page", () => {
  test("answers 404 rather than pretending the page exists", async ({ page }) => {
    // A soft 404 -- a 200 with "not found" written on it -- tells crawlers and
    // monitoring that a broken link is fine.
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
  });

  test("explains what happened and offers a way out", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The way out is the point. A dead end here means the browser's back button
    // is the only exit.
    await expect(page.getByRole("link", { name: /projects/i })).toBeVisible();
  });

  test("keeps the branding, so it does not look like a different site", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(page.getByRole("link", { name: /MotioCode/i }).first()).toBeVisible();
  });

  test("is still a landmark the skip link can reach", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(page.locator("#main")).toHaveCount(1);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Skip to content/i })).toBeFocused();
  });

  test("has no accessibility violations", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
    ).toBe("");
  });
});

test.describe("a project that is not yours", () => {
  test("is not distinguishable from one that does not exist", async ({ page }) => {
    // Signed out, so this proves the route is gated before anything leaks. The
    // same id signed-in as another user returns the 404 page rather than a
    // "forbidden", which is what stops the app confirming a project exists.
    await page.goto("/projects/3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11/editor");

    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
