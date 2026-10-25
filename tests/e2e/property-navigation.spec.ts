import { test, expect, type Page } from "@playwright/test";
import { filenameFor } from "../../src/domain/notes";
import {
  body,
  create,
  demo,
  disableAutomaticFormatting,
  live,
  openListed,
  rawNotes,
  saved,
  source,
} from "../helpers/ui";

const author = "작[가]\\이름";
const documentTitle = "속성에서 연결 열기";
const raw = `---\ntype: Book\nauthor: ${JSON.stringify("앞 [[작\\[가\\]\\\\이름]] 뒤 [[주제]]")} # 보존\nabout:\n  - '[[주제]]와 [[없는 대상]]'\n  - false\n  - 3\n  - '<img src=x onerror=alert(1)> [[javascript:alert(1)]]'\n  - '[[목\\[록\\]\\\\제목]] / [[닫히지 않은'\ncount: 2\n---\n본문 보존`;
async function setup(page: Page, markdown = raw) {
  await disableAutomaticFormatting(page);
  await demo(page);
  await create(page, author);
  await create(page, "주제");
  await create(page, "목[록]\\제목");
  await create(page, documentTitle);
  await source(page);
  await body(page, markdown);
  await saved(page);
  await live(page);
  await page.getByText("속성", { exact: true }).click();
}

test("S26 saved scalar and list links open notes by ordinary click and Enter after reopen", async ({
  page,
}) => {
  await setup(page);
  const properties = page.locator(".note-properties");
  await expect(properties).toContainText("앞");
  await expect(properties).toContainText("뒤");
  await properties
    .getByRole("button", { name: `${author} 노트 열기`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: author, exact: true }),
  ).toBeVisible();
  await openListed(page, documentTitle);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: documentTitle, exact: true }),
  ).toBeVisible();
  await page.getByText("속성", { exact: true }).click();
  const about = properties
    .locator(".property-row")
    .filter({ has: page.locator("dt", { hasText: /^about$/ }) });
  await expect(about).toContainText("false, 3");
  await expect(about).toContainText("[[닫히지 않은");
  await about.getByRole("button", { name: "목[록]\\제목 노트 열기" }).click();
  await expect(
    page.getByRole("heading", { name: "목[록]\\제목", exact: true }),
  ).toBeVisible();
  await openListed(page, documentTitle);
  await expect(
    properties.getByRole("button", {
      name: "닫히지 않은 노트 열기",
      exact: true,
    }),
  ).toHaveCount(0);
  await about
    .getByRole("button", { name: "주제 노트 열기", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "주제", exact: true }),
  ).toBeVisible();
  expect((await rawNotes(page))[filenameFor(documentTitle)].raw).toContain(raw);
  await page.getByText("노트 그래프", { exact: true }).click();
  await expect(page.getByRole("region", { name: "노트 그래프" })).toContainText(
    documentTitle,
  );
});

test("S26 pending invalid form draft blocks property navigation without losing value, error, or focus", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "count 값 편집", exact: true })
    .click();
  const input = page.getByRole("textbox", { name: "count 값", exact: true });
  await input.fill("not a number");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toContainText("숫자");
  await page
    .getByRole("button", { name: `${author} 노트 열기`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: documentTitle, exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("not a number");
  await expect(input).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("숫자");
  await expect(
    page.getByRole("status").filter({ hasText: "적용하거나 취소" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "주제 노트 열기", exact: true })
    .first()
    .press("Enter");
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "count 값 편집", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: `${author} 노트 열기`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: author, exact: true }),
  ).toBeVisible();
  expect((await rawNotes(page))[filenameFor(documentTitle)].raw).toContain(raw);
});

test("S26 missing property targets use existing confirmation and HTML or URL-like titles stay inert", async ({
  page,
}) => {
  await setup(page);
  const properties = page.locator(".note-properties");
  await expect(properties.locator("img, a[href^='javascript:']")).toHaveCount(
    0,
  );
  await expect(properties).toContainText("<img src=x onerror=alert(1)>");
  await properties
    .getByRole("button", { name: "없는 대상 노트 열기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "아직 없는 노트예요" }),
  ).toBeVisible();
  await expect(page.getByLabel("새 노트 제목")).toHaveValue("없는 대상");
  expect((await rawNotes(page))[filenameFor("없는 대상")]).toBeUndefined();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await properties
    .getByRole("button", { name: "javascript:alert(1) 노트 열기", exact: true })
    .press("Enter");
  await expect(page.getByLabel("새 노트 제목")).toHaveValue(
    "javascript:alert(1)",
  );
  expect(
    (await rawNotes(page))[filenameFor("javascript:alert(1)")],
  ).toBeUndefined();
});

for (const width of [320, 390])
  for (const action of ["취소", "추가 / 적용"])
    test(`S25/S26 open type popup button ${action} completes with one pointer click at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(
        page,
        `---\ntype: Book\nauthor: ${JSON.stringify("[[작\\[가\\]\\\\이름]]")}\n---\n본문 보존`,
      );
      const typeButton = page.getByRole("button", {
        name: "type 값 편집",
        exact: true,
      });
      await typeButton.click();
      const input = page.getByRole("combobox", {
        name: "type 값",
        exact: true,
      });
      await input.fill("Per");
      await expect(
        page.getByRole("listbox", { name: "Schema.org 유형" }),
      ).toBeVisible();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(input).toHaveCount(0);
      await expect(typeButton).toBeFocused();
      await saved(page);
      const persisted = (await rawNotes(page))[filenameFor(documentTitle)].raw;
      expect(persisted).toContain(
        action === "취소" ? "type: Book" : 'type: "Per"',
      );
      await page
        .getByRole("button", { name: `${author} 노트 열기`, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: author, exact: true }),
      ).toBeVisible();
      await openListed(page, documentTitle);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: documentTitle, exact: true }),
      ).toBeVisible();
      expect((await rawNotes(page))[filenameFor(documentTitle)].raw).toBe(
        persisted,
      );
    });

for (const width of [320, 390, 960])
  for (const colorScheme of ["light", "dark"] as const)
    test(`S26 property links and pending type draft ${width} ${colorScheme} rendered`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme });
      await setup(
        page,
        `---\ntype: Book\nauthor: ${JSON.stringify("앞 [[작\\[가\\]\\\\이름]] 뒤 [[주제]]")}\ncount: 2\n---\n본문 보존`,
      );
      const panel = page.locator(".note-properties");
      const text = await panel
        .locator(".property-value-text")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            width: element.getBoundingClientRect().width,
            panelWidth: element
              .closest(".note-properties")!
              .getBoundingClientRect().width,
          })),
        );
      for (const value of text) {
        expect(value.width).toBeGreaterThanOrEqual(
          Math.min(240, value.panelWidth) - 2,
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await panel.screenshot({
        path: info.outputPath(`property-links-${width}-${colorScheme}.png`),
      });
      await page
        .getByRole("button", { name: "type 값 편집", exact: true })
        .click();
      const input = page.getByRole("combobox", {
        name: "type 값",
        exact: true,
      });
      await input.fill("Per");
      await page
        .getByRole("button", { name: `${author} 노트 열기`, exact: true })
        .click();
      await expect(input).toHaveValue("Per");
      await expect(input).toBeFocused();
      await expect(
        page.getByRole("heading", { name: documentTitle, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "적용하거나 취소" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await panel.screenshot({
        path: info.outputPath(
          `property-link-guard-${width}-${colorScheme}.png`,
        ),
      });
    });
