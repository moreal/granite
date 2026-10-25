import { test, expect } from "@playwright/test";
test("S20 production subpath serves the local formatter worker and WASM", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/granite/");
  await page.getByRole("button", { name: "데모 둘러보기" }).click();
  await page.getByRole("button", { name: "원문 보기", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "노트 본문" });
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    "# 제목\n\n> 인용문\n> 다음 줄\n\n[site](https://example.com)",
  );
  await editor.press("ControlOrMeta+s");
  await expect(editor).toContainText("[site]: https://example.com");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    requests.some((url) =>
      /\/granite\/assets\/hongdown.worker-.*\.js/.test(url),
    ),
  ).toBe(true);
  expect(
    requests.some((url) => /\/granite\/assets\/hongdown_bg-.*\.wasm/.test(url)),
  ).toBe(true);
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:4175/granite/")),
  ).toBe(true);
  expect(errors).toEqual([]);
});
