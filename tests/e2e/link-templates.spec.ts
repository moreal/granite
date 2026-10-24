import { test, expect } from "@playwright/test";
import { demo, create, source, editor, paste } from "../helpers/ui";

test("S08/S19 persisted custom template is chosen with the keyboard and leaves one editable Markdown insertion", async ({
  page,
}) => {
  await demo(page);
  await create(page, "링크 양식 확인");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await page.getByRole("button", { name: /양식 추가/ }).click();
  await page.getByLabel("이름", { exact: true }).fill("출처 표시");
  await page
    .getByLabel("Markdown 양식", { exact: true })
    .fill("[{{hostname}}]({{url}}) — {{selection}}");
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  await source(page);
  await editor(page).click();
  await paste(page, "https://example.com/reference");
  await expect(
    page.getByRole("button", { name: "출처 표시", exact: true }),
  ).toBeVisible();
  await editor(page).press("ArrowUp");
  await editor(page).press("Enter");
  await expect(editor(page)).toHaveText(
    "[example\\.com](https://example.com/reference) — ",
  );
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toHaveText("https://example.com/reference");
});

test("S08/S19 narrow paste menu stays in viewport and closes on caret movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await demo(page);
  await create(page, "좁은 링크");
  await source(page);
  await editor(page).click();
  await paste(page, "https://example.com/a/very/long/path");
  const menu = page.getByRole("group", { name: "붙여넣은 링크" });
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(8);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(382);
  await editor(page).press("ArrowLeft");
  await expect(menu).toBeHidden();
});

test("S08/S19 light and dark narrow URL menus remain readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await demo(page);
  await create(page, "출처를 남기는 방법");
  await source(page);
  for (const [theme, label] of [
    ["light", "밝게"],
    ["dark", "어둡게"],
  ] as const) {
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page.getByRole("radio", { name: label, exact: true }).check();
    await page.getByRole("button", { name: "적용", exact: true }).click();
    await editor(page).click();
    await editor(page).press("ControlOrMeta+a");
    await paste(page, "https://example.com/article");
    const menu = page.getByRole("group", { name: "붙여넣은 링크" });
    await expect(menu).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/link-menu-${theme}-narrow.png`,
    });
    await editor(page).press("Escape");
  }
});
