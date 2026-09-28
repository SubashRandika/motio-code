import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

/**
 * Regenerates the screenshots in the README.
 *
 *   pnpm build && pnpm exec next start --port 3200
 *   pnpm screenshots
 *
 * Reduced motion is emulated throughout, which is not a compromise here -- the
 * landing page's composition is a real timeline that loops, and holding it on
 * its final frame is exactly the moment worth capturing: the code fully
 * revealed, the line highlighted, the callout in place. Without it the shot
 * lands on whatever frame the page happened to be showing, often mid-fade.
 *
 * The signed-in pages need a real account. Set E2E_EMAIL and E2E_PASSWORD (the
 * same throwaway account the authenticated Playwright specs use) and they are
 * captured too; without them the script says what it skipped rather than
 * failing, so the public shots can always be regenerated.
 */
const BASE_URL = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:3200";
const OUT = "docs/screenshots";

const shots: { name: string; note: string }[] = [];

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    // Retina, so the image still reads on a high-density display.
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });

  const page = await context.newPage();

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/landing.png` });
  shots.push({ name: "landing.png", note: "the marketing page" });

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    console.log("\nSkipped the signed-in screenshots: set E2E_EMAIL and E2E_PASSWORD to include");
    console.log("the dashboard and the editor. Use a throwaway account, not your own.");
  } else {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: `${OUT}/dashboard.png` });
    shots.push({ name: "dashboard.png", note: "the project dashboard" });

    // Whichever project is first; the editor looks like the editor either way.
    const projectLink = page.locator('a[href*="/editor"]').first();

    if (await projectLink.count()) {
      await projectLink.click();
      await page.waitForURL(/\/editor/, { timeout: 30_000 });
      // The canvas fits itself with a ResizeObserver; give it a frame to settle.
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: `${OUT}/editor.png` });
      shots.push({ name: "editor.png", note: "the editor" });
    } else {
      console.log("\nNo projects on that account, so the editor was not captured.");
    }
  }

  await browser.close();

  console.log(`\nWrote ${shots.length} screenshot(s) to ${OUT}/`);
  for (const shot of shots) console.log(`  ${shot.name}  -- ${shot.note}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
