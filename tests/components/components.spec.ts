import { test, expect } from "@playwright/test";
const states = [
  "properties-display",
  "properties-type",
  "properties-value",
  "properties-new",
  "properties-yaml",
  "properties-warning",
  "today",
  "today-disabled",
  "type",
  "type-disabled",
  "property",
  "inline-properties",
  "property-value-menu",
  "property-value-no-results",
  "property-value-long-korean",
  "property-disabled",
  "create",
  "create-disabled",
  "row-long",
  "yaml",
  "yaml-disabled",
  "save",
  "recovery",
  "graph-long",
  "graph-disabled",
  "toolbar",
  "toolbar-disabled",
  "template-error",
  "paste",
  "paste-failed",
  "paste-loading",
  "settings",
  "format",
];
for (const state of states)
  test(`S22 ${state} cropped narrow production component`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2026-10-25T23:59:59+09:00"));
    await page.goto(
      `iframe.html?id=production-components--${state}&viewMode=story`,
    );
    const surface = page.getByTestId("component");
    await expect(surface).toBeVisible();
    await expect(page.locator("#storybook-root")).toHaveAttribute(
      "data-story-ready",
      "true",
    );
    if (["type", "property", "create"].includes(state)) {
      const input = page.getByRole("combobox").first();
      await input.focus();
      await input.press("ArrowDown");
      await expect(page.getByRole("listbox")).toBeVisible();
      const label = await page
        .locator(`label[for="${await input.getAttribute("id")}"]`)
        .boundingBox();
      const control = await input.boundingBox();
      expect(label!.y + label!.height).toBeLessThanOrEqual(control!.y);
      await input.press("Enter");
      await expect(input).not.toHaveValue("");
      await input.focus();
      await input.press("ArrowDown");
    }
    if (state === "yaml") {
      const field = page.getByRole("textbox");
      await field.fill("type: Book\nisb");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.getByRole("option").filter({ hasText: /^isbn/ }).click();
      await expect(field).toHaveValue(/isbn:/);
      await field.fill("type: Book\nisbn");
    }
    if (state.startsWith("property-value-")) {
      const input = page.getByRole("combobox", { name: "author 값" });
      await expect(input).toBeFocused();
      if (state === "property-value-no-results") {
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "일치하는 노트가 없습니다" }),
        ).toBeVisible();
        await expect(page.getByRole("option")).toHaveCount(0);
      } else {
        await expect(page.getByRole("listbox")).toBeVisible();
        await input.press("ArrowDown");
        await expect(page.getByRole("option").nth(1)).toHaveAttribute(
          "aria-selected",
          "true",
        );
        if (state === "property-value-menu") {
          const before = await page.evaluate(() => window.scrollY);
          for (let step = 0; step < 12; step++) await input.press("ArrowDown");
          const list = (await page.getByRole("listbox").boundingBox())!;
          const selected = (await page
            .getByRole("option", { selected: true })
            .boundingBox())!;
          expect(selected.y).toBeGreaterThanOrEqual(list.y);
          expect(selected.y + selected.height).toBeLessThanOrEqual(
            list.y + list.height,
          );
          await expect(input).toBeFocused();
          expect(await page.evaluate(() => window.scrollY)).toBe(before);
          for (let step = 0; step < 12; step++) await input.press("ArrowUp");
          const returned = (await page
            .getByRole("option", { selected: true })
            .boundingBox())!;
          expect(returned.y).toBeGreaterThanOrEqual(list.y);
          expect(returned.y + returned.height).toBeLessThanOrEqual(
            list.y + list.height,
          );
          await expect(input).toBeFocused();
          expect(await page.evaluate(() => window.scrollY)).toBe(before);
        }
      }
    }
    if (state === "properties-display") {
      const row = page
        .locator(".property-row")
        .filter({ has: page.locator("dt", { hasText: /^type$/ }) });
      const geometry = await row.evaluate((element) => {
        const textBounds = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect().y;
        };
        return {
          label: textBounds(element.querySelector("dt")!),
          value: textBounds(element.querySelector("button")!),
          height: element.querySelector("button")!.getBoundingClientRect()
            .height,
        };
      });
      expect(Math.abs(geometry.label - geometry.value)).toBeLessThanOrEqual(1);
      expect(geometry.height).toBeGreaterThanOrEqual(40);
    }
    if (state === "properties-type")
      await expect(
        page.getByRole("option").filter({ hasText: "Person" }),
      ).toBeVisible();
    if (state === "properties-yaml") {
      await expect(page.getByRole("option").first()).toContainText(
        "Organization",
      );
      await expect(
        page.getByRole("button", { name: "type 값 편집" }),
      ).toHaveCount(0);
    }
    if (state === "toolbar") {
      await page.getByRole("button", { name: "원문 보기" }).click();
      await expect(
        page.getByRole("button", { name: "라이브 프리뷰" }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    if (state === "today") {
      await page.clock.setFixedTime(new Date("2026-10-26T00:00:01+09:00"));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.getByRole("button").click();
      await expect(page.getByLabel("상호작용 결과")).toHaveText("2026-10-26");
      await expect(page.getByRole("button")).toHaveAccessibleName(
        "오늘의 노트 2026-10-26",
      );
    }
    if (state === "settings") {
      await page.getByRole("button", { name: "글쓰기", exact: true }).click();
      const checkbox = page.getByRole("checkbox");
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    }
    const target =
      state === "settings" || state === "format"
        ? page.getByRole("dialog")
        : surface;
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const editableGeometry = async (desktop: boolean) => {
      const row = page
        .locator(".property-row")
        .filter({ has: page.locator(".property-value-editor") });
      const bounds = await row.evaluate((element) => {
        const text = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          return {
            top: rect.y,
            bottom: rect.bottom,
            center: rect.y + rect.height / 2,
          };
        };
        const input = element.querySelector("input")!.getBoundingClientRect();
        const buttons = [
          ...element.querySelectorAll(".property-value-editor > button"),
        ].map((button) => ({
          top: button.getBoundingClientRect().top,
          height: button.getBoundingClientRect().height,
          text: text(button),
        }));
        const popup = element
          .querySelector(".property-note-options")
          ?.getBoundingClientRect();
        const helper = element
          .querySelector(".property-value-input > .property-help")
          ?.getBoundingClientRect();
        return {
          label: text(element.querySelector("dt")!),
          input: {
            top: input.top,
            bottom: input.bottom,
            height: input.height,
            center: input.y + input.height / 2,
          },
          buttons,
          popup: popup ? { top: popup.top, bottom: popup.bottom } : null,
          helperTop: helper?.top,
        };
      });
      expect(bounds.input.height).toBeGreaterThanOrEqual(40);
      expect(bounds.buttons.every((button) => button.height >= 40)).toBe(true);
      expect(
        Math.abs(bounds.buttons[0].top - bounds.buttons[1].top),
      ).toBeLessThanOrEqual(1);
      if (desktop) {
        expect(
          Math.abs(bounds.label.center - bounds.input.center),
        ).toBeLessThanOrEqual(2);
        expect(
          bounds.buttons.every(
            (button) => Math.abs(button.top - bounds.input.top) <= 1,
          ),
        ).toBe(true);
        expect(
          bounds.buttons.every(
            (button) => Math.abs(button.text.center - bounds.input.center) <= 2,
          ),
        ).toBe(true);
        if (bounds.helperTop !== undefined)
          expect(bounds.helperTop).toBeGreaterThanOrEqual(bounds.input.bottom);
      } else {
        expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.input.top);
        if (bounds.popup)
          expect(bounds.buttons[0].top).toBeGreaterThanOrEqual(
            bounds.popup.bottom,
          );
      }
    };
    if (["properties-type", "properties-value"].includes(state))
      await editableGeometry(false);
    const capture = async (theme: string) => {
      const box = (await target.boundingBox())!;
      const popup = (await page.locator(".schema-options").count())
        ? await page.locator(".schema-options").boundingBox()
        : null;
      const bottom =
        Math.max(box.y + box.height, popup ? popup.y + popup.height : 0) + 5;
      const path = info.outputPath(`${state}-${theme}.png`);
      await page.screenshot({
        path,
        clip: {
          x: 0,
          y: Math.max(0, box.y - 4),
          width: Math.min(480, page.viewportSize()!.width),
          height: bottom - Math.max(0, box.y - 4),
        },
      });
      await info.attach(`${state}-${theme}`, {
        path,
        contentType: "image/png",
      });
    };
    await capture("light");
    if (
      [
        "properties-display",
        "properties-type",
        "properties-value",
        "properties-new",
        "properties-yaml",
        "properties-warning",
        "type",
        "create",
        "recovery",
        "settings",
        "format",
        "row-long",
        "inline-properties",
        "property-value-menu",
        "property-value-no-results",
        "property-value-long-korean",
      ].includes(state)
    ) {
      await page.evaluate(
        () => (document.documentElement.dataset.theme = "dark"),
      );
      await capture("dark");
    }
    if (state.startsWith("properties-")) {
      await page.setViewportSize({ width: 960, height: 900 });
      if (["properties-type", "properties-value"].includes(state))
        await editableGeometry(true);
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
      });
      await capture("desktop-light");
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
      await capture("desktop-dark");
    }
    if (
      ["properties-type", "properties-value", "properties-new"].includes(state)
    ) {
      if (state === "properties-new") {
        const label = await page
          .locator(".property-value-input > label")
          .boundingBox();
        expect(label!.height).toBeGreaterThan(1);
      }
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.getByRole("button", { name: "취소", exact: true }).click();
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "type 값 편집", exact: true }),
      ).toHaveText("Book");
    }
    expect(errors).toEqual([]);
  });
