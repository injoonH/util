import { expect, type Page, test } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Error responses are expected in invalid/expired share scenarios.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], "Unexpected browser errors").toEqual([]);
});

test("editor panels resize by keyboard and preserve text across mobile layouts", async ({
  page,
}) => {
  await page.goto("/tools/markdown");
  const input = page.getByRole("textbox", { name: "Markdown source", exact: true });
  await input.fill("# A work in progress\n\nKeep this text through the resize.");
  const handle = page.getByRole("separator", {
    name: "Resize Markdown source and preview panels",
    exact: true,
  });
  await expect(handle).toBeVisible();
  const initialWidth = (await input.boundingBox())?.width;
  expect(initialWidth).toBeDefined();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await input.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialWidth ?? 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).toBeHidden();
  await expect(input).toHaveValue("# A work in progress\n\nKeep this text through the resize.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(handle).toBeVisible();
  await expect(input).toHaveValue("# A work in progress\n\nKeep this text through the resize.");
});

test("catalog search and favorites survive a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Base64 codec", exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "Search tools" }).fill("base64");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Base64 codec", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Base64 codec to favorites", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Base64 codec from favorites", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Base64 codec from favorites", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Favorites/ }).click();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Base64 codec", exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "Search tools" }).fill("nothing matches this search");
  await expect(page.getByRole("heading", { name: "No tools found", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Browse all tools", exact: true }).click();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(8);
});

test("the keyboard command palette opens a tool", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Find a tool" });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder("What would you like to do?").fill("epoch");
  await palette.getByRole("option", { name: /Timestamp converter/ }).click();

  await expect(page).toHaveURL(/\/tools\/timestamp$/);
  await expect(page.getByRole("heading", { name: "Timestamp converter", level: 1 })).toBeVisible();
  await expect(palette).toBeHidden();
  await page.getByRole("textbox", { name: "Unix seconds", exact: true }).fill("0");
  await expect(page.getByText("1970-01-01T00:00:00.000Z", { exact: true })).toBeVisible();
});

