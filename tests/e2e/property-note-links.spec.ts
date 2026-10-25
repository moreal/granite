import { test, expect, type Page } from "@playwright/test";
import { filenameFor } from "../../src/domain/notes";
import {
  live,
  body,
  create,
  demo,
  disableAutomaticFormatting,
  editor,
  openListed,
  rawNotes,
  saved,
  source,
} from "../helpers/ui";
const author = "속성 작[가]\\이름";
const subject = "속성 주제";
async function setup(page: Page) {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, author);
  await create(page, subject);
  await create(page, "속성 연결 문서");
  await source(page);
  await body(
    page,
    "---\n# 보존\ntype: Book\nauthor: old # 주석\ncount: 2\nenabled: true\nempty: null\n---\n본문 보존",
  );
  await saved(page);
  await live(page);
  await page.getByText("속성", { exact: true }).click();
  await page.getByRole("button", { name: "author 값 편집" }).click();
  return page.getByRole("combobox", { name: "author 값", exact: true });
}
test("S23 author/about existing-note selection persists escaped links and refreshes graph on reopen", async ({
  page,
}) => {
  const input = await setup(page);
  await input.fill("앞 [[속성 작 뒤");
  await input.evaluate((element: HTMLInputElement) =>
    element.setSelectionRange(8, 8),
  );
  await input.dispatchEvent("click");
  await expect(
    page.getByRole("option", { name: author, exact: true }),
  ).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveValue("앞 [[속성 작\\[가\\]\\\\이름]] 뒤");
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("button", { name: "author 값 편집" }),
  ).toHaveCount(0);
  await input.press("Enter");
  const picker = page.getByRole("combobox", { name: "속성 이름 검색" });
  await picker.fill("about");
  await picker.press("Enter");
  const about = page.getByRole("combobox", { name: "about 값", exact: true });
  await about.fill("@주");
  await page.getByRole("option", { name: subject, exact: true }).click();
  await expect(about).toBeFocused();
  await expect(about).toHaveValue("[[속성 주제]]");
  await about.press("ControlOrMeta+s");
  await saved(page);
  const persisted = (await rawNotes(page))[filenameFor("속성 연결 문서")].raw;
  expect(persisted).toContain(
    '# 보존\ntype: Book\nauthor: "앞 [[속성 작\\\\[가\\\\]\\\\\\\\이름]] 뒤" # 주석',
  );
  expect(persisted).toContain('"about": "[[속성 주제]]"');
  expect(persisted).toContain("본문 보존");
  await page.getByText("노트 그래프", { exact: true }).click();
  const graph = page.getByRole("region", { name: "노트 그래프" });
  await expect(graph).toContainText(author);
  await expect(graph).toContainText(subject);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "속성 연결 문서", exact: true }),
  ).toBeVisible();
  await page.getByText("속성", { exact: true }).click();
  await page.getByRole("button", { name: "author 값 편집" }).click();
  await expect(
    page.getByRole("combobox", { name: "author 값", exact: true }),
  ).toHaveValue("앞 [[속성 작\\[가\\]\\\\이름]] 뒤");
});
test("S23 typing retains input, Escape dismisses before cancelling, no-result manual values and CmdS stay literal", async ({
  page,
}) => {
  const input = await setup(page);
  await input.fill("");
  await input.evaluate((element) =>
    element.setAttribute("data-retained", "yes"),
  );
  await input.pressSequentially("@s");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("data-retained", "yes");
  await input.fill("@속성");
  await expect(page.getByRole("listbox", { name: "기존 노트" })).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("listbox", { name: "기존 노트" })).toHaveCount(0);
  await expect(input).toHaveValue("@속성");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await page.getByRole("button", { name: "author 값 편집" }).click();
  await input.fill("[[없는 대상");
  await expect(
    page.getByRole("status").filter({ hasText: "일치하는 노트가 없습니다" }),
  ).toBeVisible();
  await input.press("Enter");
  await page.getByRole("button", { name: "author 값 편집" }).click();
  await input.fill("mail@example.com");
  await expect(page.getByRole("option")).toHaveCount(0);
  await input.fill("@속성");
  await expect(page.getByRole("option")).not.toHaveCount(0);
  await input.press("ControlOrMeta+s");
  await saved(page);
  expect((await rawNotes(page))[filenameFor("속성 연결 문서")].raw).toContain(
    'author: "@속성"',
  );
});
test("S23 composition and scalar types stay safe, selected range and switched document refuse stale completion", async ({
  page,
}) => {
  const input = await setup(page);
  await input.fill("@속성");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).toHaveValue("@속성");
  await expect(page.getByRole("option")).toHaveCount(0);
  await input.dispatchEvent("compositionend");
  await input.fill("[[속성");
  await input.press("ControlOrMeta+a");
  await expect(page.getByRole("option")).toHaveCount(0);
  await input.press("Escape");
  for (const [name, value] of [
    ["count", "3"],
    ["enabled", "false"],
    ["empty", "null"],
  ]) {
    await page.getByRole("button", { name: `${name} 값 편집` }).click();
    const scalar = page.getByRole("textbox", {
      name: `${name} 값`,
      exact: true,
    });
    await scalar.fill("@속성");
    await expect(page.getByRole("option")).toHaveCount(0);
    await scalar.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    await scalar.fill(value);
    await scalar.press("Enter");
  }
  await page.getByRole("button", { name: "author 값 편집" }).click();
  await input.fill("@속성");
  await expect(page.getByRole("option")).not.toHaveCount(0);
  await openListed(page, subject);
  await expect(page.getByRole("option")).toHaveCount(0);
  const pending = page.getByLabel("author 값", { exact: true });
  if (await pending.count()) {
    await pending.press("Enter");
    await expect(page.getByRole("alert")).toContainText("문서가 변경");
    await expect(pending).toHaveValue("@속성");
  }
  await expect(editor(page)).not.toContainText("@속성");
  await saved(page);
  expect((await rawNotes(page))[filenameFor(subject)].raw).not.toContain(
    "author:",
  );
});
for (const colorScheme of ["light", "dark"] as const)
  test(`S23 existing note menu390 ${colorScheme} rendered`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 844 });
    const input = await setup(page);
    await input.fill("[[속성");
    await expect(
      page.getByRole("listbox", { name: "기존 노트" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const panel = (await page.locator(".note-properties").boundingBox())!;
    const field = (await input.boundingBox())!;
    expect(field.width).toBeGreaterThanOrEqual(panel.width - 2);
    const popup = (await page
      .getByRole("listbox", { name: "기존 노트" })
      .boundingBox())!;
    await page.screenshot({
      path: testInfo.outputPath(`property-notes390-${colorScheme}.png`),
      clip: {
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: Math.max(panel.height, popup.y + popup.height - panel.y),
      },
    });
  });
