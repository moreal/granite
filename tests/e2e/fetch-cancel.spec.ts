import { test, expect } from "@playwright/test";
import { demo, create, source, editor, paste } from "../helpers/ui";

for (const cancel of ["Escape", "닫기"] as const) {
  test(`S08 ${cancel} cancels pending title result without changing the original URL`, async ({
    page,
  }) => {
    await demo(page);
    await create(page, "취소한 제목 요청");
    await source(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("https://source.test/cancel", async (route) => {
      await gate;
      await route.fulfill({
        contentType: "text/html",
        body: "<title>취소 뒤 온 제목</title>",
      });
    });
    await editor(page).click();
    await paste(page, "https://source.test/cancel");
    await page
      .getByRole("button", { name: "제목 가져오기", exact: true })
      .click();
    await expect(
      page.getByText("제목을 가져오는 중… 계속 써도 괜찮아요."),
    ).toBeVisible();
    if (cancel === "Escape") await editor(page).press("Escape");
    else
      await page
        .getByRole("button", { name: "닫기 · Esc", exact: true })
        .click();
    await expect(
      page.getByRole("dialog", { name: "붙여넣은 링크" }),
    ).toBeHidden();
    const response = page.waitForResponse("https://source.test/cancel");
    release();
    await (await response).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(editor(page)).toHaveText("https://source.test/cancel");
  });
}
