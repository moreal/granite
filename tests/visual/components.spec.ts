import { test, expect, takeSnapshot } from "@chromatic-com/playwright";
// The existing Playwright Chromatic project archives both app and story iframes.
// Resize to the isolated production component, including popup and focus padding.
for (const state of [
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
              .locator(".schema-options")
              .evaluateAll((nodes) =>
                Math.max(
                  0,
                  ...nodes.map((node) => node.getBoundingClientRect().bottom),
                ),
              ),
          ),
        ) + 8,
    });
    await takeSnapshot(page, `S22 ${state} narrow production component`, info);
  });
}
