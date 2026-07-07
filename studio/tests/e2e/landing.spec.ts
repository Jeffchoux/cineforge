import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("charge et affiche le titre principal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("mène au studio", async ({ page }) => {
    await page.goto("/");
    const studioLink = page.locator('a[href="/studio"]').first();
    await expect(studioLink).toBeVisible();
    await studioLink.click();
    await expect(page).toHaveURL(/\/studio/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
