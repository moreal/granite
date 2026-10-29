import { test, expect } from "@playwright/test";
for (const width of [390, 900, 1440])
  test(`S30 production writing surface ${width}px uses live editor and outline`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      "iframe.html?id=production-writing-surface--cms-writing&viewMode=story",
    );
    await expect(page.locator("#storybook-root")).toHaveAttribute(
      "data-story-ready",
      "true",
    );
    const editor = page.getByRole("textbox", { name: "노트 본문" });
    await expect(editor).toHaveCSS("font-size", "19.2px");
    const outline = page.getByRole("navigation", { name: "목차" });
    if (width > 640) {
      if (width === 900) {
        const bar = await outline.locator(".outline-bar").first().boundingBox();
        const content = await editor.locator(".cm-line").first().boundingBox();
        expect(bar!.width).toBe(14);
        expect(bar!.height).toBe(2);
        expect(bar!.x + bar!.width).toBeLessThan(content!.x);
      }
      await outline.hover();
      const firstButton = outline.getByRole("button").first();
      const label = await firstButton.locator(".outline-text").boundingBox();
      const button = await firstButton.boundingBox();
      // Medium labels follow the 14px bar and 10px gap; wide current labels have a 2px location border and no bar.
      expect(label!.x - button!.x).toBeCloseTo(width === 900 ? 29 : 14, 1);
      await outline
        .getByRole("button", { name: "연결하는 문장", exact: true })
        .click();
      await expect(editor).toBeFocused();
      await expect(
        outline.getByRole("button", { name: "연결하는 문장", exact: true }),
      ).toHaveAttribute("aria-current", "location");
    } else await expect(outline).toBeHidden();
    await page.getByRole("button", { name: "원문 보기", exact: true }).click();
    await expect(editor).toHaveCSS("font-family", /monospace/);
    await page
      .getByRole("button", { name: "라이브 프리뷰", exact: true })
      .click();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`writing-surface-${width}.png`),
    });
  });
