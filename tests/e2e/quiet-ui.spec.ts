import { test, expect } from "@playwright/test";
import {
  demo,
  create,
  source,
  body,
  editor,
  saved,
  rawNotes,
} from "../helpers/ui";

test("S02/S12 recent notes show only titles while search retains matching context", async ({
  page,
}) => {
  await demo(page);
  await create(page, "조용한 목록");
  await body(page, "목록에는 숨기는 본문 단서");
  await saved(page);
  const list = page.locator(".note-list");
  await expect(
    list.getByRole("button", { name: "조용한 목록", exact: true }),
  ).toBeVisible();
  await expect(list.locator(".note-excerpt")).toHaveCount(0);
  await page.getByRole("textbox", { name: "노트 검색" }).fill("본문 단서");
  await expect(list.locator(".note-excerpt")).toContainText("본문 단서");
  await page.getByRole("textbox", { name: "노트 검색" }).fill("");
  await expect(
    list.getByRole("button", { name: "조용한 목록", exact: true }),
  ).toBeVisible();
});

test("S04/S14 code fence info hides in preview and stays editable on its opener", async ({
  page,
}) => {
  await demo(page);
  await create(page, "코드 언어 감추기");
  await source(page);
  const text =
    "```js title=example\nconst answer = 42;\n```\n\n~~~ python extra-info\nprint('hello')\n~~~\n\n끝";
  await body(page, text);
  await saved(page);
  const before = await rawNotes(page);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(editor(page)).not.toContainText("title=example");
  await expect(editor(page)).not.toContainText("python");
  await expect(editor(page)).not.toContainText("extra-info");
  await expect(editor(page)).toContainText("const answer = 42;");
  await expect(editor(page)).toContainText("print('hello')");
  await editor(page).press("ControlOrMeta+Home");
  await expect(editor(page)).toContainText("```js title=example");
  await expect(editor(page)).not.toContainText("extra-info");
  await editor(page).press("ControlOrMeta+End");
  await expect(editor(page)).not.toContainText("title=example");
  await source(page);
  await expect(editor(page)).toContainText("~~~ python extra-info");
  expect(await rawNotes(page)).toEqual(before);
});
