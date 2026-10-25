import { disableAutomaticFormatting } from "../helpers/ui";
import { test, expect } from "@playwright/test";
import {
  demo,
  create,
  source,
  body,
  saved,
  editor,
  openListed,
  rawNotes,
} from "../helpers/ui";

test("S10 failed save survives navigation and browser reload as a recoverable draft", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "granite.demo.v1" &&
        (window as unknown as { failDemo?: boolean }).failDemo
      )
        throw new DOMException("검증용 저장 실패", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await demo(page);
  await create(page, "복구할 노트");
  await openListed(page, "복구할 노트");
  await source(page);
  await page.evaluate(() => {
    (window as unknown as { failDemo?: boolean }).failDemo = true;
  });
  await body(page, "새로고침 뒤에도 남아야 하는 초안");
  await expect(
    page.getByRole("status").filter({ hasText: /^저장 실패$/ }),
  ).toBeVisible();
  expect(
    Object.values(await rawNotes(page)).some((n) =>
      n.raw.includes("새로고침 뒤에도"),
    ),
  ).toBe(false);
  await openListed(page, "덤프");
  await openListed(page, "복구할 노트");
  await expect(editor(page)).toContainText("새로고침 뒤에도 남아야 하는 초안");
  await page.reload();
  await expect(
    page.getByText("이전에 저장하지 못한 초안을 복구했습니다."),
  ).toBeVisible();
  await expect(editor(page)).toContainText("새로고침 뒤에도 남아야 하는 초안");
  await saved(page);
});