test("Base64 round trips Unicode and clears stale output for invalid input", async ({ page }) => {
  const text = "안녕하세요 👋 café";
  const encoded = Buffer.from(text, "utf8").toString("base64");
  await page.goto("/tools/base64");
  await page.getByRole("textbox", { name: "Text to encode" }).fill(text);
  await expect(page.getByRole("textbox", { name: "Conversion result" })).toHaveValue(encoded);

  await page.getByRole("button", { name: "Use result as input", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Decode", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("textbox", { name: "Base64 to decode" })).toHaveValue(encoded);
  await expect(page.getByRole("textbox", { name: "Conversion result" })).toHaveValue(text);

  await page.getByRole("textbox", { name: "Base64 to decode" }).fill("%%%");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Conversion result" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeDisabled();
});

test("JSON formatting and minification preserve numeric lexemes", async ({ page }) => {
  const input = '{"id":900719925474099312345,"amount":1.2300,"items":[true,null]}';
  await page.goto("/tools/json");
  await page.getByRole("textbox", { name: "JSON input", exact: true }).fill(input);
  const output = page.getByRole("textbox", { name: "JSON output", exact: true });
  await expect(output).toHaveValue(/900719925474099312345/);
  await expect(output).toHaveValue(/1\.2300/);
  await expect(output).toHaveValue(/\n/);

  await page.getByRole("tab", { name: "Minify", exact: true }).click();
  await expect(output).toHaveValue(input);
  await page.getByRole("textbox", { name: "JSON input", exact: true }).fill('{"id":}');
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(output).toHaveValue("");
});

test("Markdown renders GFM while ignoring HTML and blocking remote images", async ({ page }) => {
  let externalImageRequests = 0;
  await page.route("https://images.example.test/**", async (route) => {
    externalImageRequests += 1;
    await route.abort();
  });
  await page.goto("/tools/markdown");
  await page
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill(
      [
        "# Safe preview",
        "",
        "**Still bold.**",
        "",
        "- [x] A completed task",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Example | 42 |",
        "",
        '<script>document.documentElement.dataset.markdownExecuted = "yes"</script>',
        '<img src="https://images.example.test/raw.png" onerror="document.documentElement.dataset.markdownExecuted = \'yes\'">',
        "",
        "![Remote photo](https://images.example.test/markdown.png)",
        "",
        "[Unsafe link](javascript:alert%281%29)",
      ].join("\n"),
    );

  const preview = page.getByRole("region", { name: "Markdown preview", exact: true });
  await expect(preview.getByRole("heading", { name: "Safe preview" })).toBeVisible();
  await expect(preview.getByRole("table")).toBeVisible();
  await expect(preview.getByRole("checkbox")).toBeChecked();
  await expect(preview.getByText(/Remote photo — enable/)).toBeVisible();
  await expect(preview.locator("script, iframe, object, img")).toHaveCount(0);
  await expect(preview.getByText("Unsafe link", { exact: true })).not.toHaveAttribute(
    "href",
    /^javascript:/i,
  );
  expect(
    await page.evaluate(() => document.documentElement.dataset.markdownExecuted),
  ).toBeUndefined();
  expect(externalImageRequests).toBe(0);
});

test("clipboard shares cross browser contexts by link and code, then deletion revokes both", async ({
  page,
  browser,
  baseURL,
}) => {
  const sharedText =
    'From one device to another.\n안녕하세요 👋\n<script>alert("plain text")</script>';
  await page.goto("/tools/clipboard");
  await page.getByRole("textbox", { name: "Text to share", exact: true }).fill(sharedText);
  await page.getByRole("combobox", { name: "Available for", exact: true }).click();
  await page.getByRole("option", { name: "10 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Create a share", exact: true }).click();
  await expect(page.getByText("Share created", { exact: true })).toBeVisible();

  const shareLink = await page
    .getByRole("textbox", { name: "Share link", exact: true })
    .inputValue();
  const code = await page
    .getByRole("textbox", { name: "Or use this code", exact: true })
    .inputValue();
  expect(new URL(shareLink).hash).not.toBe("");
  expect(code).not.toBe("");
  expect(code).toMatch(
    /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/,
  );

  const recipientContext = await browser.newContext({ baseURL });
  const recipient = await recipientContext.newPage();
  try {
    await test.step("a separate device opens the share link", async () => {
      await recipient.goto(shareLink);
      await expect(
        recipient.getByRole("textbox", { name: "Received text", exact: true }),
      ).toHaveValue(sharedText);
      await expect(
        recipient.getByRole("button", { name: "Delete share", exact: true }),
      ).toHaveCount(0);
    });

    await test.step("the same share can be retrieved using its typing code", async () => {
      await recipient.goto("/tools/clipboard");
      await recipient.getByRole("tab", { name: "Receive text", exact: true }).click();
      await recipient
        .getByRole("textbox", { name: "Share link or code", exact: true })
        .fill(code.toLowerCase().replaceAll("-", " "));
      await recipient.getByRole("button", { name: "Get shared text", exact: true }).click();
      await expect(
        recipient.getByRole("textbox", { name: "Received text", exact: true }),
      ).toHaveValue(sharedText);
    });

    await test.step("the sender deletes the share and both credentials stop working", async () => {
      await page.getByRole("button", { name: "Delete share", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Share link", exact: true })).toHaveCount(0);

      await recipient.goto(shareLink);
      await expect(recipient.getByRole("alert")).toHaveText("Share unavailable or expired.");
      await expect(
        recipient.getByRole("textbox", { name: "Received text", exact: true }),
      ).toHaveCount(0);

      await recipient.getByRole("textbox", { name: "Share link or code", exact: true }).fill(code);
      await recipient.getByRole("button", { name: "Get shared text", exact: true }).click();
      await expect(recipient.getByRole("alert")).toHaveText("Share unavailable or expired.");
      await expect(
        recipient.getByRole("textbox", { name: "Received text", exact: true }),
      ).toHaveCount(0);
    });
  } finally {
    await recipientContext.close();
  }
});

test("password-protected shares unlock by link and short code without saving passwords", async ({
  page,
  browser,
  baseURL,
}) => {
  const content = "A private clipboard note for another device. 안녕하세요 🔒";
  const password = "A memorable test password 42";
  await page.goto("/tools/clipboard");
  await page.getByRole("textbox", { name: "Text to share", exact: true }).fill(content);
  await page.getByRole("switch", { name: "Protect with a password", exact: true }).click();
  const passwordInput = page.getByLabel("Share password", { exact: true });
  await expect(passwordInput).toHaveAttribute("type", "password");
  await passwordInput.fill("short");
  await expect(page.getByRole("button", { name: "Create a share", exact: true })).toBeDisabled();
  await passwordInput.fill(password);
  const createRequest = page.waitForRequest("**/api/clipboard/create");
  await page.getByRole("button", { name: "Create a share", exact: true }).click();
  const posted = (await createRequest).postDataJSON();
  expect(JSON.stringify(posted)).not.toContain(password);
  expect(posted.password.key).toMatch(/^[a-f0-9]{64}$/);
  expect(posted.password.salt).toMatch(/^[a-f0-9]{32}$/);
  await expect(page.getByText("Password protected", { exact: true })).toBeVisible();
  await expect(passwordInput).toHaveValue("");
  const shareLink = await page
    .getByRole("textbox", { name: "Share link", exact: true })
    .inputValue();
  const code = await page
    .getByRole("textbox", { name: "Or use this code", exact: true })
    .inputValue();
  expect(code).toMatch(
    /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/,
  );
  const saved = await page.evaluate(() =>
    JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }),
  );
  expect(saved).not.toContain(password);
  expect(saved).not.toContain(posted.password.key);
  expect(saved).not.toContain(content);
  const context = await browser.newContext({ baseURL });
  const recipient = await context.newPage();
  try {
    await recipient.goto(shareLink);
    const unlockPassword = recipient.getByLabel("Share password", { exact: true });
    await expect(unlockPassword).toBeVisible();
    await expect(unlockPassword).toHaveAttribute("type", "password");
    await expect(
      recipient.getByRole("textbox", { name: "Received text", exact: true }),
    ).toHaveCount(0);
    await expect(recipient.getByRole("main")).not.toContainText(content);
    await unlockPassword.fill("The wrong password");
    await recipient.getByRole("button", { name: "Unlock text", exact: true }).click();
    await expect(
      recipient.getByText("Incorrect password. Please try again.", { exact: true }),
    ).toBeVisible();
    await expect(
      recipient.getByRole("textbox", { name: "Received text", exact: true }),
    ).toHaveCount(0);
    await unlockPassword.fill(password);
    await recipient.getByRole("button", { name: "Unlock text", exact: true }).click();
    await expect(
      recipient.getByRole("textbox", { name: "Received text", exact: true }),
    ).toHaveValue(content);
    await expect(unlockPassword).toHaveCount(0);

    await recipient.goto("/tools/clipboard");
    await recipient.getByRole("tab", { name: "Receive text", exact: true }).click();
    await recipient
      .getByRole("textbox", { name: "Share link or code", exact: true })
      .fill(code.replaceAll("-", "").toLowerCase());
    await recipient.getByRole("button", { name: "Get shared text", exact: true }).click();
    await expect(unlockPassword).toBeVisible();
    await unlockPassword.fill(password);
    await recipient.getByRole("button", { name: "Unlock text", exact: true }).click();
    await expect(
      recipient.getByRole("textbox", { name: "Received text", exact: true }),
    ).toHaveValue(content);
  } finally {
    await context.close();
    await page.getByRole("button", { name: "Delete share", exact: true }).click();
  }
});

test("the keyboard skip link keeps a clipboard share token intact", async ({ page }) => {
  const token = "a".repeat(48);
  const content = "The share still works after skipping navigation.";
  await page.route("**/api/clipboard/retrieve", async (route) => {
    await route.fulfill({
      json: { content, expiresAt: new Date(Date.now() + 600_000).toISOString() },
    });
  });

  await page.goto(`/tools/clipboard#${token}`);
  await expect(page.getByRole("textbox", { name: "Received text", exact: true })).toHaveValue(
    content,
  );
  const skipControl = page.getByRole("button", { name: "Skip to content", exact: true });
  await skipControl.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/tools/clipboard#${token}$`));
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Received text", exact: true })).toHaveValue(
    content,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("leaving a pending share link clears loading and allows a fresh code lookup", async ({
  page,
}) => {
  const token = "b".repeat(48);
  const freshContent = "This is the new code lookup, not the abandoned share.";
  let releaseOldResponse: () => void = () => undefined;
  const oldResponseGate = new Promise<void>((resolve) => {
    releaseOldResponse = resolve;
  });
  await page.route("**/api/clipboard/retrieve", async (route) => {
    const body: { token?: string; code?: string } = route.request().postDataJSON();
    if (body.token === token) {
      await oldResponseGate;
      // The app should abort this request on navigation. Fulfilling an already
      // aborted request is harmless and lets the route handler finish cleanly.
      await route.fulfill({
        json: {
          content: "An abandoned share must never replace the fresh result.",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        content: freshContent,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    });
  });

  try {
    await page.goto(`/tools/clipboard#${token}`);
    await expect(
      page.getByRole("button", { name: "Retrieving text…", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Instant clipboard", exact: true })
      .click();
    await expect(page).toHaveURL(/\/tools\/clipboard$/);
    await page.getByRole("tab", { name: "Receive text", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retrieving text…", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Get shared text", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Received text", exact: true })).toHaveCount(0);

    await page
      .getByRole("textbox", { name: "Share link or code", exact: true })
      .fill("ABCD-EFGH-JKLM");
    await page.getByRole("button", { name: "Get shared text", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Received text", exact: true })).toHaveValue(
      freshContent,
    );

    releaseOldResponse();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByRole("textbox", { name: "Received text", exact: true })).toHaveValue(
      freshContent,
    );
  } finally {
    releaseOldResponse();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("a share created after navigating away retains its link and deletion receipt", async ({
  page,
}) => {
  const receipt = {
    token: "c".repeat(48),
    code: "ABCD-EFGH-JKLM",
    deleteToken: "d".repeat(48),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
  let releaseCreateResponse: () => void = () => undefined;
  const createResponseGate = new Promise<void>((resolve) => {
    releaseCreateResponse = resolve;
  });
  await page.route("**/api/clipboard/create", async (route) => {
    await createResponseGate;
    await route.fulfill({ status: 201, json: receipt });
  });
  await page.route("**/api/clipboard/delete", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: receipt.token,
      deleteToken: receipt.deleteToken,
    });
    await route.fulfill({ status: 204 });
  });

  try {
    await page.goto("/tools/clipboard");
    await page
      .getByRole("textbox", { name: "Text to share", exact: true })
      .fill("Save my receipt.");
    const createRequest = page.waitForRequest("**/api/clipboard/create");
    await page.getByRole("button", { name: "Create a share", exact: true }).click();
    await createRequest;
    await expect(
      page.getByRole("button", { name: "Creating your share…", exact: true }),
    ).toBeDisabled();

    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "JSON formatter", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "JSON input", exact: true })).toBeVisible();
    releaseCreateResponse();
    await expect(page.getByText("Your share is ready.", { exact: true })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Instant clipboard", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "Share link", exact: true })).toHaveValue(
      new RegExp(`/tools/clipboard#${receipt.token}$`),
    );
    await expect(page.getByRole("textbox", { name: "Or use this code", exact: true })).toHaveValue(
      receipt.code,
    );

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Share link", exact: true })).toHaveValue(
      new RegExp(`/tools/clipboard#${receipt.token}$`),
    );
    await page.getByRole("button", { name: "Delete share", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Share link", exact: true })).toHaveCount(0);
  } finally {
    releaseCreateResponse();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("mobile navigation reaches every tool without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const routes = [
    { id: "clipboard", name: "Instant clipboard", input: "Text to share" },
    { id: "markdown", name: "Markdown preview", input: "Markdown source" },
    { id: "base64", name: "Base64 codec", input: "Text to encode" },
    { id: "json", name: "JSON formatter", input: "JSON input" },
    { id: "url", name: "URL utilities", input: "URL component input" },
    { id: "text", name: "Text toolkit", input: "Original text" },
    { id: "uuid", name: "UUID generator", input: "Generated UUIDs" },
    { id: "timestamp", name: "Timestamp converter", input: "Unix seconds" },
  ];

  for (const route of routes) {
    await test.step(route.name, async () => {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      const navigation = page.getByRole("dialog", { name: "Utility toolbox", exact: true });
      await navigation.getByRole("link", { name: route.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/tools/${route.id}$`));
      await expect(navigation).toBeHidden();
      await expect(page.getByRole("heading", { name: route.name, level: 1 })).toBeVisible();
      await expect(page.getByRole("textbox", { name: route.input, exact: true })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(1);
    });
  }
});
