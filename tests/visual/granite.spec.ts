import { disableAutomaticFormatting } from "../helpers/ui";
import { expect, takeSnapshot, test } from "@chromatic-com/playwright";
import { openListed } from "../helpers/ui";
import type { Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await expect(
    page.getByRole("heading", {
      name: "생각을 연결하는 작은 습관",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ page }) => {
  // Fix Date, but keep timers moving so saving and resource rendering still work.
  await page.clock.setFixedTime(new Date("2026-10-25T03:00:00+09:00"));
});

test("S18 S01 S16 welcome and local-folder explanation", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "데모 둘러보기" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await takeSnapshot(page, "Welcome", testInfo);
});

test("S18 S13 S15 desktop demo writing", async ({ page }, testInfo) => {
  await openDemo(page);
  await expect(page.getByRole("textbox", { name: "노트 본문" })).toBeVisible();
  await takeSnapshot(page, "Desktop writing", testInfo);
});

test("S18 S13 S15 narrow demo writing", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await openDemo(page);
  await expect(page.getByRole("textbox", { name: "노트 본문" })).toBeVisible();
  await takeSnapshot(page, "Narrow writing", testInfo);
});

test("S18 S09 S15 source mode", async ({ page }, testInfo) => {
  await openDemo(page);
  await page.getByRole("button", { name: "원문 보기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "라이브 프리뷰", exact: true }),
  ).toBeVisible();
  await takeSnapshot(page, "Markdown source", testInfo);
});

test("S18 S15 rich demo expressions", async ({ page }, testInfo) => {
  await openDemo(page);
  await openListed(page, "직접 고쳐 보는 생각의 지도");
  const image = page.locator(".cm-rich-image img");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("complete", true);
  await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  await expect(page.locator(".katex").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await takeSnapshot(page, "Image and inline math", testInfo);
  await page.locator(".cm-rich-math").last().scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await takeSnapshot(page, "Math and highlighted code", testInfo);
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .press("ControlOrMeta+End");
  await page.locator(".cm-rich-mermaid").scrollIntoViewIfNeeded();
  await expect(page.locator(".cm-rich-mermaid svg")).toBeVisible();
  await takeSnapshot(page, "Mermaid diagram", testInfo);
});

// Visual/manual fixtures intentionally keep their literal Markdown unchanged.
test.beforeEach(async ({ page }) => {
  await disableAutomaticFormatting(page);
});
