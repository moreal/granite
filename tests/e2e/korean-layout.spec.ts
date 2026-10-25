import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  editor,
  rawNotes,
  saved,
  source,
} from "../helpers/ui";

test("S04/S12/S17 Korean headings and graph labels share their start edge", async ({
  page,
}) => {
  await demo(page);
  await create(page, "한국어 정렬 확인");
  await source(page);
  const original =
    "##   제목의 시작\n\n한글 어절과 (괄호), 문장부호를 확인합니다. 한글과 👨‍👩‍👧‍👦도 보존합니다.\n\n[[짧음]] [[길이가 훨씬 긴 한국어 노트 제목]]\n\n끝";
  await body(page, original);
  await saved(page);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  const heading = page.locator(".cm-heading");
  await expect(heading).toHaveText("제목의 시작");
  const positions = await heading.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return {
      text: range.getBoundingClientRect().x,
      line: el.getBoundingClientRect().x,
    };
  });
  expect(Math.abs(positions.text - positions.line)).toBeLessThan(1);
  await page.getByText("노트 그래프", { exact: true }).click();
  const nodes = page.locator(".graph-node");
  await expect(nodes).toHaveCount(2);
  const starts = await nodes.evaluateAll((elements) =>
    elements.map(
      (el) => el.querySelector(".graph-node-title")!.getBoundingClientRect().x,
    ),
  );
  expect(Math.abs(starts[0] - starts[1])).toBeLessThan(1);
  await expect(editor(page)).toHaveCSS("word-break", "keep-all");
  await expect(editor(page)).toHaveCSS("line-break", "strict");
  await expect(editor(page)).toHaveCSS("overflow-wrap", "anywhere");
  await nodes.first().focus();
  await expect(nodes.first()).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await nodes.first().scrollIntoViewIfNeeded();
      const narrowStarts = await nodes.evaluateAll((elements) =>
        elements.map(
          (el) =>
            el.querySelector(".graph-node-title")!.getBoundingClientRect().x,
        ),
      );
      expect(Math.abs(narrowStarts[0] - narrowStarts[1])).toBeLessThan(1);
      await page.locator(".note-graph").screenshot({
        path: `docs/screenshots/korean-graph-${theme}-${width}.png`,
      });
      await heading.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/screenshots/korean-layout-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await source(page);
  await expect(editor(page)).toHaveCSS("word-break", "normal");
  await expect(editor(page)).toContainText("##   제목의 시작");
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes(original),
    ),
  ).toBe(true);
  await nodes.first().click();
  await expect(
    page.getByRole("heading", { name: "아직 없는 노트예요" }),
  ).toBeVisible();
});

test("S12 narrow Korean prose wraps words and preserves grapheme clusters", async ({
  page,
}) => {
  await demo(page);
  await create(page, "줄바꿈 확인");
  await source(page);
  const word = "가나다라마";
  const cluster = "한";
  const family = "👨‍👩‍👧‍👦";
  const original = `${word} ${word} (${word}), ${cluster} ${family}\n\n${"아".repeat(120)}\n\n끝`;
  await body(page, original);
  await saved(page);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 900 });
  const result = await editor(page).evaluate(
    (el, { word, cluster, family }) => {
      const line = el.querySelector(".cm-line")!;
      const text = line.firstChild!;
      const source = text.textContent!;
      const rects = (start: number, length: number) => {
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + length);
        return Array.from(range.getClientRects())
          .filter((rect) => rect.width > 0)
          .map((rect) => rect.y);
      };
      return {
        wordRows: [0, source.indexOf(word, word.length)].map(
          (start) => new Set(rects(start, word.length)).size,
        ),
        clusterRows: new Set(rects(source.indexOf(cluster), cluster.length))
          .size,
        familyRows: new Set(rects(source.indexOf(family), family.length)).size,
        noOverflow: el.scrollWidth <= el.clientWidth,
      };
    },
    { word, cluster, family },
  );
  expect(result.wordRows).toEqual([1, 1]);
  expect(result.clusterRows).toBe(1);
  expect(result.familyRows).toBe(1);
  expect(result.noOverflow).toBe(true);
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes(original),
    ),
  ).toBe(true);
});

test("S04/S12 active inline and indented code keep syntax wrapping", async ({
  page,
}) => {
  await demo(page);
  await create(page, "코드 줄바꿈");
  await source(page);
  const original = "`한글 코드`\n\n    한글 들여쓴 코드\n\n끝";
  await body(page, original);
  await saved(page);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator(".cm-code-layout")).toHaveCount(2);
  await page.locator(".cm-code-layout").first().click();
  await expect(page.locator(".cm-code-layout").first()).toHaveText(
    "`한글 코드`",
  );
  for (const code of await page.locator(".cm-code-layout").all()) {
    await expect(code).toHaveCSS("word-break", "normal");
    await expect(code).toHaveCSS("line-break", "auto");
  }
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.includes(original),
    ),
  ).toBe(true);
});
