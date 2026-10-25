import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  editor,
  source,
  saved,
  rawNotes,
  disableAutomaticFormatting,
} from "../helpers/ui";
test("S20 CmdS formats with real worker and saves without confirmation, undo remains available", async ({
  page,
}) => {
  await demo(page);
  await create(page, "저장 정리");
  await source(page);
  await body(page, "[site](https://example.com)\n");
  await editor(page).press("ControlOrMeta+s");
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "문서 정리", exact: true }),
  ).toHaveCount(0);
  await saved(page);
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes("[site]: https://example.com"),
    ),
  ).toBe(true);
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toContainText("[site](https://example.com)");
  await editor(page).press("ControlOrMeta+Shift+z");
  await editor(page).press("ControlOrMeta+s");
  await saved(page);
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText("[site]: https://example.com");
});
test("S20 CmdS respects disabled automatic formatting and saves raw text", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "원문 저장");
  await source(page);
  await body(page, "[site](https://example.com)\n");
  await editor(page).press("ControlOrMeta+s");
  await saved(page);
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes("[site](https://example.com)"),
    ),
  ).toBe(true);
});

test("S20 CmdS worker failure flushes raw source and survives reload", async ({
  page,
}) => {
  await page.route("**/*hongdown.worker*", (route) => route.abort());
  await demo(page);
  await create(page, "저장 정리 실패");
  await source(page);
  const original = "[site](https://example.com)";
  await body(page, original);
  await editor(page).press("ControlOrMeta+s");
  await expect(page.locator(".auto-format-status")).toContainText(
    "불러오지 못했습니다",
  );
  await saved(page);
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes(original),
    ),
  ).toBe(true);
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText(original);
});
