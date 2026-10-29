import { disableAutomaticFormatting, openConnections } from "../helpers/ui";
import { expect, takeSnapshot, test } from "@chromatic-com/playwright";
import { body, create, saved, source } from "../helpers/ui";

test("S18 S04 S12 S17 Korean heading and graph start alignment", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-25T03:00:00+09:00"));
  await page.goto("./");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await create(page, "한국어 시작선");
  await source(page);
  await body(
    page,
    "##   제목의 시작\n\n한글 어절과 (괄호), 문장부호를 확인합니다.\n\n[[짧음]] [[길이가 훨씬 긴 한국어 노트 제목]]\n\n끝",
  );
  await saved(page);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator(".cm-heading")).toHaveText("##   제목의 시작");
  await openConnections(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  await expect(page.locator(".graph-node")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  await takeSnapshot(page, "Korean heading and graph desktop", testInfo);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator(".graph-node").last().scrollIntoViewIfNeeded();
  await takeSnapshot(page, "Korean graph narrow", testInfo);
});

// Visual/manual fixtures intentionally keep their literal Markdown unchanged.
test.beforeEach(async ({ page }) => {
  await disableAutomaticFormatting(page);
});
