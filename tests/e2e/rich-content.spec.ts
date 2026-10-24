import { test, expect } from "@playwright/test";
import {
  demo,
  create,
  source,
  body,
  saved,
  editor,
  rawNotes,
} from "../helpers/ui";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("S13 image paste persists local CAS bytes, previews after reload and rejects unsupported files", async ({
  page,
}) => {
  await demo(page);
  await create(page, "이미지 붙여넣기");
  await body(page, "앞\n\n");
  await editor(page).evaluate((el, base64) => {
    const data = new DataTransfer();
    data.items.add(
      new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        "image.png",
        { type: "image/png" },
      ),
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, png);
  await expect(editor(page)).toContainText("![이미지](assets/");
  await saved(page);
  await page.keyboard.insertText("\n\n뒤");
  await expect(page.locator(".cm-rich-image img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".cm-rich-image img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  const raw = Object.values(await rawNotes(page)).find((note) =>
    note.raw.includes("![이미지]"),
  )!.raw;
  expect(raw).toMatch(/!\[이미지\]\(assets\/[a-f0-9]{64}\.png\)/);
  await saved(page);
  await page.reload();
  await expect(page.locator(".cm-rich-image img")).toBeVisible();
  await source(page);
  await editor(page).press("ControlOrMeta+End");
  await editor(page).evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" }));
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(page.getByRole("alert")).toContainText("SVG");
  expect(
    Object.values(await rawNotes(page)).find((note) =>
      note.raw.includes("![이미지]"),
    )!.raw,
  ).toContain("![이미지](assets/");
});

test("S14 renders math, Mermaid and highlighted code with contextual editing and narrow layout", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin)
      remote.push(request.url());
  });
  await demo(page);
  await create(page, "표현하는 글");
  await source(page);
  const text =
    "앞 $x^2$ 뒤\n\n$$\n\\frac{a}{b}\n$$\n\n```javascript\nconst answer = 42;\n```\n\n```mermaid\ngraph TD; A[생각] --> B[기록]\n```\n\n끝";
  await body(page, text);
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator(".katex")).toHaveCount(2);
  await expect(page.locator(".cm-rich-mermaid svg")).toBeVisible();
  const keywordColor = await page.evaluate(() => {
    const sample = document.createElement("span");
    sample.style.color = "var(--syntax-keyword)";
    document.body.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
  });
  await expect(
    page
      .locator(".cm-line")
      .filter({ hasText: "const answer" })
      .locator("span")
      .filter({ hasText: /^const$/ }),
  ).toHaveCSS("color", keywordColor);
  await page.locator(".cm-rich-math").first().click();
  await expect(editor(page)).toContainText("$x^2$");
  await expect(page.locator(".katex")).toHaveCount(1);
  await editor(page).press("ControlOrMeta+End");
  await expect(page.locator(".katex")).toHaveCount(2);
  await page.screenshot({ path: "docs/screenshots/rich-desktop.png" });
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.locator(".cm-rich-mermaid svg")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/screenshots/rich-narrow.png" });
  await source(page);
  await expect(page.locator(".katex")).toHaveCount(0);
  expect(await editor(page).innerText()).toContain("graph TD");
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});

test("S14 invalid math and unsafe Mermaid stay editable without external requests", async ({
  page,
}) => {
  await demo(page);
  await create(page, "안전한 원문");
  await source(page);
  await body(
    page,
    '$\\unknowncommand{x}$\n\n```mermaid\ngraph TD\nclick A "https://evil.test"\n```\n\n![external](https://evil.test/image.png)\n\n끝',
  );
  const remote: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("evil.test")) remote.push(r.url());
  });
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator(".cm-rich-error")).toHaveCount(2);
  await expect(editor(page)).toContainText("unknowncommand");
  await expect(page.locator(".cm-rich-mermaid svg")).toHaveCount(0);
  await expect(page.locator(".cm-rich-image img")).toHaveCount(0);
  expect(remote).toEqual([]);
});
