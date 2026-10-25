import { expect, type Page } from "@playwright/test";

export const editor = (page: Page) =>
  page.getByRole("textbox", { name: "노트 본문" });
export async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await expect(
    page.getByRole("heading", {
      name: "생각을 연결하는 작은 습관",
      exact: true,
    }),
  ).toBeVisible();
}
export async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page.getByLabel("새 노트 제목").fill(title);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
export async function source(page: Page) {
  const toggle = page.getByRole("button", { name: "원문 보기", exact: true });
  if (await toggle.count()) await toggle.click();
}
export async function body(page: Page, text: string) {
  await editor(page).click();
  await editor(page).press("ControlOrMeta+a");
  if (text) await page.keyboard.insertText(text);
  else await page.keyboard.press("Backspace");
}
export async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: /^저장 완료$/ }),
  ).toBeVisible();
}
export async function paste(page: Page, text: string) {
  await editor(page).evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, text);
}
export async function rawNotes(
  page: Page,
): Promise<Record<string, { raw: string; updated: number }>> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("granite.demo.v1") || "{}"),
  );
}
export async function openListed(page: Page, title: string) {
  await page.getByRole("textbox", { name: "노트 검색" }).fill(title);
  await page
    .locator(".note-list")
    .getByRole("button")
    .filter({
      has: page.locator(".note-title").getByText(title, { exact: true }),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "노트 검색" }).fill("");
}

/** Isolate raw Markdown/manual formatting fixtures from automatic rewriting. */
export async function disableAutomaticFormatting(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "granite.settings.v1",
      JSON.stringify({
        version: 1,
        theme: "system",
        linkTemplates: [],
        ...JSON.parse(localStorage.getItem("granite.settings.v1") || "{}"),
        autoFormat: false,
      }),
    );
  });
}

/** Shifted printable keys must carry their uppercase event.key on Linux too. */
export async function redo(
  page: Page,
  modifier: "ControlOrMeta" | "Control" = "ControlOrMeta",
) {
  await editor(page).press(`${modifier}+Shift+Z`);
}

/** Return to the property interface after preparing a full Markdown fixture. */
export async function live(page: Page) {
  const toggle = page.getByRole("button", {
    name: "라이브 프리뷰",
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
}
/** Existing regression fixtures select the persisted experimental editor directly. */
export async function propertyMode(page: Page, mode: "form" | "yaml") {
  await page.evaluate((propertyEditor) => {
    const current = JSON.parse(
      localStorage.getItem("granite.settings.v1") ||
        '{"version":1,"theme":"system","linkTemplates":[]}',
    );
    localStorage.setItem(
      "granite.settings.v1",
      JSON.stringify({ ...current, propertyEditor }),
    );
    window.dispatchEvent(new Event("granite-settings-change"));
  }, mode);
}