test("S10 conflict retains external text and downloadable draft until explicit reload", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await demo(page);
  await create(page, "충돌 복구");
  await openListed(page, "충돌 복구");
  await source(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("granite.demo.v1")!);
    const filename = Object.keys(data).find((f) =>
      data[f].raw.includes('"충돌 복구"'),
    )!;
    data[filename].raw = '<!-- granite-title: "충돌 복구" -->\n외부 변경 본문';
    localStorage.setItem("granite.demo.v1", JSON.stringify(data));
  });
  await body(page, "보호해야 할 편집 초안");
  await expect(
    page.getByRole("status").filter({ hasText: /^외부 변경 충돌$/ }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "초안 다운로드", exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("보호해야 할 편집 초안");
  await page.reload();
  await expect(editor(page)).toContainText("보호해야 할 편집 초안");
  expect(
    Object.values(await rawNotes(page)).some((n) =>
      n.raw.endsWith("외부 변경 본문"),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "디스크 내용 다시 읽기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "디스크 내용을 다시 읽을까요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor(page)).toContainText("보호해야 할 편집 초안");
  await page
    .getByRole("button", { name: "디스크 내용 다시 읽기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "초안 버리고 다시 읽기", exact: true })
    .click();
  await expect(editor(page)).toContainText("외부 변경 본문");
  await saved(page);
});

test("S10 another tab saving the same note does not delete a failed local draft", async ({
  page,
  context,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "granite.demo.v1" &&
        (window as unknown as { failDemo?: boolean }).failDemo
      )
        throw new DOMException("검증용 저장 실패", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await demo(page);
  await create(page, "두 탭에서 연 노트");
  await openListed(page, "두 탭에서 연 노트");
  await source(page);
  const other = await context.newPage();
  other.on("dialog", (dialog) => dialog.accept());
  await other.goto("/");
  await expect(
    other.getByRole("heading", { name: "두 탭에서 연 노트", exact: true }),
  ).toBeVisible();
  await source(other);
  await page.evaluate(() => {
    (window as unknown as { failDemo?: boolean }).failDemo = true;
  });
  await body(page, "A 탭의 잃으면 안 되는 초안");
  await expect(
    page.getByRole("status").filter({ hasText: /^저장 실패$/ }),
  ).toBeVisible();
  await body(other, "B 탭에서 성공한 저장");
  await saved(other);
  await page.evaluate(() => {
    (window as unknown as { failDemo?: boolean }).failDemo = false;
  });
  await page.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^외부 변경 충돌$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(editor(page)).toContainText("A 탭의 잃으면 안 되는 초안");
  expect(
    Object.values(await rawNotes(page)).some((n) =>
      n.raw.endsWith("B 탭에서 성공한 저장"),
    ),
  ).toBe(true);
});

test("S10 switching recovery candidates preserves newly edited unique text", async ({
  page,
  context,
}) => {
  // Isolate original draft identities from optional Markdown normalization.
  await disableAutomaticFormatting(page);
  page.on("dialog", (dialog) => dialog.accept());
  const installFailure = async (target: typeof page) =>
    target.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          key === "granite.demo.v1" &&
          (window as unknown as { failDemo?: boolean }).failDemo
        )
          throw new DOMException("검증용 실패", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
  await installFailure(page);
  await demo(page);
  await create(page, "복구 후보 선택");
  await openListed(page, "복구 후보 선택");
  await source(page);
  const other = await context.newPage();
  other.on("dialog", (dialog) => dialog.accept());
  await disableAutomaticFormatting(other);
  await installFailure(other);
  await other.goto("/");
  await expect(
    other.getByRole("heading", { name: "복구 후보 선택", exact: true }),
  ).toBeVisible();
  await source(other);
  for (const [target, text] of [
    [page, "첫 번째 보관 초안"],
    [other, "두 번째 보관 초안"],
  ] as const) {
    await target.evaluate(() => {
      (window as unknown as { failDemo?: boolean }).failDemo = true;
    });
    await body(target, text);
    await expect(
      target.getByRole("status").filter({ hasText: /^저장 실패$/ }),
    ).toBeVisible();
  }
  await page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem("granite.demo.v1")!);
    const name = Object.keys(notes).find((key) =>
      notes[key].raw.includes('"복구 후보 선택"'),
    )!;
    notes[name].raw =
      '<!-- granite-title: "복구 후보 선택" -->\n외부에서 바뀐 저장';
    (window as unknown as { failDemo?: boolean }).failDemo = false;
    localStorage.setItem("granite.demo.v1", JSON.stringify(notes));
  });
  await page.reload();
  const candidates = page.getByRole("combobox", { name: "복구할 초안" });
  await expect(candidates).toBeVisible();
  const first = await candidates
    .getByRole("option")
    .filter({ hasText: "첫 번째 보관 초안" })
    .getAttribute("value");
  await candidates.selectOption(first!);
  await expect(editor(page)).toContainText("첫 번째 보관 초안");
  await source(page);
  await body(page, "선택 전 작성한 유일한 새 문장");
  const second = await candidates
    .getByRole("option")
    .filter({ hasText: "두 번째 보관 초안" })
    .getAttribute("value");
  await candidates.selectOption(second!);
  await expect(editor(page)).toContainText("두 번째 보관 초안");
  const edited = candidates
    .getByRole("option")
    .filter({ hasText: "선택 전 작성한 유일한 새 문장" });
  await expect(edited).toHaveCount(1);
  await candidates.selectOption((await edited.getAttribute("value"))!);
  await expect(editor(page)).toContainText("선택 전 작성한 유일한 새 문장");
});

test("S10 saving an edited recovered draft does not resurrect its stale ancestor", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "granite.demo.v1" &&
        (window as unknown as { failDemo?: boolean }).failDemo
      )
        throw new DOMException("검증용 실패", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await demo(page);
  await create(page, "복구 초안의 생애");
  await openListed(page, "복구 초안의 생애");
  await source(page);
  await page.evaluate(() => {
    (window as unknown as { failDemo?: boolean }).failDemo = true;
  });
  await body(page, "복구할 예전 초안 A");
  await expect(
    page.getByRole("status").filter({ hasText: /^저장 실패$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(editor(page)).toContainText("복구할 예전 초안 A");
  await saved(page);
  await source(page);
  await body(page, "복구 뒤 다듬어 저장한 A2");
  await saved(page);
  await page.reload();
  await expect(editor(page)).toContainText("복구 뒤 다듬어 저장한 A2");
  await saved(page);
  await expect(
    page.getByText("이전에 저장하지 못한 초안을 복구했습니다."),
  ).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: /^외부 변경 충돌$/ }),
  ).toBeHidden();
});
