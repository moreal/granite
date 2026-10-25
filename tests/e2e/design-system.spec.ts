import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  disableAutomaticFormatting,
  live,
  saved,
  source,
} from "../helpers/ui";
test("S27 tokens reach real app property, toolbar and dialog controls without replacing the editor or draft", async ({
  page,
}, info) => {
  await disableAutomaticFormatting(page);
  await demo(page);
  await expect(
    page.getByRole("button", { name: "집중 모드", exact: true }),
  ).toHaveCSS("width", "40px");
  await expect(
    page.getByRole("button", { name: "집중 모드", exact: true }),
  ).toHaveCSS("padding-inline-start", "8px");
  await create(page, "디자인 체계 확인");
  await source(page);
  await body(
    page,
    "---\ntype: Book\nauthor: '[[작가]]'\n---\n본문을 보관합니다.",
  );
  await saved(page);
  await live(page);
  await page.getByText("속성", { exact: true }).click();
  await page.getByRole("button", { name: "type 값 편집", exact: true }).click();
  const field = page.getByRole("combobox", { name: "type 값", exact: true });
  await field.fill("Per");
  const editor = await page.locator(".cm-content").elementHandle();
  const nativeField = await field.elementHandle();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.setProperty("--control-height", "48px");
      document.documentElement.style.setProperty(
        "--color-focus",
        "rgb(150, 40, 180)",
      );
    }, theme);
    expect((await field.boundingBox())!.height).toBe(48);
    expect(
      (await page
        .getByRole("button", { name: "추가 / 적용", exact: true })
        .boundingBox())!.height,
    ).toBe(48);
    expect(
      (await page
        .getByRole("button", { name: "원문 보기", exact: true })
        .boundingBox())!.height,
    ).toBe(48);
    await expect(field).toHaveValue("Per");
    expect(
      await nativeField!.evaluate(
        (element) =>
          element === document.querySelector(".property-value-input input"),
      ),
    ).toBe(true);
    expect(
      await editor!.evaluate(
        (element) => element === document.querySelector(".cm-content"),
      ),
    ).toBe(true);
    await field.focus();
    await expect(field).toHaveCSS("outline-color", "rgb(150, 40, 180)");
  }
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  expect(
    (await page
      .getByRole("button", { name: "취소", exact: true })
      .boundingBox())!.height,
  ).toBe(48);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.evaluate(() => document.documentElement.removeAttribute("style"));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`design-system-app-${width}-dark.png`),
    });
  }
});
