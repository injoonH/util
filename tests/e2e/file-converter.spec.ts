import { readFile } from "node:fs/promises";
import { type Download, expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/tools/file-converter");
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], "Unexpected browser errors").toEqual([]);
});

async function imageFixture(
  page: Page,
  name = "photo.png",
  type = "image/png",
  transparent = false,
  size: [number, number] = [8, 4],
) {
  const encoded = await page.evaluate(
    ({ type, transparent, size }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size[0];
      canvas.height = size[1];
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, transparent ? canvas.width / 2 : canvas.width, canvas.height);
      return canvas.toDataURL(type).split(",")[1];
    },
    { type, transparent, size },
  );
  return { name, mimeType: type, buffer: Buffer.from(encoded, "base64") };
}

async function pdfFixture(count = 2) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < count; index++) {
    const page = document.addPage([100, 60]);
    page.drawRectangle({
      width: 100,
      height: 60,
      color: index % 2 ? rgb(0, 1, 0) : rgb(1, 0, 0),
    });
    page.drawText(`Page ${index + 1}`, { x: 5, y: 5, size: 8, font });
  }
  return {
    name: "pages.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  };
}

async function selectFormat(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Convert to", exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function downloadBytes(page: Page, buttonName: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  return readDownload(await pending);
}

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(await download.failure()).toBeNull();
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

async function inspectImage(page: Page, bytes: Uint8Array, x = 1, y = 1) {
  return page.evaluate(
    async ({ data, x, y }) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(bitmap, 0, 0);
      const result = {
        width: bitmap.width,
        height: bitmap.height,
        pixel: Array.from(context.getImageData(x, y, 1, 1).data),
      };
      bitmap.close();
      return result;
    },
    { data: Array.from(bytes), x, y },
  );
}

test("JPG becomes a genuine PNG with the original dimensions and colors", async ({ page }) => {
  const file = await imageFixture(page, "photo.jpg", "image/jpeg");
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const { name, bytes } = await downloadBytes(page, "Download photo.png");
  expect(name).toBe("photo.png");
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const image = await inspectImage(page, bytes);
  expect([image.width, image.height]).toEqual([8, 4]);
  expect(image.pixel[0]).toBeGreaterThan(245);
  expect(image.pixel[1]).toBeLessThan(10);
  expect(image.pixel[3]).toBe(255);
});

test("PNG transparency becomes white in JPG, and WebP exports its real format", async ({
  page,
}) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles(await imageFixture(page, "alpha.png", "image/png", true));
  await selectFormat(page, "JPG");
  await page.getByRole("spinbutton", { name: "Quality (%)", exact: true }).fill("100");
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const jpeg = await downloadBytes(page, "Download alpha.jpg");
  expect(jpeg.bytes.subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
  const white = await inspectImage(page, jpeg.bytes, 7, 1);
  expect(white.pixel.slice(0, 3).every((channel) => channel >= 245)).toBe(true);
  expect(white.pixel[3]).toBe(255);
  await selectFormat(page, "WebP");
  await expect(page.getByRole("list", { name: "Converted files" })).toHaveCount(0);
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const webp = await downloadBytes(page, "Download alpha.webp");
  expect(webp.bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(webp.bytes.subarray(8, 12).toString()).toBe("WEBP");
  expect((await inspectImage(page, webp.bytes, 7, 1)).pixel[3]).toBe(0);
});

test("PDF pages render locally and ZIP downloads contain every real page image", async ({
  page,
}) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.locator('input[type="file"]').setInputFiles(await pdfFixture());
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Converted files" }).getByRole("listitem"),
  ).toHaveCount(2);
  const { name, bytes } = await downloadBytes(page, "Download ZIP");
  expect(name).toBe("converted-files.zip");
  const entries = unzipSync(bytes);
  expect(Object.keys(entries)).toEqual(["pages-page-001.png", "pages-page-002.png"]);
  const first = await inspectImage(page, entries["pages-page-001.png"], 100, 60);
  const second = await inspectImage(page, entries["pages-page-002.png"], 100, 60);
  expect([first.width, first.height]).toEqual([200, 120]);
  expect(first.pixel).toEqual([255, 0, 0, 255]);
  expect(second.pixel).toEqual([0, 255, 0, 255]);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
  expect(requests.filter((request) => new URL(request.url).origin !== origin)).toEqual([]);
});

