import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  editor,
  source,
  saved,
  rawNotes,
} from "../helpers/ui";

test("S20 default automatic WASM formatting saves and reloads; undo remains undone", async ({
  page,
}) => {
  await demo(page);
  await create(page, "자동 정리");
  await source(page);
  await body(page, "[site](https://example.com)");
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("저장 완료", { exact: true })).toBeVisible();
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await body(page, "[other](https://example.org)");
  await expect(editor(page)).toContainText("[other]: https://example.org");
  await editor(page).press("ControlOrMeta+z");
  await page.waitForTimeout(2100);
  await expect(editor(page)).toContainText("[other](https://example.org)");
  await editor(page).press("ControlOrMeta+Shift+z");
  await expect(editor(page)).toContainText("[other]: https://example.org");
});

test("S20 setting defaults on, cancels draft, persists off and synchronizes tabs", async ({
  page,
  context,
}, testInfo) => {
  await demo(page);
  await create(page, "자동 정리 설정");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "글쓰기", exact: true }).click();
  const option = page.getByRole("checkbox", { name: "자동 문서 정리 사용" });
  await expect(option).toBeChecked();
  await option.uncheck();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "글쓰기", exact: true }).click();
  await expect(option).toBeChecked();
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: testInfo.outputPath(`granite-auto-${theme}-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "적용", exact: true }),
      ).toBeInViewport();
    }
  }
  await option.uncheck();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await source(page);
  await body(page, "[site](https://example.com)");
  await page.waitForTimeout(2100);
  await expect(editor(page)).toContainText("[site](https://example.com)");
  await page.reload();
  await source(page);
  await page.waitForTimeout(1800);
  await expect(editor(page)).toContainText("[site](https://example.com)");
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "설정", exact: true }).click();
  await second.getByRole("button", { name: "글쓰기", exact: true }).click();
  await expect(second.getByRole("checkbox")).not.toBeChecked();
  await second.getByRole("checkbox").check();
  await second.getByRole("button", { name: "적용", exact: true }).click();
  await page.waitForTimeout(1800);
  await expect(editor(page)).toContainText("[site](https://example.com)");
  await editor(page).press("ControlOrMeta+End");
  await editor(page).press("Space");
  await expect(editor(page)).toContainText("[site]: https://example.com");
});

test("S20 worker failure keeps normal autosave and raw text across reload without retry loops", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/*hongdown.worker*", async (route) => {
    attempts++;
    await route.abort();
  });
  await demo(page);
  await create(page, "정리 실패 보존");
  await source(page);
  const original = "[site](https://example.com)";
  await body(page, original);
  await expect(page.locator(".auto-format-status")).toContainText(
    "불러오지 못했습니다",
  );
  await saved(page);
  await expect(editor(page)).toContainText(original);
  const notes = await rawNotes(page);
  expect(Object.values(notes).some((note) => note.raw.includes(original))).toBe(
    true,
  );
  await page.waitForTimeout(2200);
  expect(attempts).toBe(1);
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText(original);
  await page.waitForTimeout(1700);
  expect(attempts).toBe(1);
  await editor(page).press("ControlOrMeta+End");
  await editor(page).press("Space");
  await expect(page.locator(".auto-format-status")).toContainText(
    "불러오지 못했습니다",
  );
  expect(attempts).toBe(2);
  await saved(page);
});
