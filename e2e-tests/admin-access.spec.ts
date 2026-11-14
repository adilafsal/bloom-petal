import { expect, test } from "@playwright/test";

test("rejects unauthenticated requests to admin APIs", async ({ request }) => {
  const response = await request.get("/api/admin/access");
  expect(response.status()).toBe(401);
});

test("redirects unauthenticated visitors away from admin pages", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});
