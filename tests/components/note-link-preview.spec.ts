import { test, expect } from "@playwright/test";
async function story(page: import("@playwright/test").Page, name: string) {
  await page.goto(
    `iframe.html?id=production-components--${name}&viewMode=story`,
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
}
test("S28 PropertiesLinks finishes on the actual properties/preview and click navigates directly without an intermediate action", async ({
  page,
}) => {
  await story(page, "properties-links");
  await expect(page.getByRole("tooltip")).toContainText("일상에서 읽고");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "상호작용 결과" })).toHaveCount(
    0,
  );
  const link = page.getByRole("button", {
    name: "작가 노트 열기",
    exact: true,
  });
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "작가", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText("일상에서 읽고");
  await expect(page.getByRole("article").getByRole("button")).toHaveCount(0);
});
for (const name of [
  "property-link-preview",
  "property-link-empty",
  "property-link-missing",
  "property-link-long",
]) {
  test(`S28 ${name} remains bounded in both themes with no focus trap or executable content`, async ({
    page,
  }, info) => {
    await story(page, name);
    const link = page.getByRole("button").first(),
      preview = page.getByRole("tooltip");
    await expect(link).toBeFocused();
    await expect(
      preview.locator("button,a,input,img,script,[tabindex]"),
    ).toHaveCount(0);
    if (name.endsWith("empty"))
      await expect(preview).toContainText("내용이 없는 노트");
    if (name.endsWith("missing"))
      await expect(preview).toContainText("아직 없는 노트");
    for (const width of [320, 960])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 600 });
        // Resizing intentionally dismisses previews; let that browser event finish before refocusing.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        await link.evaluate((element: HTMLButtonElement) => element.blur());
        await link.focus();
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        await expect(preview).toBeVisible();
        const box = (await preview.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(11);
        expect(box.x + box.width).toBeLessThanOrEqual(width - 11);
        await preview.screenshot({
          path: info.outputPath(`${name}-${width}-${theme}.png`),
        });
      }
    await page.keyboard.press("Escape");
    await expect(link).toBeFocused();
    await expect(preview).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(preview).toBeHidden();
  });
}
test("S28 hover intent and preview bridge retain text without changing the link geometry", async ({
  page,
}) => {
  await story(page, "property-link-preview");
  const link = page.getByRole("button").first(),
    preview = page.getByRole("tooltip");
  await page.keyboard.press("Escape");
  await link.evaluate((element: HTMLButtonElement) => element.blur());
  await page.mouse.move(0, 0);
  const before = await link.boundingBox();
  await link.hover();
  await expect(preview).toBeVisible();
  expect(await link.boundingBox()).toEqual(before);
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(preview).toBeHidden();
});

test("S28 transient pointer passes do not open a preview and leaving cancels pending hover intent", async ({
  page,
}) => {
  await story(page, "property-link-preview");
  const link = page.getByRole("button").first(),
    preview = page.getByRole("tooltip");
  await page.keyboard.press("Escape");
  await link.evaluate((element: HTMLButtonElement) => element.blur());
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await link.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await page.clock.fastForward(150);
  await expect(preview).toBeHidden();
  await link.dispatchEvent("pointerleave", { pointerType: "mouse" });
  await page.clock.fastForward(300);
  await expect(preview).toBeHidden();
  await link.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await page.clock.fastForward(200);
  await expect(preview).toBeVisible();
  await link.dispatchEvent("pointerleave", {
    pointerType: "mouse",
    clientX: 0,
    clientY: 0,
  });
  await page.clock.fastForward(100);
  await expect(preview).toBeVisible();
  await page.clock.fastForward(20);
  await expect(preview).toBeHidden();
});

