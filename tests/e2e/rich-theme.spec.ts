import { expect, test } from "@playwright/test";
import { body, create, demo, source } from "../helpers/ui";

test("S14 real Mermaid SVG follows resolved theme with readable labels", async ({
  page,
}) => {
  await demo(page);
  await create(page, "테마별 다이어그램");
  await source(page);
  await body(
    page,
    "앞\n\n```mermaid\ngraph TD; A[생각] --> B[기록]\n```\n\n끝",
  );
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  const diagram = page.locator(".cm-rich-mermaid svg");
  await expect(diagram).toBeVisible();
  let previous = "";
  for (const theme of ["light", "dark", "light"]) {
    previous = (await diagram.getAttribute("id"))!;
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      window.dispatchEvent(new CustomEvent("granite-theme-change"));
    }, theme);
    await expect(diagram).not.toHaveAttribute("id", previous);
    const contrast = await diagram.evaluate((svg) => {
      const label = svg.querySelector(".node text")!;
      const shape = svg.querySelector(".node rect")!;
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const text = luminance(getComputedStyle(label).fill);
      const background = luminance(getComputedStyle(shape).fill);
      return (
        (Math.max(text, background) + 0.05) /
        (Math.min(text, background) + 0.05)
      );
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});
