import { expect, test } from "@playwright/test";

/**
 * Route protection lives in the proxy (middleware), which only runs for a real
 * request. Nothing in the unit or component suites can reach it, and a mistake
 * here exposes every authenticated page -- so it is checked from a browser.
 */
const PROTECTED = [
  "/dashboard",
  "/projects/new",
  "/projects/3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11/editor",
  "/projects/3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11/settings",
  "/settings/profile",
];

test.describe("routes that require a session", () => {
  for (const path of PROTECTED) {
    test(`sends a signed-out visitor from ${path} to sign in`, async ({ page }) => {
      await page.goto(path);

      // The proxy encodes the destination once, e.g. ?next=%2Fdashboard.
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }

  test("remembers where the visitor was going", async ({ page }) => {
    await page.goto("/dashboard");

    // The form carries the destination, so signing in lands where they meant to go.
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
  });
});

test.describe("pages that need no session", () => {
  for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
    test(`serves ${path} directly`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : `${path}$`}`));
    });
  }
});

/**
 * The `next` parameter decides where a user lands after signing in, and it
 * arrives in a link anyone can send. If it can be pointed off-site it becomes a
 * phishing primitive: the victim starts on the real domain and finishes
 * somewhere else, already trusting the page.
 *
 * `safeRedirectPath` is unit-tested too, but only a browser settles what it
 * actually does with a rewritten path, so the payloads are checked here as well.
 */
test.describe("a crafted redirect target", () => {
  const PAYLOADS = [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/..//evil.example",
    "javascript:alert(1)",
  ];

  for (const payload of PAYLOADS) {
    test(`is not carried into the form: ${payload}`, async ({ page }) => {
      await page.goto(`/login?next=${encodeURIComponent(payload)}`);

      const next = page.locator('input[name="next"]');

      if (await next.count()) {
        const value = await next.inputValue();
        expect(value).toBe("/dashboard");
      }

      // Whatever happened, the visitor is still on this origin.
      expect(page.url().startsWith("http://127.0.0.1:3100")).toBe(true);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }
});
