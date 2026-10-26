import { test, expect } from "@playwright/test";

test("S29a actual graph preview story finishes cleanly and first click opens the note", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(
    "iframe.html?id=production-components--graph-preview&viewMode=story",
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  const node = page.getByRole("button", {
    name: "작가 노트 열기",
    exact: true,
  });
  await expect(node).toBeFocused();
  await expect(page.getByRole("tooltip")).toContainText("일상에서 읽고");
  await page.keyboard.press("Escape");
  await expect(node).toBeFocused();
  await node.evaluate((element: HTMLButtonElement) => element.blur());
  await node.hover();
  await expect(page.getByRole("tooltip")).toContainText("일상에서 읽고");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const card = (await page.getByRole("tooltip").boundingBox())!;
    await page.screenshot({
      path: info.outputPath(`graph-preview-320-${theme}.png`),
      clip: {
        x: 0,
        y: 0,
        width: 320,
        height: Math.ceil(card.y + card.height + 8),
      },
    });
  }
  await node.click();
  await expect(
    page.getByRole("article", { name: "연결된 노트" }),
  ).toContainText("일상에서 읽고");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByLabel("상호작용 결과")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("S29a long graph target previews as missing without creating a note", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(
    "iframe.html?id=production-components--graph-long&viewMode=story",
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  await page.locator(".graph-node").focus();
  await expect(page.getByRole("tooltip")).toContainText("아직 없는 노트");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("S29b compact Type example starts quietly and still protects its draft on a later navigation request", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(
    "iframe.html?id=production-components--properties-type&viewMode=story",
  );
  await expect(page.locator("#storybook-root")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
  const input = page.getByRole("combobox", { name: "type 값", exact: true });
  await expect(input).toHaveValue("Per");
  await expect(
    page.getByText("입력 중인 값을 적용하거나 취소해 주세요.", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "작가 노트 열기", exact: true })
    .click();
  await expect(input).toHaveValue("Per");
  await expect(input).toBeFocused();
  await expect(
    page.getByText("입력 중인 값을 적용하거나 취소해 주세요.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(errors).toEqual([]);
});
