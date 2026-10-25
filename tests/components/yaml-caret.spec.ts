import { test, expect } from "@playwright/test";

test("S24d YAML first-line typing retains its caret after Storybook play", async ({
  page,
}, info) => {
  await page.goto(
    "iframe.html?id=production-components--properties-yaml&viewMode=story",
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  const yaml = page.getByLabel("속성 YAML 원문");
  await yaml.press("ControlOrMeta+a");
  await page.keyboard.insertText("author: old");
  await expect(page.locator(".property-warning")).toHaveCount(0);
  const original = await yaml.elementHandle();
  const top = (await yaml.boundingBox())!.y;
  await yaml.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(0, 0),
  );
  await page.keyboard.press("Enter");
  await expect(yaml).toHaveValue("\nauthor: old");
  await page.keyboard.press("ArrowLeft");
  let prefix = "";
  for (const character of "type: Book") {
    await page.keyboard.type(character);
    prefix += character;
    await expect(yaml).toHaveValue(`${prefix}\nauthor: old`);
    expect((await yaml.boundingBox())!.y).toBe(top);
    await expect(page.locator(".property-warning")).toHaveCount(0);
    expect(
      await yaml.evaluate(
        (element: HTMLTextAreaElement, initial) => ({
          same: element === initial,
          focused: document.activeElement === element,
          start: element.selectionStart,
          end: element.selectionEnd,
        }),
        original,
      ),
    ).toEqual({
      same: true,
      focused: true,
      start: prefix.length,
      end: prefix.length,
    });
  }
  await expect(page.locator(".property-warning")).toHaveCount(0);
  await yaml.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(6, 10),
  );
  await page.keyboard.insertText("Person");
  await expect(yaml).toHaveValue("type: Person\nauthor: old");
  await yaml.press("ControlOrMeta+z");
  await expect(yaml).toHaveValue("type: Book\nauthor: old");
  await yaml.press("ControlOrMeta+Shift+Z");
  await expect(yaml).toHaveValue("type: Person\nauthor: old");
  await page.setViewportSize({ width: 320, height: 900 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page
      .getByTestId("component")
      .screenshot({ path: info.outputPath(`yaml-caret-${theme}.png`) });
    const narrowTop = (await yaml.boundingBox())!.y;
    await yaml.evaluate((element: HTMLTextAreaElement) =>
      element.setSelectionRange(6, 12),
    );
    await page.keyboard.insertText("[");
    await expect(page.locator(".property-warning")).toHaveCount(0);
    await yaml.press("ControlOrMeta+s");
    await expect(page.locator(".property-warning")).toBeVisible();
    expect((await yaml.boundingBox())!.y).toBe(narrowTop);
    await page
      .getByTestId("component")
      .screenshot({ path: info.outputPath(`yaml-warning-${theme}.png`) });
    await yaml.press("ControlOrMeta+z");
    await expect(yaml).toHaveValue("type: Person\nauthor: old");
  }
});
