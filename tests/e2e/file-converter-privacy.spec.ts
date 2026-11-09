import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE,
    firefoxUserPrefs: { "privacy.resistFingerprinting": true },
  },
});

test("explains the site permission instead of offering a corrupted JPG", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/tools/file-converter");
  await page.locator('input[type="file"]').setInputFiles({
    name: "color-blocks.png",
    mimeType: "image/png",
    buffer: await readFile(new URL("../fixtures/color-blocks.png", import.meta.url)),
  });
  await page.getByRole("combobox", { name: "Convert to", exact: true }).click();
  await page.getByRole("option", { name: "JPG", exact: true }).click();
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(page.getByText(/Your browser is blocking accurate image export/)).toBeVisible();
  await expect(page.getByText(/Extract Canvas Data/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Download/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Convert files", exact: true })).toBeEnabled();
  expect(errors, "Unexpected browser errors").toEqual([]);
});