test("S28 missing story preserves creation confirmation rather than pretending a missing target already exists", async ({
  page,
}) => {
  await story(page, "property-link-missing");
  await page
    .getByRole("button", { name: "없는 노트 노트 열기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "없는 노트 만들기" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("S28 real pointer can pause inside the hover gap, enter the card and select preview text", async ({
  page,
}) => {
  await story(page, "property-link-preview");
  const link = page.getByRole("button").first(),
    preview = page.getByRole("tooltip");
  await page.keyboard.press("Escape");
  await link.evaluate((element: HTMLButtonElement) => element.blur());
  await page.mouse.move(0, 0);
  await link.hover();
  await expect(preview).toBeVisible();
  const trigger = (await link.boundingBox())!,
    card = (await preview.boundingBox())!;
  const x = trigger.x + trigger.width / 2;
  expect(card.y).toBeGreaterThan(trigger.y + trigger.height);
  await page.mouse.move(x, trigger.y + trigger.height - 1);
  await page.mouse.move(x, (trigger.y + trigger.height + card.y) / 2, {
    steps: 3,
  });
  // A user may pause in the physical bridge longer than the outside-dismiss delay.
  await page.waitForTimeout(260);
  await expect(preview).toBeVisible();
  await page.mouse.move(x, card.y + 6, { steps: 3 });
  await page.waitForTimeout(160);
  await expect(preview).toBeVisible();
  const excerpt = (await preview
    .locator(".note-link-preview-excerpt")
    .boundingBox())!;
  await page.mouse.move(excerpt.x + 2, excerpt.y + 8);
  await page.mouse.down();
  await page.mouse.move(
    excerpt.x + Math.min(120, excerpt.width - 4),
    excerpt.y + 8,
    { steps: 12 },
  );
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.getSelection()?.toString().length ?? 0),
  ).toBeGreaterThan(0);
  await expect(preview).toBeVisible();
});

for (const entry of ["iframe", "manager"] as const) {
  test(`S28 ${entry} PropertiesLinks play completes without console errors before readiness`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      entry === "manager"
        ? "?path=/story/production-components--properties-links"
        : "iframe.html?id=production-components--properties-links&viewMode=story",
    );
    const canvas =
      entry === "manager"
        ? page.frameLocator("#storybook-preview-iframe")
        : page;
    await expect(canvas.locator("#storybook-root")).toHaveAttribute(
      "data-story-ready",
      "true",
    );
    await expect(canvas.getByRole("tooltip")).toContainText("일상에서 읽고");
    await expect(canvas.getByRole("article")).toHaveCount(0);
    expect(
      errors,
      "Storybook play errors must fail even when the final DOM settles correctly",
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(
      canvas.getByRole("button", { name: "작가 노트 열기", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      canvas.getByRole("heading", { name: "작가", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("S28 narrow above-link bridge holds a slow pointer and leaving its corridor dismisses without an overlay", async ({
  page,
}) => {
  await story(page, "property-link-preview");
  await page.setViewportSize({ width: 320, height: 320 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.getByTestId("component").evaluate((element) => {
    element.style.marginTop = "180px";
  });
  const link = page.getByRole("button").first(),
    preview = page.getByRole("tooltip");
  await link.evaluate((element: HTMLButtonElement) => element.blur());
  await page.mouse.move(0, 0);
  await link.hover();
  await expect(preview).toBeVisible();
  const trigger = (await link.boundingBox())!,
    card = (await preview.boundingBox())!;
  expect(card.y + card.height).toBeLessThan(trigger.y);
  const x = trigger.x + trigger.width / 2,
    gapY = (trigger.y + card.y + card.height) / 2;
  await page.mouse.move(x, trigger.y + 1);
  await page.mouse.move(x, gapY, { steps: 3 });
  await page.waitForTimeout(260);
  await expect(preview).toBeVisible();
  await page.mouse.move(x, card.y + card.height - 4, { steps: 3 });
  await expect(preview).toBeVisible();
  await page.mouse.move(1, gapY, { steps: 3 });
  await expect(preview).toBeHidden();
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest(".note-link-preview") !== null,
      { x: 1, y: gapY },
    ),
  ).toBe(false);
});
