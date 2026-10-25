import { test, expect, type Page } from "@playwright/test";

async function story(page: Page, name: string) {
  await page.goto(
    `iframe.html?id=production-components--${name}&viewMode=story`,
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
}
for (const name of ["property", "type"])
  test(`S25 ${name} keyboard candidates scroll only their popup`, async ({
    page,
  }) => {
    await story(page, name);
    const input = page.getByRole("combobox").first();
    await input.fill("");
    await input.focus();
    const pageScroll = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 17; i++) await input.press("ArrowDown");
    const visible = async () =>
      page.getByRole("option", { selected: true }).evaluate((row) => {
        const list = row.parentElement!,
          viewport = list.getBoundingClientRect(),
          bounds = row.getBoundingClientRect();
        return (
          bounds.top >= viewport.top + list.clientTop - 1 &&
          bounds.bottom <= viewport.top + list.clientTop + list.clientHeight + 1
        );
      });
    expect(await visible()).toBe(true);
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await input.press("ArrowDown");
    expect(await visible()).toBe(true);
    await input.evaluate((element: HTMLInputElement) => element.blur());
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await input.focus();
    expect(await visible()).toBe(true);
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    for (let i = 0; i < 17; i++) await input.press("ArrowUp");
    expect(await visible()).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

test("S25 quiet YAML validates on leave/save, keeps collapsed discovery and exact native input", async ({
  page,
}, info) => {
  await story(page, "properties-yaml-quiet");
  const yaml = page.getByLabel("속성 YAML 원문");
  await expect(yaml).toBeFocused();
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await expect(page.getByText("확인 필요", { exact: true })).toHaveCount(0);
  const original = await yaml.elementHandle();
  const top = (await yaml.boundingBox())!.y;
  await page.waitForTimeout(1700);
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await yaml.dispatchEvent("compositionstart");
  await page.keyboard.insertText("한");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await yaml.dispatchEvent("compositionend");
  await yaml.press("ControlOrMeta+s");
  await expect(page.locator(".property-warning")).toBeVisible();
  await expect(yaml).toHaveAttribute("aria-invalid", "true");
  expect((await yaml.boundingBox())!.y).toBe(top);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await yaml.press("End");
  await page.keyboard.type("b");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await page.locator("summary").click();
  await expect(page.getByText("확인 필요", { exact: true })).toBeVisible();
  await page.locator("summary").click();
  await expect(page.locator(".property-warning")).toBeVisible();
  await yaml.focus();
  await yaml.press("ControlOrMeta+a");
  await page.keyboard.insertText("type: Book");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  expect(await yaml.evaluate((el, first) => el === first, original)).toBe(true);
  await yaml.fill('type: Book\nauthor: "@missing"');
  await yaml.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(el.value.length - 1, el.value.length - 1),
  );
  await yaml.press("Control+Space");
  await expect(page.locator(".property-help[role=status]")).toContainText(
    "일치하는 기존 노트가 없습니다",
  );
  await expect(page.getByRole("option")).toHaveCount(0);
  await yaml.press("Escape");
  await expect(page.locator(".property-help[role=status]")).toHaveCount(0);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    await yaml.fill("type: [");
    await yaml.press("Tab");
    await page
      .getByTestId("component")
      .screenshot({ path: info.outputPath(`yaml-validated-${theme}.png`) });
  }
});

for (const width of [320, 390])
  for (const action of ["취소", "추가 / 적용"])
    test(`S25/S26 open type popup ${action} finishes at ${width}px before resizing`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await story(page, "properties-type");
      const type = page.getByRole("combobox", { name: "type 값", exact: true });
      await expect(type).toHaveValue("Per");
      await expect(
        page.getByRole("listbox", { name: "Schema.org 유형" }),
      ).toBeVisible();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(type).toHaveCount(0);
      const edit = page.getByRole("button", {
        name: "type 값 편집",
        exact: true,
      });
      await expect(edit).toHaveText(action === "취소" ? "Book" : "Per");
      await expect(edit).toBeFocused();
      await page
        .getByRole("button", { name: "작가 노트 열기", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "작가", exact: true }),
      ).toBeVisible();
    });

test("S25 form retains rejected draft across mouse/key requests and restores apply/cancel focus", async ({
  page,
}) => {
  await story(page, "properties-draft-preserved");
  const count = page.getByLabel("count 값", { exact: true });
  await expect(count).toHaveValue("not a number");
  await expect(page.getByRole("alert")).toContainText("숫자");
  await expect(page.locator(".property-help[role=status]")).toContainText(
    "적용하거나 취소",
  );
  const picker = page.getByRole("combobox", { name: "속성 이름 검색" });
  await picker.fill("about");
  await picker.press("Enter");
  await expect(count).toHaveValue("not a number");
  await expect(count).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("숫자");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "count 값 편집" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "author 값 편집" }).click();
  const author = page.getByLabel("author 값", { exact: true });
  await author.fill("new author");
  await author.press("Enter");
  await expect(
    page.getByRole("button", { name: "author 값 편집" }),
  ).toBeFocused();
  await picker.fill("custom");
  await picker.press("Enter");
  await page.getByLabel("custom 값", { exact: true }).fill("value");
  await page.getByLabel("custom 값", { exact: true }).press("Enter");
  await expect(picker).toBeFocused();
});

for (const name of [
  "properties-yaml-quiet",
  "properties-yaml-validated",
  "properties-yaml-no-results",
  "properties-draft-preserved",
  "properties-invalid-form",
])
  test(`S25 ${name} ready actual production state`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await story(page, name);
    for (const width of [320, 960]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (value) => (document.documentElement.dataset.theme = value),
          theme,
        );
        await page.getByTestId("component").screenshot({
          path: info.outputPath(`${name}-${width}-${theme}.png`),
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
