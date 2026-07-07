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

test.describe("studio — édition et export", () => {
  test("éditer une scène recompile la preview, sous-titres et exports fonctionnent", async ({ page }) => {
    await page.goto("/studio");
    await fillTopic(page, "Les vertus du batch cooking");
    await page.getByRole("button", { name: /générer/i }).first().click();

    const iframe = page.locator("iframe").first();
    await expect(iframe).toBeVisible({ timeout: 20_000 });

    // 1. Édition : changer le titre de la première scène (hook) → la preview recompile.
    const titleInput = page
      .locator('[data-testid="scene-card"]')
      .first()
      .getByLabel(/titre/i)
      .first();
    await titleInput.fill("Titre modifié par le test E2E");
    await expect
      .poll(async () => (await iframe.getAttribute("srcdoc")) ?? "", { timeout: 10_000 })
      .toContain("Titre modifié par le test E2E");

    // 2. Sous-titres : le toggle injecte la piste de narration.
    await page.getByRole("checkbox", { name: /sous-titres/i }).check();
    await expect
      .poll(async () => (await iframe.getAttribute("srcdoc")) ?? "", { timeout: 10_000 })
      .toContain('class="clip caption-clip"');

    // 3. Export : téléchargement du HTML autonome et du storyboard JSON.
    const htmlDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /télécharger html/i }).click();
    expect((await htmlDownload).suggestedFilename()).toMatch(/\.html$/);

    const jsonDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /storyboard \.json/i }).click();
    expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  });
});

test.describe("studio — mode IA", () => {
  test("le toggle IA utilise /api/generate et le storyboard IA remplace le local", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      const body = route.request().postDataJSON() as { brief: { durationSec: number } };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          storyboard: {
            id: "cf-e2e-ia",
            title: "Storyboard mocké par l'IA",
            brief: { ...body.brief, topic: "Storyboard mocké par l'IA" },
            theme: "midnight",
            aspect: "16:9",
            fps: 30,
            width: 1920,
            height: 1080,
            durationSec: 10,
            version: 1,
            scenes: [
              { id: "scene-1", type: "hook", start: 0, duration: 4, narration: "n1", title: "Titre IA mocké E2E" },
              { id: "scene-2", type: "cta", start: 4, duration: 6, narration: "n2", title: "CTA IA" },
            ],
          },
        },
      });
    });

    await page.goto("/studio");
    await fillTopic(page, "Un sujet quelconque");
    await page.getByRole("checkbox", { name: /écrire le script avec l'ia/i }).check();
    await page.getByRole("button", { name: /générer/i }).first().click();

    await expect(page.getByRole("status")).toContainText(/écrit par l'IA/i, { timeout: 10_000 });
    const iframe = page.locator("iframe").first();
    await expect
      .poll(async () => (await iframe.getAttribute("srcdoc")) ?? "", { timeout: 10_000 })
      .toContain("Titre IA mocké E2E");
  });

  test("repli heuristique propre quand l'API répond 501", async ({ page }) => {
    await page.route("**/api/generate", (route) =>
      route.fulfill({ status: 501, contentType: "application/json", json: { error: "AI_MODE_UNAVAILABLE" } }),
    );
    await page.goto("/studio");
    await fillTopic(page, "Le compost en appartement");
    await page.getByRole("checkbox", { name: /écrire le script avec l'ia/i }).check();
    await page.getByRole("button", { name: /générer/i }).first().click();

    await expect(page.getByRole("status")).toContainText(/génération locale/i, { timeout: 10_000 });
    // Le storyboard heuristique est bien là malgré le 501.
    await expect(page.locator('[data-testid="scene-card"]').first()).toBeVisible();
  });
});

test.describe("studio — accessibilité du player", () => {
  test("scrubbing clavier sur la timeline et lecture à l'espace", async ({ page }) => {
    await page.goto("/studio");
    await fillTopic(page, "La navigation au clavier");
    await page.getByRole("button", { name: /générer/i }).first().click();
    await expect(page.locator("iframe").first()).toBeVisible({ timeout: 20_000 });

    // Timeline : rôle slider, flèches → la valeur bouge.
    const slider = page.getByRole("slider", { name: /position de lecture/i });
    await slider.focus();
    const before = Number(await slider.getAttribute("aria-valuenow"));
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await slider.getAttribute("aria-valuenow")))
      .not.toBe(before);

    // Lecture/pause : le bouton reflète l'état via son aria-label.
    const playButton = page.getByRole("button", { name: /lecture|rejouer/i }).first();
    await playButton.click();
    await expect(page.getByRole("button", { name: /pause/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /pause/i }).click();
    await expect(page.getByRole("button", { name: /lecture|rejouer/i }).first()).toBeVisible();
  });
});
