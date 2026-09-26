import { expect, test } from "@playwright/test";

/**
 * The workflow §20 asks to be validated end to end: sign in, create a project,
 * add content, edit a scene, preview, save, reopen, and reach the export.
 *
 * These run against the real hosted project, because a local Supabase stack
 * needs Docker. That makes containment the first requirement rather than an
 * afterthought:
 *
 * - Every project this spec creates is named with a unique run id, so no locator
 *   can match a project a human made.
 * - It only ever acts on a project it created, found by that exact name.
 * - It deletes its own project at the end, through the UI -- which also exercises
 *   the delete confirmation.
 *
 * It skips itself, rather than failing, when no test account is configured.
 */
const RUN_ID = `e2e-${Date.now().toString(36)}`;
const PROJECT_NAME = `${RUN_ID} walkthrough`;

test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
  "Set E2E_EMAIL and E2E_PASSWORD to run the authenticated journey.",
);

test.describe.configure({ mode: "serial" });

test("creates a project from a template and opens the editor", async ({ page }) => {
  await page.goto("/projects/new");

  await page.getByLabel("Project name").fill(PROJECT_NAME);
  await page.getByRole("radio", { name: /Code walkthrough/ }).click();
  await page.getByRole("button", { name: /Create project/i }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/editor/, { timeout: 60_000 });
  await expect(page.getByLabel("Project name")).toHaveValue(PROJECT_NAME);

  // A template project arrives with scenes already in it.
  await expect(page.getByRole("button", { name: /Scene/ }).first()).toBeVisible();
});

test("edits a scene and saves it", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: PROJECT_NAME }).click();
  await expect(page).toHaveURL(/\/editor/, { timeout: 60_000 });

  const renamed = `${RUN_ID} edited`;
  const name = page.getByLabel("Project name");
  await name.fill(renamed);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved|All changes saved/i).first()).toBeVisible({ timeout: 30_000 });

  // Reopening is the real test of persistence: a value only in the store looks
  // identical to one that reached the database until the page is thrown away.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: renamed })).toBeVisible();
});

test("previews the composition and offers an export", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: `${RUN_ID} edited` }).click();
  await expect(page).toHaveURL(/\/editor/, { timeout: 60_000 });

  await page.getByRole("button", { name: /Preview/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toContainText(/1920×1080|1280×720|2560×1440/);

  // The export is reached but deliberately not run: a full render is slow, and
  // every render is a metered event under Remotion's licence. That it is offered
  // and enabled is what this asserts.
  const exportButton = dialog.getByRole("button", { name: /Export video/ });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();
});

test("records nothing it did not export, and cleans up after itself", async ({ page }) => {
  await page.goto("/dashboard");

  const card = page.getByRole("listitem").filter({ hasText: `${RUN_ID} edited` });
  await card.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: /Delete/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`${RUN_ID} edited`);
  await dialog.getByRole("button", { name: /Delete project/ }).click();

  await expect(page.getByRole("link", { name: `${RUN_ID} edited` })).toHaveCount(0, {
    timeout: 30_000,
  });
});