test("PDF page selection validates ranges and clears outdated downloads", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles(await pdfFixture());
  await page.getByRole("textbox", { name: "Pages", exact: true }).fill("2");
  await page.getByRole("combobox", { name: "Resolution", exact: true }).click();
  await page.getByRole("option", { name: "72 DPI · Standard", exact: true }).click();
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const { bytes } = await downloadBytes(page, "Download pages-page-002.png");
  const image = await inspectImage(page, bytes, 50, 30);
  expect([image.width, image.height]).toEqual([100, 60]);
  expect(image.pixel).toEqual([0, 255, 0, 255]);
  await page.getByRole("textbox", { name: "Pages", exact: true }).fill("3");
  await expect(page.getByRole("list", { name: "Converted files" })).toHaveCount(0);
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(page.getByText(/Choose page numbers between 1 and 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Download/ })).toHaveCount(0);
});

test("images combine into a readable PDF in source order", async ({ page }) => {
  const png = await imageFixture(page, "first.png");
  const jpeg = await imageFixture(page, "second.jpg", "image/jpeg", false, [4, 8]);
  await page.locator('input[type="file"]').setInputFiles([png, jpeg]);
  await selectFormat(page, "PDF");
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const { bytes } = await downloadBytes(page, "Download converted-images.pdf");
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(2);
  expect(document.getPages().map((page) => page.getSize())).toEqual([
    { width: 8, height: 4 },
    { width: 4, height: 8 },
  ]);
});

test("protected PDFs require the right password and clear it after conversion", async ({
  page,
}) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "protected.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(new URL("../fixtures/password-protected.pdf", import.meta.url)),
  });
  const convert = page.getByRole("button", { name: "Convert files", exact: true });
  await convert.click();
  await expect(page.getByText(/This PDF needs a password/)).toBeVisible();
  const password = page.getByLabel("PDF password (if needed)", { exact: true });
  await password.fill("incorrect-test-password");
  await convert.click();
  await expect(page.getByText(/This PDF needs a password/)).toBeVisible();
  await password.fill("converter-test-password");
  await convert.click();
  const { bytes } = await downloadBytes(page, "Download protected-page-001.png");
  expect((await inspectImage(page, bytes)).pixel).toEqual([255, 255, 255, 255]);
  await expect(password).toHaveValue("");
});

test("bad files report errors while duplicate image names remain downloadable", async ({
  page,
}) => {
  const first = await imageFixture(page, "photo.jpg", "image/jpeg");
  const second = await imageFixture(page, "photo.png");
  await page
    .locator('input[type="file"]')
    .setInputFiles([
      first,
      second,
      { name: "renamed.jpg", mimeType: "image/jpeg", buffer: Buffer.from("plain text") },
      { name: "damaged.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nbroken") },
    ]);
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(page.getByText(/Unsupported or damaged file/)).toBeVisible();
  await expect(
    page.getByText("This PDF is damaged or could not be read.", { exact: true }),
  ).toBeVisible();
  const { bytes } = await downloadBytes(page, "Download ZIP");
  expect(Object.keys(unzipSync(bytes))).toEqual(["photo.png", "photo (2).png"]);
  await page.getByRole("button", { name: "Clear files", exact: true }).click();
  await expect(page.getByRole("list", { name: "Selected files" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Converted files" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Convert files", exact: true })).toBeDisabled();
});

test("invalid quality does not prevent PNG export after switching format", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles(await imageFixture(page));
  await selectFormat(page, "JPG");
  await page.getByRole("spinbutton", { name: "Quality (%)", exact: true }).fill("101");
  await expect(page.getByRole("button", { name: "Convert files", exact: true })).toBeDisabled();
  await selectFormat(page, "PNG");
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download photo.png", exact: true })).toBeVisible();
});

test("cancelling a PDF conversion stops further pages and keeps completed files", async ({
  page,
}) => {
  await page.locator('input[type="file"]').setInputFiles(await pdfFixture(100));
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  const results = page.getByRole("list", { name: "Converted files" }).getByRole("listitem");
  await expect(results.first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conversion stopped." })).toBeVisible();
  const count = await results.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(100);
  await expect(page.getByRole("button", { name: "Convert files", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "Pages", exact: true }).fill("100");
  await expect(results).toHaveCount(0);
  await page.getByRole("button", { name: "Convert files", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download pages-page-100.png", exact: true }),
  ).toBeVisible();
  await expect(results).toHaveCount(1);
});
