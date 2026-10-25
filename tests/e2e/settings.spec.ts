import { test, expect } from "@playwright/test";

test("S19 theme persists, follows system, and template edits apply or cancel", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("radio", { name: "밝게", exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await page.getByRole("button", { name: "양식 추가", exact: true }).click();
  await page.getByLabel("이름", { exact: true }).fill("출처 링크");
  await page.getByLabel("Markdown 양식", { exact: true }).fill("{{unknown}}");
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("확인");
  await page
    .getByLabel("Markdown 양식", { exact: true })
    .fill("> [{{title}}]({{url}})");
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "출처 링크",
  );
  await page.getByRole("button", { name: "양식 1 삭제", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "설정", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("radio", { name: "시스템", exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("S19 settings visual checks in both themes and a narrow viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("radio", { name: "어둡게", exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.screenshot({ path: "/tmp/granite-settings-dark-desktop.png" });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page
    .getByRole("button", { name: "링크 붙여넣기", exact: true })
    .click();
  await page.getByRole("button", { name: "양식 추가", exact: true }).click();
  await page.screenshot({ path: "/tmp/granite-settings-dark-dialog.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/granite-settings-dark-narrow.png" });
  await expect(
    page.getByRole("button", { name: "적용", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "화면", exact: true }).click();
  await page.getByRole("radio", { name: "밝게", exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.screenshot({ path: "/tmp/granite-settings-light-narrow.png" });
});

test("S19 an open settings draft cannot overwrite changes from another tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("radio", { name: "어둡게", exact: true }).check();
  await page.evaluate(() => {
    localStorage.setItem(
      "granite.settings.v1",
      JSON.stringify({
        version: 1,
        theme: "light",
        linkTemplates: [
          { id: "external", name: "다른 탭 양식", template: "{{url}}" },
        ],
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "granite.settings.v1" }),
    );
  });
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 탭");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("granite.settings.v1")!)
          .linkTemplates[0].id,
    ),
  ).toBe("external");
});

test("S19 theme is available before the application module loads", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "granite.settings.v1",
      JSON.stringify({ version: 1, theme: "dark", linkTemplates: [] }),
    ),
  );
  await page.route("**/src/main.tsx*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(25, 26, 28)",
  );
  await expect(page.locator("#root")).toBeEmpty();
});
