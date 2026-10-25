import { test, expect, type Page } from "@playwright/test";
async function story(page: Page, id: string) {
  await page.goto(`iframe.html?id=${id}&viewMode=story`);
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
}
for (const theme of ["light", "dark"]) {
  test(`S27 ${theme} shared tokens reach real property and settings controls while inline and row variants stay independent`, async ({
    page,
  }) => {
    await story(page, "production-components--properties-type");
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.setProperty("--control-height", "52px");
      document.documentElement.style.setProperty(
        "--color-focus",
        "rgb(150, 40, 180)",
      );
    }, theme);
    const input = page.getByRole("combobox", { name: "type 값", exact: true });
    const apply = page.getByRole("button", {
      name: "추가 / 적용",
      exact: true,
    });
    expect((await input.boundingBox())!.height).toBe(52);
    expect((await apply.boundingBox())!.height).toBe(52);
    await input.focus();
    await expect(input).toHaveCSS("outline-color", "rgb(150, 40, 180)");
    const link = page.getByRole("button", {
      name: "작가 노트 열기",
      exact: true,
    });
    await expect(link).toHaveCSS("display", "inline-block");
    await expect(link).toHaveCSS("min-height", "0px");
    await expect(link.locator("..")).toHaveCSS("line-height", "24px");
    // An unclassified native button must not acquire action geometry from a global selector.
    const bare = page.locator("#bare-native");
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "bare-native";
      button.textContent = "Native";
      document.body.append(button);
    });
    await expect(bare).not.toHaveCSS("display", "inline-flex");
    await expect(bare).toHaveCSS("min-height", "0px");
    await story(page, "production-components--settings");
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.setProperty("--control-height", "52px");
      document.documentElement.style.setProperty("--radius-control", "10px");
    }, theme);
    const cancel = page.getByRole("button", { name: "취소", exact: true });
    expect((await cancel.boundingBox())!.height).toBe(52);
    await expect(cancel).toHaveCSS("border-radius", "10px");
    await story(page, "design-system-primitives--native-controls");
    await expect(
      page.getByRole("button", { name: "짧은 노트", exact: true }),
    ).toHaveCSS("min-height", "32px");
  });
}
test("S27 native actions forward reactive disabled, submit, ref, ARIA and focus; theme preview never saves settings", async ({
  page,
}, info) => {
  await story(page, "design-system-primitives--native-controls");
  const button = page.getByRole("button", { name: "기본 버튼", exact: true });
  await button.click();
  await expect(page.getByRole("status", { name: "클릭 횟수" })).toHaveText("1");
  await expect(page.getByRole("status", { name: "제출 횟수" })).toHaveText("0");
  await page.getByRole("button", { name: "명시적 제출" }).click();
  await expect(page.getByRole("status", { name: "제출 횟수" })).toHaveText("1");
  await page.getByRole("button", { name: "비활성화 전환" }).click();
  await expect(button).toBeDisabled();
  await button.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole("status", { name: "클릭 횟수" })).toHaveText("1");
  await page.getByRole("button", { name: "비활성화 전환" }).click();
  await page.getByRole("button", { name: "ref로 초점" }).click();
  await expect(button).toBeFocused();
  await expect(page.getByRole("status", { name: "ref 대상" })).toHaveText(
    "BUTTON",
  );
  await page.getByRole("button", { name: "선택 상태" }).click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveCSS("outline-style", "solid");
  const before = await page.evaluate(() =>
    localStorage.getItem("granite.settings.v1"),
  );
  await page.goto(
    "iframe.html?id=design-system-primitives--native-controls&viewMode=story&globals=theme:dark",
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => localStorage.getItem("granite.settings.v1")),
  ).toBe(before);
  await page
    .getByTestId("design-system")
    .screenshot({ path: info.outputPath("primitives-dark-320.png") });
});
test("S27 primary state contrast, semantic feedback and narrow showcase remain legible in both themes", async ({
  page,
}, info) => {
  await story(page, "design-system-primitives--native-controls");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const primary = page.getByRole("button", {
      name: "주요 작업",
      exact: true,
    });
    const contrast = async () =>
      primary.evaluate((element) => {
        const style = getComputedStyle(element);
        const luminance = (value: string) => {
          const channels = value
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((channel) => {
              const c = channel / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const a = luminance(style.color),
          b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await primary.hover();
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    const feedbackRatios = await page.evaluate(() => {
      const luminance = (value: string) => {
        const c = value
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      const canvas = luminance(
        getComputedStyle(document.documentElement).backgroundColor,
      );
      return Array.from(
        document.querySelectorAll(
          ".ui-feedback--muted, .ui-feedback--warning, .ui-feedback--error, .ui-button--primary:disabled",
        ),
        (node) => {
          const style = getComputedStyle(node),
            foreground = luminance(style.color);
          const background =
            style.backgroundColor === "rgba(0, 0, 0, 0)"
              ? canvas
              : luminance(style.backgroundColor);
          return (
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05)
          );
        },
      );
    });
    expect(feedbackRatios.length).toBeGreaterThanOrEqual(4);
    for (const ratio of feedbackRatios)
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByTestId("design-system")
      .screenshot({ path: info.outputPath(`primitives-${theme}-320.png`) });
  }
});

test("S27 manager theme toolbar updates a ready story and survives production/design-system navigation without saving app settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("?path=/story/production-components--properties-display");
  const canvas = page.frameLocator("#storybook-preview-iframe");
  await expect(canvas.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  const before = await canvas
    .locator("html")
    .evaluate(() => localStorage.getItem("granite.settings.v1"));
  const theme = page.getByRole("button", { name: "theme 밝게", exact: true });
  await theme.click();
  await page
    .getByRole("listbox", { name: "theme" })
    .getByRole("option")
    .filter({ hasText: "어둡게" })
    .click();
  await expect(canvas.locator("html")).toHaveAttribute("data-theme", "dark");
  const designSystem = page
    .locator("button")
    .filter({ hasText: /^Design System$/ });
  if ((await designSystem.getAttribute("aria-expanded")) !== "true")
    await designSystem.click();
  const expandAll = page.getByRole("button", {
    name: "Expand all",
    exact: true,
  });
  if (await expandAll.isVisible()) await expandAll.click();
  await page
    .locator('a[href*="path=/story/design-system-primitives--native-controls"]')
    .click();
  await expect(canvas.getByTestId("design-system")).toBeVisible();
  await expect(canvas.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "theme 어둡게", exact: true }).click();
  await page
    .getByRole("listbox", { name: "theme" })
    .getByRole("option")
    .filter({ hasText: "밝게" })
    .click();
  await expect(canvas.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .locator('a[href*="path=/story/production-components--properties-display"]')
    .click();
  await expect(canvas.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  await expect(canvas.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await canvas
      .locator("html")
      .evaluate(() => localStorage.getItem("granite.settings.v1")),
  ).toBe(before);
});

for (const group of [
  "buttons",
  "fields",
  "navigation",
  "suggestions",
  "feedback",
]) {
  test(`S27 focused ${group} example uses real controls at narrow width`, async ({
    page,
  }, info) => {
    await story(page, `design-system-primitives--${group}`);
    if (group === "buttons") {
      const selected = page.getByRole("button", { name: "선택 상태" });
      await selected.click();
      await expect(selected).toHaveAttribute("aria-pressed", "true");
    } else if (group === "fields") {
      await page
        .getByLabel("속성 편집 방식", { exact: true })
        .selectOption({ label: "YAML 편집기" });
      await page.getByLabel("원문", { exact: true }).fill("type: Book");
      await expect(page.getByLabel("원문", { exact: true })).toHaveValue(
        "type: Book",
      );
    } else if (group === "navigation") {
      await page
        .getByRole("button", { name: "작가 노트 열기", exact: true })
        .click();
      await expect(
        page.getByRole("status", { name: "상호작용 결과" }),
      ).toHaveText("작가");
    } else if (group === "suggestions") {
      const field = page.getByRole("combobox", { name: "유형 검색" });
      await field.focus();
      await field.press("ArrowDown");
      await field.press("Enter");
      await expect(field).toHaveValue("Organization");
      await field.fill("없음");
      await expect(page.getByRole("listbox")).toContainText(
        "일치하는 추천이 없습니다",
      );
    } else {
      await page.getByRole("button", { name: "추가", exact: true }).click();
      await expect(
        page.getByRole("status", { name: "상호작용 결과" }),
      ).toContainText("다시 시도했습니다");
    }
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      await page
        .getByTestId("design-system")
        .screenshot({ path: info.outputPath(`${group}-${theme}-320.png`) });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("S27 code typography token reaches real template preview, formatting textareas and YAML without changing their metrics", async ({
  page,
}) => {
  for (const [id, selector, size, lineHeight] of [
    ["template-error", ".template-preview", "12px", "20.4px"],
    ["format", ".format-comparison textarea", "12px", "19.2px"],
    ["properties-yaml", ".yaml-editor textarea", "13px", "normal"],
  ] as const) {
    await story(page, `production-components--${id}`);
    const control = page.locator(selector).first();
    const original = await control.elementHandle();
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--font-code",
        '"Courier New", monospace',
      ),
    );
    await expect(control).toHaveCSS("font-family", '"Courier New", monospace');
    await expect(control).toHaveCSS("font-size", size);
    if (lineHeight !== "normal")
      await expect(control).toHaveCSS("line-height", lineHeight);
    expect(await original!.evaluate((element) => element.isConnected)).toBe(
      true,
    );
  }
});
