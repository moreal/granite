import { disableAutomaticFormatting } from "../helpers/ui";
import { expect, takeSnapshot, test } from "@chromatic-com/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { openListed } from "../helpers/ui";

async function openRichDemo(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await openListed(page, "직접 고쳐 보는 생각의 지도");
  const image = page.locator(".cm-rich-image img");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("complete", true);
  await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  await expect(page.locator(".katex").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function captureRich(
  page: Page,
  theme: "light" | "dark",
  testInfo: TestInfo,
) {
  await page.screenshot({
    path: testInfo.outputPath(`granite-review-${theme}-rich-image.png`),
  });
  await page.locator(".cm-rich-math").last().scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(`granite-review-${theme}-rich-code.png`),
  });
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .press("ControlOrMeta+End");
  await page.locator(".cm-rich-mermaid").scrollIntoViewIfNeeded();
  await expect(page.locator(".cm-rich-mermaid svg")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(`granite-review-${theme}-rich-mermaid.png`),
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-25T03:00:00+09:00"));
});

test("S19 light settings and rich content", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openRichDemo(page);
  await captureRich(page, "light", testInfo);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("granite-review-light-settings.png"),
  });
  await takeSnapshot(page, "Light appearance settings", testInfo);
});

test("S19 dark rich content and narrow link settings", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openRichDemo(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await captureRich(page, "dark", testInfo);
  await takeSnapshot(page, "Dark rich content and diagram", testInfo);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await page.getByRole("button", { name: "양식 추가", exact: true }).click();
  await page.getByLabel("이름", { exact: true }).fill("출처 기록");
  await page
    .getByLabel("Markdown 양식", { exact: true })
    .fill("> [{{title}}]({{url}}) — {{hostname}}");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "적용", exact: true }),
  ).toBeInViewport();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("granite-review-dark-settings-narrow.png"),
  });
  await takeSnapshot(page, "Dark narrow link settings", testInfo);
});

// Visual/manual fixtures intentionally keep their literal Markdown unchanged.
test.beforeEach(async ({ page }) => {
  await disableAutomaticFormatting(page);
});
