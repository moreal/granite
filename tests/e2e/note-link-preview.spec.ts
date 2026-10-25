import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  disableAutomaticFormatting,
  live,
  saved,
  source,
} from "../helpers/ui";
async function setup(page: import("@playwright/test").Page) {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "미리볼 작가");
  await source(page);
  await body(
    page,
    "---\ntype: Person\n---\n작가의 실제 로컬 기록입니다. <img src=x onerror=alert(1)> 안전한 원문입니다.",
  );
  await saved(page);
  await live(page);
  await create(page, "미리보기 출발");
  await source(page);
  await body(
    page,
    "---\ntype: Book\nauthor: '[[미리볼 작가]]와 [[없는 미리보기 대상]]'\ncount: 2\n---\n출발 노트 본문",
  );
  await saved(page);
  await live(page);
  await page.getByText("속성", { exact: true }).click();
}
test("S28 property hover/focus preview is read-only, dismissible and first click opens the actual note", async ({
  page,
}) => {
  await setup(page);
  const link = page.getByRole("button", {
    name: "미리볼 작가 노트 열기",
    exact: true,
  });
  await link.hover();
  const preview = page.getByRole("tooltip");
  await expect(preview).toContainText("작가의 실제 로컬 기록");
  await expect(preview.locator("button,a,input,img,script")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "미리보기 출발", exact: true }),
  ).toBeVisible();
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await link.focus();
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await expect(preview).toBeHidden();
  await link.click();
  await expect(
    page.getByRole("heading", { name: "미리볼 작가", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(preview).toHaveCount(0);
});
test("S28 missing preview never creates and pending draft still guards direct navigation", async ({
  page,
}) => {
  await setup(page);
  const missing = page.getByRole("button", {
    name: "없는 미리보기 대상 노트 열기",
    exact: true,
  });
  await missing.focus();
  await expect(page.getByRole("tooltip")).toContainText("아직 없는 노트");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "count 값 편집", exact: true })
    .click();
  await page.getByLabel("count 값", { exact: true }).fill("잘못된 숫자");
  await page
    .getByRole("button", { name: "미리볼 작가 노트 열기", exact: true })
    .click();
  await expect(page.getByLabel("count 값", { exact: true })).toHaveValue(
    "잘못된 숫자",
  );
  await expect(page.getByLabel("count 값", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "미리보기 출발", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await missing.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test.describe("S28 touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("first tap directly opens the existing note without a hover preview", async ({
    page,
  }) => {
    await setup(page);
    await page
      .getByRole("button", { name: "미리볼 작가 노트 열기", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", { name: "미리볼 작가", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
});
