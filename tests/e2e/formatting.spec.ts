import { test, expect } from "@playwright/test";
import { body, create, demo, editor, source } from "../helpers/ui";
test("S20 real worker previews, cancels, applies and undoes safely", async ({
  page,
}) => {
  await demo(page);
  await create(page, "문서 정리 확인");
  await source(page);
  const text =
    "---\ntype: Article\n---\n# 제목\n\n> 인용문 첫 줄\n> 다음 줄\n\n[[생각을 연결하는 작은 습관]]\n\n[site](https://example.com)\n\n$x+1$\n";
  await body(page, text);
  await page.getByRole("button", { name: "문서 정리", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "문서 정리" });
  await expect(dialog.getByLabel("정리 결과")).toContainText(
    "[site]: https://example.com",
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `docs/screenshots/formatting-${theme}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor(page)).toContainText("[site](https://example.com)");
  await page.getByRole("button", { name: "문서 정리", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "적용", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "적용", exact: true }).click();
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toContainText("[site](https://example.com)");
});
