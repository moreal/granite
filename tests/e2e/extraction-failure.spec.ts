import { test, expect } from "@playwright/test";
import {
  demo,
  create,
  source,
  body,
  saved,
  editor,
  rawNotes,
} from "../helpers/ui";

for (const phase of ["target", "source"] as const) {
  test(`S05 ${phase} write failure preserves original and reports any created copy`, async ({
    page,
  }) => {
    await demo(page);
    await create(page, "실패 원본");
    await source(page);
    await body(page, "지켜야 하는 선택 문장");
    await saved(page);
    await page.evaluate((which) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "granite.demo.v1") {
          const notes: { raw: string }[] = Object.values(JSON.parse(value));
          if (
            which === "target" ||
            notes.some(
              (n) =>
                n.raw.includes('"실패 원본"') &&
                n.raw.includes("[[분리 사본]]"),
            )
          ) {
            throw new DOMException("검증용 쓰기 실패", "NotAllowedError");
          }
        }
        return original.call(this, key, value);
      };
    }, phase);
    await editor(page).press("ControlOrMeta+a");
    await page.getByRole("button", { name: /새 노트로 옮기기/ }).click();
    await page.getByLabel("새 노트 제목").fill("분리 사본");
    await page.getByRole("button", { name: "옮기기", exact: true }).click();
    if (phase === "target")
      await expect(page.getByRole("dialog")).toContainText("검증용 쓰기 실패");
    else
      await expect(
        page.getByRole("status").filter({ hasText: /사본은 만들어졌지만/ }),
      ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "실패 원본", exact: true }),
    ).toBeVisible();
    await expect(editor(page)).toContainText("지켜야 하는 선택 문장");
    const notes = Object.values(await rawNotes(page));
    expect(notes.find((n) => n.raw.includes('"실패 원본"'))?.raw).toContain(
      "지켜야 하는 선택 문장",
    );
    expect(notes.filter((n) => n.raw.includes('"분리 사본"'))).toHaveLength(
      phase === "source" ? 1 : 0,
    );
  });
}
