import { expect, test } from "@playwright/test";

test.describe("the landing page", () => {
  test("leads with what the product does and how to start", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bring Your Code and");
    await expect(page.getByRole("link", { name: /Start a project/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });

  test("names the three studios the MVP ships", async ({ page }) => {
    await page.goto("/");

    for (const studio of ["Code", "Diagrams", "Infographics"]) {
      await expect(page.getByRole("heading", { name: studio, exact: true })).toBeVisible();
    }
  });

  test("sends a visitor to sign-up", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Start a project/i }).first().click();

    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
