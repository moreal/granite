import type { EditorView } from "@codemirror/view";
import { test, expect, type Page } from "@playwright/test";
import { formatWithWarnings } from "@hongdown/wasm";
import { filenameFor } from "../../src/domain/notes";
import {
  body,
  create,
  demo,
  editor,
  source,
  saved,
  rawNotes,
  redo,
} from "../helpers/ui";

async function editorSource(page: Page) {
  return editor(page).evaluate((element) =>
    (
      element as HTMLElement & { cmTile: { root: { view: EditorView } } }
    ).cmTile.root.view.state.doc.toString(),
  );
}

const original =
  "# 제목 Heading\n\n## 작은 Heading\n\n\"Hello\" 'friend' -- world...\n\n" +
  "한글 문장을 길게 씁니다. ".repeat(12) +
  '\n\n[[연결 노트]] $x+1$\n\n```mermaid\ngraph TD\n A-->B\n```\n\n```typescript\n// # hidden heading\nconst value = "unchanged...";\n```\n\n[site](https://example.com)\n';

for (const trigger of ["idle", "CmdS"] as const) {
  test(`S31 CMS defaults through real ${trigger} worker persist, reload and undo`, async ({
    page,
  }, testInfo) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("hongdown")) requested.push(request.url());
    });
    const expected = (await formatWithWarnings(original, {})).output;
    if (trigger === "CmdS") await page.clock.install();
    await demo(page, { panels: false });
    const title = `CMS 기본값 ${trigger}`;
    await create(page, title);
    await source(page);
    if (trigger === "CmdS") {
      await page.clock.pauseAt(new Date(Date.now() + 10_000));
    }
    await body(page, original);
    if (trigger === "CmdS") {
      // Settle CodeMirror input and its 100ms completion probe below the 1500ms idle deadline.
      await page.clock.runFor(500);
      await editor(page).press("ControlOrMeta+s");
      await page.clock.runFor(100);
    }
    await expect.poll(() => editorSource(page)).toBe(expected);
    expect(requested.some((url) => url.includes("hongdown.worker"))).toBe(true);
    if (trigger === "CmdS") await page.clock.resume();
    await expect(page.locator(".auto-format-status")).toHaveCount(0);
    await saved(page);
    const filename = filenameFor(title);
    await expect
      .poll(async () => (await rawNotes(page))[filename]?.raw)
      .toContain(expected);
    await editor(page).press("ControlOrMeta+z");
    await expect.poll(() => editorSource(page)).toBe(original);
    await page.waitForTimeout(1800);
    await expect.poll(() => editorSource(page)).toBe(original);
    await redo(page);
    await expect.poll(() => editorSource(page)).toBe(expected);
    await saved(page);
    await expect
      .poll(async () => (await rawNotes(page))[filename]?.raw)
      .toContain(expected);
    await page.reload();
    await source(page);
    await expect.poll(() => editorSource(page)).toBe(expected);
    await page
      .getByRole("button", { name: "라이브 프리뷰", exact: true })
      .click();
    await expect(page.locator(".cm-rich-mermaid")).toBeVisible();
    await expect(page.locator(".cm-rich-math").first()).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "목차" }),
    ).not.toContainText("hidden heading");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: testInfo.outputPath(`cms-defaults-${trigger}-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("S31 unsafe wiki typography refuses formatting and saves original", async ({
  page,
}) => {
  await demo(page);
  await create(page, "위키 대상 보존");
  await source(page);
  const raw = '[["Quoted note"]]';
  await body(page, raw);
  await editor(page).press("ControlOrMeta+s");
  await expect(page.locator(".auto-format-status")).toContainText(
    "연결·이미지·수식",
  );
  await expect(editor(page)).toHaveText(raw);
  await saved(page);
  await expect
    .poll(
      async () => (await rawNotes(page))[filenameFor("위키 대상 보존")]?.raw,
    )
    .toContain(raw);
  await page.reload();
  await source(page);
  await expect(editor(page)).toHaveText(raw);
});
