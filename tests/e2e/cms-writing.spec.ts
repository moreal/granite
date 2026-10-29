import type { EditorView } from "@codemirror/view";
import { test, expect } from "@playwright/test";
import { demo, editor, body, disableAutomaticFormatting } from "../helpers/ui";
test("S30 default CMS plane and contextual outline preserve the mounted document", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page, { panels: false });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".connections")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "노트 목록 열기" }),
  ).toBeVisible();
  await body(
    page,
    "# 첫 구간\n\n생각을 적습니다.\n\n## 다음 구간\n\n이어 씁니다.",
  );
  await expect(page.getByRole("navigation", { name: "목차" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "목차" })
    .getByRole("button", { name: "다음 구간" })
    .click();
  await expect(editor(page)).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "목차" })
      .getByRole("button", { name: "다음 구간" }),
  ).toHaveAttribute("aria-current", "location");
  expect(
    await editor(page).evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("19.2px");
  const original = await editor(page).elementHandle();
  const cm = await editor(page).evaluateHandle(
    (element) =>
      (element as HTMLElement & { cmTile: { root: { view: EditorView } } })
        .cmTile.root.view,
  );
  const doc = await cm.evaluateHandle((view) => view.state.doc);
  const selection = await cm.evaluate((view) => ({
    anchor: view.state.selection.main.anchor,
    head: view.state.selection.main.head,
  }));
  const raw = await cm.evaluate((view) => view.state.doc.toString());
  const before = await editor(page).textContent();
  await page
    .getByRole("button", { name: "노트 목록 열기", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "노트 검색" })).toBeVisible();
  await page
    .getByRole("button", { name: "노트 목록 접기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "연결 패널 열기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "연결 패널 접기", exact: true })
    .click();
  await page.locator(".note-properties > summary").click();
  await page.locator(".note-properties > summary").click();
  expect(
    await editor(page).evaluate(
      (element, first) =>
        (element as HTMLElement & { cmTile: { root: { view: EditorView } } })
          .cmTile.root.view === first,
      cm,
    ),
  ).toBe(true);
  expect(
    await cm.evaluate(
      (view, originalDoc) => view.state.doc === originalDoc,
      doc,
    ),
  ).toBe(true);
  expect(
    await cm.evaluate((view) => ({
      anchor: view.state.selection.main.anchor,
      head: view.state.selection.main.head,
    })),
  ).toEqual(selection);
  expect(
    await editor(page).evaluate(
      (element, first) => element === first,
      original,
    ),
  ).toBe(true);
  await expect(editor(page)).toHaveText(before!);
  // Separate the next native edit from CM's 500ms history grouping window.
  await page.waitForTimeout(600);
  await editor(page).focus();
  await page.keyboard.insertText(" 실행 취소 검증");
  await page
    .getByRole("button", { name: "노트 목록 열기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "노트 목록 접기", exact: true })
    .click();
  await editor(page).press("ControlOrMeta+z");
  expect(await cm.evaluate((view) => view.state.doc.toString())).toBe(raw);
});

for (const width of [320, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`S30 ${width}px ${theme} writing geometry and local font`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await disableAutomaticFormatting(page);
      const external: string[] = [];
      page.on("request", (request) => {
        if (/fonts\.(googleapis|gstatic)\.com/.test(request.url()))
          external.push(request.url());
      });
      await demo(page, { panels: false });
      await body(
        page,
        "# 생각을 이어 쓰는 시간\n\n문장의 속도에 맞춰 천천히 생각을 적습니다. 조용한 화면에서 긴 한국어 문장과 줄바꿈을 확인합니다.\n\n## 연결하는 문장\n\n**중요한 생각**과 `작은 코드`를 그대로 고칩니다.\n\n> 인용의 표시도 읽으며 고칠 수 있습니다.\n\n" +
          "이어서 쓰는 문장입니다.\n\n".repeat(35),
      );
      await page.mouse.move(width - 2, 2);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      expect(external).toEqual([]);
      const geometry = await editor(page).evaluate((el) => {
        const content = el as HTMLElement;
        const scroller = content.closest(".cm-scroller")!;
        return {
          size: getComputedStyle(content).fontSize,
          leading: getComputedStyle(content).lineHeight,
          font: getComputedStyle(content).fontFamily,
          width: content.getBoundingClientRect().width,
          pane: scroller.getBoundingClientRect().width,
          scrolls: scroller.scrollHeight > scroller.clientHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.size).toBe("19.2px");
      expect(geometry.leading).toBe("30.72px");
      expect(geometry.font).toContain("Noto Serif KR");
      expect(geometry.scrolls).toBe(true);
      expect(geometry.overflow).toBe(false);
      expect(geometry.width).toBeLessThanOrEqual(835.3);
      if (width <= 390)
        await expect(
          page.getByRole("navigation", { name: "목차" }),
        ).toBeHidden();
      await page.locator(".cm-scroller").evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({
        path: testInfo.outputPath(`cms-${width}-${theme}.png`),
      });
    });
  }
}

test("S30d long tail headings are immediately navigable before scrolling", async ({
  page,
}) => {
  await disableAutomaticFormatting(page);
  await demo(page, { panels: false });
  const text =
    "# 처음 구간\n\n" +
    "긴 문장을 이어서 적습니다. ".repeat(500) +
    "\n\n## 마지막 구간";
  await body(page, text);
  const outline = page.getByRole("navigation", { name: "목차" });
  await expect(
    outline.getByRole("button", { name: "마지막 구간", exact: true }),
  ).toBeVisible();
  await outline.getByRole("button", { name: "처음 구간", exact: true }).click();
  await outline
    .getByRole("button", { name: "마지막 구간", exact: true })
    .click();
  await expect(editor(page)).toBeFocused();
  await expect(
    outline.getByRole("button", { name: "마지막 구간", exact: true }),
  ).toHaveAttribute("aria-current", "location");
});
