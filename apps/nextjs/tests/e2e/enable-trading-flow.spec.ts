import { expect, test } from "@playwright/test";

test.describe("Feature: Enable Trading setup", () => {
  test("Flow: non-approved user is auto-prompted for setup", async ({ page }) => {
    await page.goto("/e2e/trading?approved=0");

    await expect(
      page.getByText("One-time setup required to route trades on Hyperliquid."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enable Trading" })).toBeVisible();
    await expect(page.getByText("2 signatures needed")).toBeVisible();
    await expect(page.getByText("Approve Builder Fee")).toBeVisible();
    await expect(page.getByText("Approve Agent Key")).toBeVisible();
  });
});
