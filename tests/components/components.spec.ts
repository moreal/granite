import { test, expect } from "@playwright/test";
const states = [
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
          width: 320,
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
    expect(errors).toEqual([]);
  });
