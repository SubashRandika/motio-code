import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test as setup } from "@playwright/test";

export const AUTH_STATE = "playwright/.auth/user.json";

/** An empty storage state, so a signed-out run still has a file to point at. */
function writeSignedOutState() {
  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  writeFileSync(AUTH_STATE, JSON.stringify({ cookies: [], origins: [] }), "utf8");
}

/**
 * Signs in once and saves the session for the authenticated specs to reuse, so
 * the §20 journey does not pay for a sign-in per test.
 *
 * Credentials come from the environment and are never committed. Without them
 * this writes a signed-out state and the authenticated specs skip themselves --
 * a missing test account should not look like a failing product.
 */
setup("sign in", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    writeSignedOutState();
    setup.skip(true, "Set E2E_EMAIL and E2E_PASSWORD to run the authenticated journey.");
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The dashboard is the proof the session is real; a failed sign-in stays put.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Projects/);

  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });

  if (!existsSync(AUTH_STATE)) throw new Error("Signed in, but the session was not saved.");
});
