import { test, expect, takeSnapshot } from "@chromatic-com/playwright";
// The existing Playwright Chromatic project archives both app and story iframes.
// Resize to the isolated production component, including popup and focus padding.
for (const state of [
  "properties-display",
  "properties-links",
  "property-link-preview",
  "property-link-missing",
  "properties-type",
  "properties-value",
  "properties-new",
  "properties-yaml",
  "properties-warning",
  "create",
  "property",
  "row-long",
  "yaml",
  "recovery",
  "paste-failed",
  "property-value-menu",
  "property-value-no-results",
  "property-value-long-korean",
]) {
  test(`S22 isolated Storybook ${state}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(
      `storybook/iframe.html?id=production-components--${state}&viewMode=story`,
    );
    const surface = page.getByTestId("component");
    await expect(surface).toBeVisible();
    await expect(page.locator("#storybook-root")).toHaveAttribute(
      "data-story-ready",
      "true",
    );
    if (state === "create" || state === "property") {
      await page.getByRole("combobox").focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("listbox")).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    const box = await surface.boundingBox();
    await page.setViewportSize({
      width: 320,
      height:
        Math.ceil(
          Math.max(
            box!.height,
            await page
              .locator(".schema-options, .note-link-preview:popover-open")
              .evaluateAll((nodes) =>
                Math.max(
                  0,
                  ...nodes.map((node) => node.getBoundingClientRect().bottom),
                ),
              ),
          ),
        ) + 8,
    });
    if (
      [
        "properties-links",
        "property-link-preview",
        "property-link-missing",
      ].includes(state)
    ) {
      await page
        .locator(".property-note-link")
        .first()
        .evaluate((element: HTMLButtonElement) => {
          element.blur();
          element.focus();
        });
      await expect(page.getByRole("tooltip")).toBeVisible();
    }
    await takeSnapshot(page, `S22 ${state} narrow production component`, info);
  });
}

for (const [story, theme] of [
  ["foundations--colors", "light"],
  ["primitives--buttons", "dark"],
  ["primitives--fields", "light"],
  ["primitives--navigation", "dark"],
  ["primitives--suggestions", "light"],
] as const) {
  test(`S27 design system ${story} ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(
      `storybook/iframe.html?id=design-system-${story}&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator("#storybook-root")).toHaveAttribute(
      "data-story-ready",
      "true",
    );
    const surface = page.getByTestId("design-system");
    if (story === "primitives--suggestions") {
      await page.getByRole("combobox").focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("listbox")).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    const bottom = await surface.evaluate((element) =>
      Math.max(
        element.getBoundingClientRect().bottom,
        ...Array.from(
          element.querySelectorAll(".schema-options"),
          (node) => node.getBoundingClientRect().bottom,
        ),
      ),
    );
    await page.setViewportSize({ width: 320, height: Math.ceil(bottom) + 8 });
    await takeSnapshot(page, `S27 ${story} ${theme} narrow`, info);
  });
}
