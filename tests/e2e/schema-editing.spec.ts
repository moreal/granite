import { test, expect } from "@playwright/test";
import { body, create, demo, editor, source } from "../helpers/ui";

test("S21 typed panel creates metadata, adds author/about, focuses value and updates graph", async ({
  page,
}) => {
  await demo(page);
  await create(page, "속성 만들기");
  await page.getByText("속성", { exact: true }).click();
  await page.getByRole("combobox", { name: "노트 유형" }).fill("Book");
  await page.getByRole("combobox", { name: "노트 유형" }).press("Escape");
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "속성 이름 검색" });
  const yaml = page.getByLabel("속성 YAML 원문");
  await picker.fill("author");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^author$/ }) })
    .click();
  const value = page.getByRole("combobox", { name: "author 값", exact: true });
  await expect(value).toBeFocused();
  await expect(yaml).toHaveValue("type: Book");
  await value.fill("[[새 저자]]");
  await value.press("Enter");
  await picker.fill("about");
  await picker.press("Enter");
  await page
    .getByRole("combobox", { name: "about 값", exact: true })
    .fill("[[주제]]");
  await page
    .getByRole("combobox", { name: "about 값", exact: true })
    .press("ControlOrMeta+s");
  await expect(yaml).toHaveValue(
    'type: Book\n"author": "[[새 저자]]"\n"about": "[[주제]]"',
  );
  await page.getByText("노트 그래프", { exact: true }).click();
  await expect(page.getByRole("region", { name: "노트 그래프" })).toContainText(
    "새 저자",
  );
  await expect(page.getByRole("region", { name: "노트 그래프" })).toContainText(
    "주제",
  );
  await picker.fill("author");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("S21 raw YAML key/type completion preserves source, dismisses and supports native undo", async ({
  page,
}) => {
  await demo(page);
  await create(page, "YAML 완성");
  await source(page);
  await body(page, "---\n# keep\ntype: Book\nau\n---\nprose");
  await page.getByText("속성", { exact: true }).click();
  await page.getByText("YAML 원문 편집", { exact: true }).click();
  const yaml = page.getByLabel("속성 YAML 원문");
  await yaml.focus();
  await yaml.press("ControlOrMeta+End");
  await yaml.press("Control+Space");
  await expect(
    page.getByRole("option").filter({ hasText: "author" }),
  ).toBeVisible();
  await yaml.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await yaml.press("Control+Space");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^author$/ }) })
    .click();
  await expect(yaml).toHaveValue("# keep\ntype: Book\nauthor: ");
  await yaml.press("ControlOrMeta+z");
  await expect(yaml).toHaveValue("# keep\ntype: Book\nau");
  await yaml.fill('type: "https://schema.org/Bo"');
  await yaml.press("ArrowLeft");
  await yaml.press("Control+Space");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^Book$/ }) })
    .click();
  await expect(yaml).toHaveValue('type: "https://schema.org/Book"');
});

test("S21 CodeMirror plugin completes frontmatter in source and live surfaces with undo", async ({
  page,
}) => {
  await demo(page);
  await create(page, "본문 속성 완성");
  await source(page);
  const text = "---\ntype: Book\nauth\n---\nprose";
  await body(page, text);
  await editor(page).press("ControlOrMeta+Home");
  await editor(page).press("ArrowDown");
  await editor(page).press("ArrowDown");
  await editor(page).press("End");
  await editor(page).press("Control+Space");
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText(
    "author",
  );
  await editor(page).press("Enter");
  await expect(editor(page)).toContainText("author:");
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).toContainText("auth");
  await editor(page).press("Escape");
  // The same registered provider remains active when metadata is revealed in live mode.
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await editor(page).press("ControlOrMeta+Home");
  await editor(page).press("ArrowDown");
  await editor(page).press("ArrowDown");
  await editor(page).press("End");
  await editor(page).press("Control+Space");
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText(
    "author",
  );
});

for (const width of [320, 390])
  for (const colorScheme of ["light", "dark"] as const)
    test(`S22 property controls ${width} ${colorScheme} cropped`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 844 });
      await demo(page);
      await create(page, "아주 긴 한국어 이름과 長い中国語 이름 속성");
      await page.getByText("속성", { exact: true }).click();
      const panel = page.locator(".note-properties");
      const picker = page.getByRole("combobox", { name: "노트 유형" });
      await picker.focus();
      await picker.press("Escape");
      await panel.screenshot({
        path: testInfo.outputPath(
          `granite-property-create-${width}-${colorScheme}.png`,
        ),
      });
      await picker.fill("");
      await expect(page.getByRole("listbox")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const bounds = await panel.boundingBox();
      const popup = await page.getByRole("listbox").boundingBox();
      if (!bounds || !popup) throw Error("Missing component bounds");
      await page.screenshot({
        path: testInfo.outputPath(
          `granite-property-open-${width}-${colorScheme}.png`,
        ),
        clip: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: Math.max(bounds.height, popup.y + popup.height - bounds.y),
        },
      });
    });

test("S21 raw YAML dismisses completion when caret moves or text is selected", async ({
  page,
}) => {
  await demo(page);
  await create(page, "커서 범위 보호");
  await source(page);
  await body(page, "---\ntype: Book\nauthor\n---\nprose");
  await page.getByText("속성", { exact: true }).click();
  await page.getByText("YAML 원문 편집", { exact: true }).click();
  const yaml = page.getByLabel("속성 YAML 원문");
  for (const key of ["Home", "ArrowLeft", "ControlOrMeta+a"]) {
    await yaml.fill("type: Book\nauthor");
    await yaml.press("Control+Space");
    await expect(page.getByRole("option")).toBeVisible();
    await yaml.press(key);
    await expect(page.getByRole("option")).toHaveCount(0);
  }
  await yaml.press("Enter");
  await expect(yaml).toHaveValue("\n");
});
