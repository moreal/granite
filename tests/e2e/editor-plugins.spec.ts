import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  editor,
  saved,
  source,
  rawNotes,
} from "../helpers/ui";

test("S04/S17 metadata is protected and quotes render in both themes and widths", async ({
  page,
}) => {
  await demo(page);
  await create(page, "속성과 인용문");
  await source(page);
  const original =
    '---\ntype: Article\nauthor: "[[메타데이터 저자]]"\n---\n> 긴 문장을 담은 인용문은 차분한 왼쪽 선과 함께 표시됩니다. 한국어 어절이 좁은 화면에서도 자연스럽게 이어집니다.\n>\n> > 중첩된 인용문\n> 다음 문단\n\n일반 본문과 [[생각을 연결하는 작은 습관]]\n\n마지막 줄';
  await body(page, original);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(editor(page)).not.toContainText("메타데이터 저자");
  await expect(page.locator(".cm-blockquote")).toHaveCount(4);
  await saved(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.mouse.move(0, 0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `docs/screenshots/editor-plugins-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Arrow navigation enters hidden source without deleting it.
  await editor(page).click();
  await editor(page).press("ControlOrMeta+Home");
  await expect(editor(page)).toContainText("type: Article");
  await saved(page);
  const notes = await rawNotes(page);
  expect(Object.values(notes).some((note) => note.raw.includes(original))).toBe(
    true,
  );
  await source(page);
  await expect(editor(page)).toContainText('author: "[[메타데이터 저자]]"');
});

test("S17 first Backspace at body start reveals metadata without deleting bytes", async ({
  page,
}) => {
  await demo(page);
  await create(page, "속성 경계");
  await source(page);
  const value = "---\ntype: Book\n---\nBody";
  await body(page, value);
  await saved(page);
  await page.reload();
  await expect(editor(page)).not.toContainText("type: Book");
  await editor(page).focus();
  await editor(page).press("Backspace");
  await expect(editor(page)).toContainText("type: Book");
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes(value),
    ),
  ).toBe(true);
});
