import { expect, test } from "@playwright/test";

test("opens the shop at the top after scrolling the homepage", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.getByRole("link", { name: /shop bouquets/i }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBe(0);
});

test("keeps the transition frame mounted while the next route loads", async ({ page }) => {
  await page.goto("/");
    await page.getByRole("link", { name: /^our story$/i }).first().click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator(".route-frame")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/extraordinary/i);
});

test("browser back restores the previous scroll position", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const previousPosition = await page.evaluate(() => window.scrollY);

  await page.getByRole("link", { name: /^our story$/i }).first().click();
    await expect(page).toHaveURL(/\/about$/);
  
    await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBeGreaterThan(previousPosition - 80);
});

test("direct URL access and refresh keep the destination page", async ({ page }) => {
  await page.goto("/delivery");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/delivery/i);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/delivery/i);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});