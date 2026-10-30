import type { EditorView } from "@codemirror/view";
import { test, expect, type Page } from "@playwright/test";
import { formatWithWarnings } from "@hongdown/wasm";
import {
  demo,
  editor,
  body,
  disableAutomaticFormatting,
  source,
} from "../helpers/ui";

async function select(page: Page, anchor: number, head = anchor) {
  await editor(page).evaluate(
    (element, range) => {
      (
        element as HTMLElement & { cmTile: { root: { view: EditorView } } }
      ).cmTile.root.view.dispatch({ selection: range });
    },
    { anchor, head },
  );
}
async function raw(page: Page) {
  return editor(page).evaluate((element) =>
    (
      element as HTMLElement & { cmTile: { root: { view: EditorView } } }
    ).cmTile.root.view.state.doc.toString(),
  );
}

for (const width of [1440, 390]) {
  test(`S32 ${width}px formatted headings and contextual reference editing`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({
      reducedMotion: "reduce",
      colorScheme: width === 390 ? "dark" : "light",
    });
    await disableAutomaticFormatting(page);
    await demo(page, { panels: false });
    const formatted = (
      await formatWithWarnings(
        "# 제목의 크기\n\n## 다음 생각\n\n### 작은 생각\n\n본문에서 [출처][ref]를 읽습니다.\n",
        {},
      )
    ).output;
    const text =
      formatted +
      '\n# 직접 쓴 제목\n\n## 두 번째 제목\n\n[ref]:\n  <https://example.com>\n  "참고 제목"\n\n[other]: https://example.org\n\n이어 쓰는 문장';
    await body(page, text);
    await select(page, text.length);
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.locator(".cm-heading").evaluateAll((elements) =>
      elements.map((el) => ({
        text: el.textContent,
        size: parseFloat(getComputedStyle(el).fontSize),
        leading: parseFloat(getComputedStyle(el).lineHeight),
        level: el.classList.contains("cm-heading-1")
          ? 1
          : el.classList.contains("cm-heading-2")
            ? 2
            : 3,
      })),
    );
    expect(metrics).toHaveLength(7);
    for (const metric of metrics) {
      expect(metric.size).toBeCloseTo(
        19.2 * { 1: 1.6, 2: 1.35, 3: 1.15 }[metric.level]!,
      );
      expect(metric.leading).toBeCloseTo(
        metric.size * (metric.level <= 2 ? 1.3 : 1.6),
      );
    }
    for (const marker of await page.locator(".cm-md-setext").all()) {
      expect(
        await marker.evaluate((el) => getComputedStyle(el).fontFamily),
      ).toContain("monospace");
      expect(await marker.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
        await marker.evaluate(
          (el) => getComputedStyle(el.parentElement!).fontSize,
        ),
      );
    }
    const definitions = page.locator(".cm-reference-definition");
    const quiet = page.locator(".cm-reference-definition--quiet");
    await expect(quiet).toHaveCount(4);
    const before = await definitions.evaluateAll((elements) =>
      elements.map((el) => ({
        height: el.getBoundingClientRect().height,
        size: getComputedStyle(el).fontSize,
        color: getComputedStyle(el).color,
      })),
    );
    await definitions.nth(1).hover();
    await page.screenshot({
      path: testInfo.outputPath(`reference-hover-${width}.png`),
    });
    await page.mouse.move(0, 0);
    await select(page, text.indexOf('"참고 제목"') + 2);
    await expect(quiet).toHaveCount(1);
    const after = await definitions.evaluateAll((elements) =>
      elements.map((el) => ({
        height: el.getBoundingClientRect().height,
        size: getComputedStyle(el).fontSize,
        color: getComputedStyle(el).color,
      })),
    );
    expect(after.map(({ height, size }) => ({ height, size }))).toEqual(
      before.map(({ height, size }) => ({ height, size })),
    );
    expect(after[0].color).not.toBe(before[0].color);
    await page.screenshot({
      path: testInfo.outputPath(`reference-active-${width}.png`),
    });
    // Syntax highlighting of labels/URLs must also brighten while editing.
    expect(
      await definitions
        .nth(1)
        .locator("span")
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe(after[0].color);
    await editor(page).press("ArrowLeft");
    await expect(quiet).toHaveCount(1);
    await select(page, text.indexOf("[ref]:"), text.indexOf("[other]:") + 3);
    await expect(quiet).toHaveCount(0);
    await select(page, text.length);
    await expect(quiet).toHaveCount(4);
    await definitions.first().click();
    await expect(quiet).toHaveCount(1);
    expect(await raw(page)).toBe(text);
    // A genuine edit and native undo keep the reference source and preview intact.
    await page.waitForTimeout(600);
    const position = text.indexOf("example.com") + 7;
    await select(page, position);
    await editor(page).focus();
    await page.keyboard.insertText("x");
    expect(await raw(page)).toBe(
      text.slice(0, position) + "x" + text.slice(position),
    );
    await editor(page).press("ControlOrMeta+z");
    expect(await raw(page)).toBe(text);
    await select(page, text.length);
    await source(page);
    await expect(definitions).toHaveCount(0);
    expect(await raw(page)).toBe(text);
    await page
      .getByRole("button", { name: "라이브 프리뷰", exact: true })
      .click();
    await expect(quiet).toHaveCount(4);
    expect(await raw(page)).toBe(text);
    await page.locator(".cm-scroller").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: testInfo.outputPath(`headings-${width}.png`),
    });
    await definitions.first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`references-${width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

// S32b/c: exercise actual pointer events and rendered CSS interpolation.
test("S32 reference hover groups and reversible color feedback preserve editor state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await disableAutomaticFormatting(page);
  await demo(page, { panels: false });
  const text =
    '본문\n\n[ref]:\n  <https://example.com>\n  "제목"\n[other]: https://example.org\n\n끝';
  await body(page, text);
  await select(page, text.length);
  const lines = page.locator(".cm-reference-definition");
  const color = () =>
    lines.first().evaluate((el) => getComputedStyle(el).color);
  const settle = () =>
    lines.evaluateAll(async (elements) => {
      await Promise.all(
        elements
          .flatMap((el) => el.getAnimations())
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
  await settle();
  const quiet = await color();
  const bright = await lines
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--text").trim());
  expect(bright).toBeTruthy();
  await editor(page).evaluate((element) => {
    const host = element as HTMLElement & {
      cmTile: { root: { view: EditorView } };
      hoverSnapshot?: unknown;
    };
    const view = host.cmTile.root.view;
    host.hoverSnapshot = {
      view,
      state: view.state,
      lines: [...view.contentDOM.children],
    };
  });
  const sample = () =>
    lines.first().evaluate(async (el) => {
      const values: string[] = [];
      const start = performance.now();
      do {
        await new Promise(requestAnimationFrame);
        values.push(getComputedStyle(el).color);
      } while (performance.now() - start < 200);
      return values;
    });
  // Hybrid fine-pointer devices must also ignore an actual touch event.
  await lines.first().dispatchEvent("pointerover", { pointerType: "touch" });
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
  await lines.nth(1).hover();
  const entering = await sample();
  const lit = await color();
  expect(lit).not.toBe(quiet);
  expect(entering.some((value) => value !== quiet && value !== lit)).toBe(true);
  expect(
    await lines.evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).color),
    ),
  ).toEqual([lit, lit, lit, quiet]);
  await page.mouse.move(0, 0);
  const leaving = await sample();
  expect(leaving.some((value) => value !== quiet && value !== lit)).toBe(true);
  expect(await color()).toBe(quiet);
  // Reverse a real running transition before it completes.
  await lines.nth(2).hover();
  const running = await lines.first().evaluate(async (el) => {
    for (let frame = 0; frame < 10; frame++) {
      await new Promise(requestAnimationFrame);
      if (
        el
          .getAnimations()
          .some((animation) => Number(animation.currentTime) > 0)
      )
        return true;
    }
    return false;
  });
  expect(running).toBe(true);
  const interrupted = await color();
  expect(interrupted).not.toBe(quiet);
  await page.mouse.move(0, 0);
  await settle();
  expect(await color()).toBe(quiet);
  expect(
    await editor(page).evaluate((element) => {
      const host = element as HTMLElement & {
        cmTile: { root: { view: EditorView } };
        hoverSnapshot: { view: EditorView; state: unknown; lines: Element[] };
      };
      const view = host.cmTile.root.view;
      return (
        view === host.hoverSnapshot.view &&
        view.state === host.hoverSnapshot.state &&
        [...view.contentDOM.children].every(
          (line, index) => line === host.hoverSnapshot.lines[index],
        )
      );
    }),
  ).toBe(true);
  await select(page, text.indexOf('"제목"') + 1);
  expect(await color()).toBe(lit);
  await lines.first().hover();
  await page.mouse.move(0, 0);
  expect(await color()).toBe(lit);
  await select(page, text.length);
  await settle();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await lines.first().hover();
  expect(await color()).toBe(lit);
  expect(await lines.first().evaluate((el) => el.getAnimations().length)).toBe(
    0,
  );
  await page.mouse.move(0, 0);
  expect(await color()).toBe(quiet);
  expect(await raw(page)).toBe(text);
  await lines.first().hover();
  await source(page);
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
  await lines.first().hover();
  await page.locator(".cm-scroller").dispatchEvent("scroll");
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
  await lines.first().hover();
  await body(page, text.replace("example.com", "example.net"));
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
});

test("S32 touch does not acquire sticky reference hover", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await disableAutomaticFormatting(page);
  await demo(page, { panels: false });
  const text = "본문\n\n[ref]: https://example.com\n\n끝";
  await body(page, text);
  await select(page, text.length);
  const definition = page.locator(".cm-reference-definition");
  await definition.dispatchEvent("pointerover", { pointerType: "touch" });
  await expect(page.locator("[data-reference-hover]")).toHaveCount(0);
  await context.close();
});
