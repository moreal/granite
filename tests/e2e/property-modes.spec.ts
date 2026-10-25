import { test, expect, type Page } from "@playwright/test";
import {
  body,
  create,
  demo,
  disableAutomaticFormatting,
  editor,
  live,
  openListed,
  propertyMode,
  rawNotes,
  redo,
  saved,
  source,
} from "../helpers/ui";
import { filenameFor, decodeNote } from "../../src/domain/notes";
const documentTitle = "편집 방식 실험";
async function setup(page: Page) {
  await disableAutomaticFormatting(page);
  await demo(page);
  for (const [title, type] of [
    ["대상 책", "Book"],
    ["대상 조직", "Organization"],
    ["대상 작가", "Person"],
    ["대상 사용자", "Custom"],
  ]) {
    await create(page, title);
    await source(page);
    await body(page, `---\ntype: ${type}\n---\n`);
    await saved(page);
  }
  await create(page, documentTitle);
  await source(page);
  await body(
    page,
    "---\n# keep\ntype: Book\nauthor: old # comment\nabout: old\ncount: 2\ncomplex: [one, two]\n---\n본문 보존",
  );
  await saved(page);
  await live(page);
  await page.getByText("속성", { exact: true }).click();
}
async function setting(page: Page, mode: "form" | "yaml") {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "글쓰기", exact: true }).click();
  await page
    .getByRole("combobox", { name: "속성 편집 방식", exact: true })
    .selectOption(mode);
  await page.getByRole("button", { name: "적용", exact: true }).click();
}
test("S24 form type completion, union ranges, mismatch warning and live linked-type updates", async ({
  page,
}) => {
  await setup(page);
  await expect(page.getByLabel("속성 YAML 원문")).toHaveCount(0);
  await page.getByRole("button", { name: "type 값 편집", exact: true }).click();
  const type = page.getByRole("combobox", { name: "type 값", exact: true });
  await type.fill("");
  await type.pressSequentially("Person");
  await expect(
    page.getByRole("listbox", { name: "Schema.org 유형" }),
  ).toBeVisible();
  await type.press("Enter");
  await expect(type).toHaveValue("Person");
  await type.press("Enter");
  await page
    .getByRole("button", { name: "author 값 편집", exact: true })
    .click();
  const input = page.getByRole("combobox", { name: "author 값", exact: true });
  await input.fill("");
  await input.pressSequentially("@대상");
  const options = page
    .getByRole("listbox", { name: "기존 노트" })
    .getByRole("option");
  await expect(options).toHaveCount(4);
  expect((await options.allTextContents()).slice(0, 2).join(" ")).toContain(
    "Organization",
  );
  expect((await options.allTextContents()).slice(0, 2).join(" ")).toContain(
    "Person",
  );
  await expect(options.nth(2)).toContainText("Custom · 유형 확인 필요");
  await expect(options.nth(3)).toContainText("Book · 권장 유형과 다름");
  await expect(page.locator(".property-value-input")).toContainText(
    "Organization 또는 Person",
  );
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("[[대상 책]]");
  await input.press("ControlOrMeta+z");
  await expect(input).toHaveValue("@대상");
  await input.press("ControlOrMeta+Shift+Z");
  await expect(input).toHaveValue("[[대상 책]]");
  await input.press("ControlOrMeta+s");
  await saved(page);
  await expect(page.locator(".property-advice")).toContainText(
    "대상 책 (Book)",
  );
  await openListed(page, "대상 책");
  await source(page);
  await body(page, "---\ntype: Person\n---\n");
  await saved(page);
  await live(page);
  await openListed(page, documentTitle);
  if (
    !(await page
      .locator(".note-properties")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByText("속성", { exact: true }).click();
  await expect(page.locator(".property-advice")).toHaveCount(0);
  await page
    .getByRole("button", { name: "author 값 편집", exact: true })
    .click();
  await input.fill("@대상");
  await expect(options.first()).toContainText("대상 책Person");
});
test("S24 persisted mode switch defers pending/invalid/stale drafts and source fallback retains the chosen mode", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "count 값 편집", exact: true })
    .click();
  const input = page.getByRole("textbox", { name: "count 값", exact: true });
  await input.fill("invalid draft");
  const before = (await rawNotes(page))[filenameFor(documentTitle)].raw;
  await setting(page, "yaml");
  await expect(input).toHaveValue("invalid draft");
  await expect(
    page.getByRole("status").filter({ hasText: "적용하거나 취소" }),
  ).toBeVisible();
  await expect(page.getByLabel("속성 YAML 원문")).toHaveCount(0);
  expect((await rawNotes(page))[filenameFor(documentTitle)].raw).toBe(before);
  await input.press("Enter");
  await expect(page.getByRole("alert")).toContainText("숫자");
  await expect(input).toHaveValue("invalid draft");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByLabel("속성 YAML 원문")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: documentTitle, exact: true }),
  ).toBeVisible();
  await page.getByText("속성", { exact: true }).click();
  await expect(page.getByLabel("속성 YAML 원문")).toBeVisible();
  await expect(page.getByRole("button", { name: "type 값 편집" })).toHaveCount(
    0,
  );
  await setting(page, "form");
  await page
    .getByRole("button", { name: "author 값 편집", exact: true })
    .click();
  const author = page.getByLabel("author 값", { exact: true });
  await author.fill("보관할 초안");
  await page
    .getByRole("button", { name: "complex 원문 편집", exact: true })
    .click();
  await expect(page.getByLabel("속성 YAML 원문")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "type 값 편집" })).toHaveCount(
    0,
  );
  await expect(page.locator(".note-properties")).toContainText("폼 값은 보관");
  await body(
    page,
    decodeNote(filenameFor(documentTitle), before).body + "\n외부 변경",
  );
  await live(page);
  await expect(author).toHaveValue("보관할 초안");
  await author.press("Enter");
  await expect(page.getByRole("alert")).toContainText("문서가 변경");
  await page.evaluate(() => {
    const key = "granite.settings.v1",
      value = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(
      key,
      JSON.stringify({ ...value, propertyEditor: "yaml" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(author).toHaveValue("보관할 초안");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByLabel("속성 YAML 원문")).toBeVisible();
});
test("S24 YAML and full source share typed note completion, exact scalar patches, history, save/reload and graph", async ({
  page,
}) => {
  await setup(page);
  await propertyMode(page, "yaml");
  const yaml = page.getByLabel("속성 YAML 원문");
  await expect(yaml).toBeVisible();
  await yaml.fill('type: Book\nauthor: @대상 # keep\nabout:\n  - "[[대상"');
  await yaml.evaluate((element: HTMLTextAreaElement) => {
    const at = element.value.indexOf("대상") + 2;
    element.setSelectionRange(at, at);
  });
  await yaml.press("Control+Space");
  await expect(
    page.getByRole("option").filter({ hasText: "대상 조직" }),
  ).toBeVisible();
  if (
    !(await page.getByRole("option").first().textContent())?.includes(
      "대상 조직",
    )
  )
    await yaml.press("ArrowDown");
  await yaml.press("Enter");
  await expect(yaml).toHaveValue(
    'type: Book\nauthor: "[[대상 조직]]" # keep\nabout:\n  - "[[대상"',
  );
  await yaml.press("ControlOrMeta+z");
  await expect(yaml).toHaveValue(
    'type: Book\nauthor: @대상 # keep\nabout:\n  - "[[대상"',
  );
  await yaml.press("ControlOrMeta+Shift+Z");
  await yaml.evaluate((element: HTMLTextAreaElement) => {
    const at = element.value.lastIndexOf("대상") + 2;
    element.setSelectionRange(at, at);
  });
  await yaml.press("Control+Space");
  await expect(
    page.getByRole("option").filter({ hasText: "대상 책" }),
  ).toBeVisible();
  await page.getByRole("option").filter({ hasText: "대상 책" }).click();
  await yaml.press("ControlOrMeta+s");
  await saved(page);
  await expect(yaml).toHaveValue(
    'type: Book\nauthor: "[[대상 조직]]" # keep\nabout:\n  - "[[대상 책]]"',
  );
  await source(page);
  await expect(yaml).toHaveCount(0);
  await body(page, '---\ntype: Book\nauthor: "[[대상" # keep\n---\n본문 보존');
  await editor(page).press("ControlOrMeta+Home");
  await editor(page).press("ArrowDown");
  await editor(page).press("ArrowDown");
  await editor(page).press("End");
  for (let i = 0; i < 8; i++) await editor(page).press("ArrowLeft");
  await editor(page).press("Control+Space");
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText(
    "대상 조직",
  );
  if (
    !(
      await page
        .locator(".cm-tooltip-autocomplete [role=option]")
        .first()
        .textContent()
    )?.includes("대상 조직")
  )
    await editor(page).press("ArrowDown");
  await editor(page).press("Enter");
  await expect(editor(page)).toContainText('author: "[[대상 조직]]" # keep');
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toContainText('author: "[[대상" # keep');
  await redo(page);
  await editor(page).press("ControlOrMeta+s");
  await saved(page);
  await live(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  await expect(page.getByRole("region", { name: "노트 그래프" })).toContainText(
    "대상 조직",
  );
  await page.reload();
  await page.getByText("속성", { exact: true }).click();
  await expect(yaml).toHaveValue('type: Book\nauthor: "[[대상 조직]]" # keep');
});
test("S24 YAML caret/selection/IME/save dismiss safely and source mismatch advice stays mild", async ({
  page,
}) => {
  await setup(page);
  await propertyMode(page, "yaml");
  const yaml = page.getByLabel("속성 YAML 원문");
  await yaml.fill('type: Book\nauthor: "[[대상 책]]"');
  await expect(page.locator(".property-advice")).toContainText(
    "권장 유형 Organization 또는 Person",
  );
  await yaml.fill("type: Book\nauthor: @대상");
  await yaml.press("Control+Space");
  await expect(page.getByRole("option")).not.toHaveCount(0);
  await yaml.press("ControlOrMeta+s");
  await saved(page);
  expect((await rawNotes(page))[filenameFor(documentTitle)].raw).toContain(
    "author: @대상",
  );
  await expect(page.getByRole("option")).toHaveCount(0);
  await yaml.press("Control+Space");
  await yaml.dispatchEvent("compositionstart");
  await yaml.press("Enter");
  await expect(page.getByRole("option")).toHaveCount(0);
  await yaml.dispatchEvent("compositionend");
  await yaml.fill("type: Book\nauthor: @대상");
  await yaml.press("ControlOrMeta+a");
  await expect(page.getByRole("option")).toHaveCount(0);
  await yaml.fill('type: Book\nauthor: "[[대상 책]]"');
  await source(page);
  await expect(page.locator(".property-advice")).toContainText(
    "대상 책 (Book)",
  );
  await expect(page.locator(".property-advice")).not.toHaveAttribute(
    "role",
    "alert",
  );
});
test("S24 initial type query survives setting and source round trips before metadata creation", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "처음 유형 초안");
  await page.getByText("속성", { exact: true }).click();
  const type = page.getByRole("combobox", { name: "노트 유형", exact: true });
  await expect(type).toHaveValue("Thing");
  await type.fill("");
  await type.pressSequentially("Per");
  await setting(page, "yaml");
  await expect(type).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "속성 YAML 추가" }),
  ).toBeVisible();
  await setting(page, "form");
  await expect(type).toHaveValue("Per");
  await source(page);
  await expect(type).toHaveCount(0);
  await live(page);
  await expect(type).toHaveValue("Per");
  await type.fill("CustomType");
  await type.press("Escape");
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  await saved(page);
  await page.reload();
  await page.getByText("속성", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "type 값 편집", exact: true }),
  ).toHaveText("CustomType");
});

