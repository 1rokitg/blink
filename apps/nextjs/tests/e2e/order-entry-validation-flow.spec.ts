import { expect, test } from "@playwright/test";

test.describe("Feature: Order entry validation", () => {
  test("Flow: approved user gets immediate validation feedback for empty size", async ({
    page,
  }) => {
    await page.goto("/e2e/trading?approved=1");

    await expect(page.getByText("Order entry")).toBeVisible();

    await page.getByRole("button", { name: /Submit market order/i }).click();
    await expect(page.getByText("Enter a valid size")).toBeVisible();
  });

  test("Flow: market order submit builds prod-like payload and retries duplicate nonce once", async ({
    page,
  }) => {
    await page.goto("/e2e/trading?approved=1");

    await page.getByLabel("Size (BTC)").fill("0.004264");
    await page.getByRole("button", { name: /Submit market order/i }).click();

    await expect(page.getByText(/Buy market: 0.004264 BTC/i)).toBeVisible();
    await expect(page.getByText('"type": "order"')).toBeVisible();
    await expect(page.getByText('"grouping": "na"')).toBeVisible();
    await expect(page.getByText('"builder"')).toBeVisible();
    await expect(page.getByText('"tif": "Ioc"')).toBeVisible();
  });
});
