import { expect, test, type Page } from "@playwright/test";

async function fillTopic(page: Page, value: string): Promise<void> {
  // Champ sujet : textarea ou input, repéré de façon flexible.
  const byLabel = page.getByLabel(/sujet|topic/i).first();
  if (await byLabel.count()) {
    await byLabel.fill(value);
    return;
  }
  const candidate = page
    .locator('textarea, input[type="text"], input:not([type])')
    .first();
  await candidate.fill(value);
}

test.describe("studio", () => {
  test("charge la page du studio", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("génère un storyboard et affiche la preview", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/studio");
    await fillTopic(page, "Les bienfaits du sommeil profond");

    await page.getByRole("button", { name: /générer/i }).first().click();

    // La preview est rendue dans un iframe.
    const iframe = page.locator("iframe").first();
    await expect(iframe).toBeVisible({ timeout: 20_000 });

    // L'éditeur de storyboard montre au moins 3 scènes.
    const sceneCards = page.locator('[data-testid="scene-card"]');
    await expect
      .poll(async () => sceneCards.count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(3);

    // Lecture : le bouton play ne fait pas crasher la page.
    const playButton = page.getByRole("button", { name: /lire|play|lecture/i }).first();
    if (await playButton.count()) {
      await playButton.click();
      await page.waitForTimeout(1_500);
    }

    expect(consoleErrors).toEqual([]);
  });
});
