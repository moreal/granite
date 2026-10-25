import { test, expect } from "@playwright/test";
import { body, create, demo, editor, saved, source } from "../helpers/ui";
test("S03/S04 note identity resets CodeMirror undo while source toggles retain history", async ({
  page,
}) => {
  await demo(page);
  await create(page, "서로 다른 첫 노트");
  await source(page);
  await body(page, "첫 노트에서만 남아야 할 글");
  await saved(page);
  await create(page, "서로 다른 둘째 노트");
  await source(page);
  await editor(page).click();
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toHaveText("본문을 입력하세요.");
  await body(page, "둘째 노트의 글");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await source(page);
  await editor(page).click();
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toHaveText("본문을 입력하세요.");
});
test("S19 template rows retain input focus across real character edits and deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await page.getByRole("button", { name: "양식 추가", exact: true }).click();
  const name = page.getByLabel("이름", { exact: true });
  await name.fill("");
  await name.focus();
  await page.keyboard.type("long custom name");
  await expect(name).toHaveValue("long custom name");
  await expect(name).toBeFocused();
  const template = page.getByLabel("Markdown 양식", { exact: true });
  await template.fill("");
  await template.focus();
  await page.keyboard.type("[{{title}}]({{url}})");
  await expect(template).toHaveValue("[{{title}}]({{url}})");
  await expect(template).toBeFocused();
  await page.getByRole("button", { name: "양식 추가", exact: true }).click();
  const second = page.getByLabel("이름", { exact: true }).nth(1);
  await second.fill("second");
  await page.getByRole("button", { name: "양식 1 삭제", exact: true }).click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue("second");
});
test("S08 URL menu retains focused button identity through keyboard selection", async ({
  page,
}) => {
  await demo(page);
  await create(page, "붙여넣기 포커스");
  await editor(page).evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "https://example.com/");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  const alias = page.getByRole("button", { name: "별칭 달기", exact: true });
  await alias.focus();
  await expect(alias).toBeFocused();
  await alias.press("ArrowDown");
  const title = page.getByRole("button", {
    name: "제목 가져오기",
    exact: true,
  });
  await expect(title).toBeFocused();
  await title.press("ArrowUp");
  await expect(alias).toBeFocused();
  await alias.press("Enter");
  await expect(editor(page)).toContainText("[](https://example.com/)");
});
