import { filenameFor } from "../../src/domain/notes";
import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  disableAutomaticFormatting,
  editor,
  live,
  saved,
  source,
  rawNotes,
} from "../helpers/ui";

async function linkedNotes(page: import("@playwright/test").Page) {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, "공유 미리보기 대상");
  await body(page, "대상의 로컬 본문입니다.");
  await saved(page);
  await create(page, "공유 미리보기 출발");
  await source(page);
  await body(page, "---\ntype: Book\n---\n[[공유 미리보기 대상]]\n\n편집 위치");
  await saved(page);
  await live(page);
}

test("S29a body focus previews without editing and Enter opens only the focused mark", async ({
  page,
}) => {
  await linkedNotes(page);
  const link = page.locator(
    '.cm-note-link[data-link-target="공유 미리보기 대상"]',
  );
  await expect(link).toBeVisible();
  const before = await editor(page).textContent();
  await editor(page).focus();
  const selection = () =>
    editor(page).evaluate((element) => {
      const dom = element as HTMLElement & {
        cmTile?: {
          root: {
            view: {
              state: {
                doc: { toString(): string };
                selection: { main: { anchor: number; head: number } };
              };
            };
          };
        };
      };
      const state = dom.cmTile!.root.view.state;
      return {
        body: state.doc.toString(),
        anchor: state.selection.main.anchor,
        head: state.selection.main.head,
      };
    });
  const originalSelection = await selection();
  const persistedBefore = (await rawNotes(page))[
    filenameFor("공유 미리보기 출발")
  ].raw;
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  expect(await selection()).toEqual(originalSelection);
  await expect(page.getByRole("tooltip")).toContainText("대상의 로컬 본문");
  await expect(editor(page)).toHaveText(before!);
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "공유 미리보기 대상", exact: true }),
  ).toBeVisible();
  expect((await rawNotes(page))[filenameFor("공유 미리보기 출발")].raw).toBe(
    persistedBefore,
  );
});

test("S29a graph hover uses the same preview and first click opens", async ({
  page,
}) => {
  await linkedNotes(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  const node = page
    .locator(".graph-node")
    .filter({ hasText: "공유 미리보기 대상" });
  await node.hover();
  await expect(page.getByRole("tooltip")).toContainText("대상의 로컬 본문");
  await node.click();
  await expect(
    page.getByRole("heading", { name: "공유 미리보기 대상", exact: true }),
  ).toBeVisible();
});

test("S29b add property is compact and keyboard name-to-value commits only on Enter", async ({
  page,
}) => {
  await linkedNotes(page);
  await page.getByText("속성", { exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "속성 이름 검색" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  const name = page.getByRole("combobox", { name: "속성 이름 검색" });
  await expect(name).toBeFocused();
  await name.fill("customField");
  await name.press("Tab");
  const value = page.getByLabel("customField 값", { exact: true });
  await expect(value).toBeFocused();
  await value.fill("아직 초안");
  await value.press("Enter");
  await expect(
    page.getByRole("button", { name: "customField 값 편집", exact: true }),
  ).toHaveText("아직 초안");
  await expect(name).toHaveCount(0);
});

test("S29d settings categories stay in a left vertical sidebar at narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const appearance = page.getByRole("button", { name: "화면", exact: true });
  const writing = page.getByRole("button", { name: "글쓰기", exact: true });
  const a = (await appearance.boundingBox())!;
  const w = (await writing.boundingBox())!;
  expect(Math.abs(a.x - w.x)).toBeLessThan(2);
  expect(w.y).toBeGreaterThan(a.y + a.height - 1);
  const content = (await page
    .getByRole("region", { name: "화면 설정" })
    .boundingBox())!;
  expect(content.x).toBeGreaterThan(a.x + a.width);
  const pasteWordHeight = await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .evaluate((button) => {
      const node = button.firstChild!;
      const from = node.textContent!.indexOf("붙여넣기");
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, from + 4);
      return range.getBoundingClientRect().height;
    });
  expect(pasteWordHeight).toBeLessThan(28);
});

test("S29d 320px theme choices remain readable horizontal radio rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await demo(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const options = page.locator(".theme-options label");
  const first = (await options.nth(0).boundingBox())!;
  const next = (await options.nth(1).boundingBox())!;
  expect(Math.abs(first.x - next.x)).toBeLessThan(2);
  expect(next.y).toBeGreaterThanOrEqual(first.y + first.height);
  expect(first.width).toBeGreaterThan(100);
  for (const label of await options.locator("span").all())
    expect((await label.boundingBox())!.height).toBeLessThan(28);
});

test("S29a body hover is read-only and normal click still edits while modifier click opens", async ({
  page,
}) => {
  await linkedNotes(page);
  const link = page.locator(
    '.cm-note-link[data-link-target="공유 미리보기 대상"]',
  );
  await link.hover();
  await expect(page.getByRole("tooltip")).toContainText("대상의 로컬 본문");
  await link.click();
  await expect(editor(page)).toContainText("[[공유 미리보기 대상]]");
  await expect(
    page.getByRole("heading", { name: "공유 미리보기 출발", exact: true }),
  ).toBeVisible();
  await editor(page).press("ControlOrMeta+End");
  await link.click({ modifiers: ["ControlOrMeta"] });
  await expect(
    page.getByRole("heading", { name: "공유 미리보기 대상", exact: true }),
  ).toBeVisible();
});

test("S29d narrow settings keep the entire sticky Apply and Cancel buttons visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await demo(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  const dialog = (await page.getByRole("dialog").boundingBox())!;
  for (const name of ["적용", "취소"]) {
    const button = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(button.y + button.height).toBeLessThanOrEqual(
      dialog.y + dialog.height - 1,
    );
    expect(button.height).toBeGreaterThanOrEqual(40);
  }
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const width of [320, 390])
  test(`S29d ${width}px tall settings keep actions reachable with pointer and keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 760 });
    await demo(page);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page
      .getByRole("button", { name: "링크 붙여넣기", exact: true })
      .click();
    for (let index = 0; index < 3; index++)
      await page
        .getByRole("button", { name: "양식 추가", exact: true })
        .click();
    const panel = page.getByRole("dialog");
    for (const end of [false, true]) {
      await panel.evaluate((element, scrollEnd) => {
        element.scrollTop = scrollEnd ? element.scrollHeight : 0;
      }, end);
      const bounds = (await panel.boundingBox())!;
      for (const name of ["적용", "취소"]) {
        const button = (await page
          .getByRole("button", { name, exact: true })
          .boundingBox())!;
        expect(button.y + button.height).toBeLessThanOrEqual(
          bounds.y + bounds.height - 1,
        );
        expect(button.y).toBeGreaterThanOrEqual(bounds.y);
      }
    }
    if (width === 320)
      await page.getByRole("button", { name: "취소", exact: true }).click();
    else {
      const apply = page.getByRole("button", { name: "적용", exact: true });
      await apply.focus();
      await page.keyboard.press("Enter");
    }
    await expect(panel).toHaveCount(0);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page
      .getByRole("button", { name: "링크 붙여넣기", exact: true })
      .click();
    await expect(page.locator(".template-card")).toHaveCount(
      width === 320 ? 0 : 3,
    );
  });