test("S24d first-line YAML typing keeps focus, selection, history and position across warnings", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "YAML 첫 줄 입력");
  await source(page);
  await body(page, "---\nauthor: old # keep\n---\n본문 보존");
  await saved(page);
  await live(page);
  await propertyMode(page, "yaml");
  await page.getByText("속성", { exact: true }).click();
  const yaml = page.getByLabel("속성 YAML 원문");
  const original = await yaml.elementHandle();
  await yaml.focus();
  await yaml.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(0, 0),
  );
  const top = (await yaml.boundingBox())!.y;
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  let prefix = "";
  for (const character of "type: Book") {
    await page.keyboard.type(character);
    prefix += character;
    await expect(yaml).toHaveValue(`${prefix}\nauthor: old # keep`);
    expect((await yaml.boundingBox())!.y).toBe(top);
    expect(
      await yaml.evaluate(
        (element: HTMLTextAreaElement, initial) => ({
          same: element === initial,
          focused: document.activeElement === element,
          start: element.selectionStart,
          end: element.selectionEnd,
        }),
        original,
      ),
    ).toEqual({
      same: true,
      focused: true,
      start: prefix.length,
      end: prefix.length,
    });
    await expect(page.locator(".property-warning")).toHaveCount(0);
  }
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await yaml.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(6, 10),
  );
  await page.keyboard.insertText("Person");
  await expect(yaml).toHaveValue("type: Person\nauthor: old # keep");
  await yaml.press("ControlOrMeta+z");
  await expect(yaml).toHaveValue("type: Book\nauthor: old # keep");
  await yaml.press("ControlOrMeta+Shift+Z");
  await expect(yaml).toHaveValue("type: Person\nauthor: old # keep");
  await yaml.press("ControlOrMeta+s");
  await saved(page);
  expect((await rawNotes(page))[filenameFor("YAML 첫 줄 입력")].raw).toContain(
    "---\ntype: Person\nauthor: old # keep\n---\n본문 보존",
  );
  await page.reload();
  await page.getByText("속성", { exact: true }).click();
  await expect(yaml).toHaveValue("type: Person\nauthor: old # keep");
});

test("S25 source typing stays quiet until blur/save and invalid raw autosaves and reopens", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "S25 원문 검증");
  await source(page);
  await body(page, "---\ntype: Book\n---\n# 보존");
  await saved(page);
  await page.getByText("속성", { exact: true }).click();
  await body(page, "---\ntype: [\n---\n# 보존");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await expect(page.getByText("확인 필요", { exact: true })).toHaveCount(0);
  await saved(page);
  expect((await rawNotes(page))[filenameFor("S25 원문 검증")].raw).toContain(
    "---\ntype: [\n---\n# 보존",
  );
  await editor(page).press("ControlOrMeta+s");
  await expect(page.locator(".property-warning")).toBeVisible();
  await expect(page.getByText("확인 필요", { exact: true })).toBeVisible();
  await body(page, "---\ntype: [b\n---\n# 보존");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await page.getByText("속성", { exact: true }).click();
  await expect(page.getByText("확인 필요", { exact: true })).toBeVisible();
  await saved(page);
  await page.reload();
  await expect(page.getByText("확인 필요", { exact: true })).toBeVisible();
});
