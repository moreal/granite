import { test, expect } from "@playwright/test";
import {
  demo,
  create,
  source,
  body,
  saved,
  editor,
  paste,
  rawNotes,
  openListed,
} from "../helpers/ui";

test("S01 S02 demo create/edit/search/reload preserves the saved Markdown", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      new URL(request.url()).origin !== "http://127.0.0.1:4173"
    )
      requests.push(request.url());
  });
  await demo(page);
  await expect(page.getByText("데모 · 별도 저장소")).toBeVisible();
  await create(page, "한글 / 질문?: 100% 🪨");
  await source(page);
  await body(page, "고유본문 단풍잎\n\n**남길 생각**");
  await saved(page);
  await page.getByRole("textbox", { name: "노트 검색" }).fill("단풍잎");
  await expect(page.locator(".note-list").getByRole("button")).toHaveCount(1);
  const persisted = Object.values(await rawNotes(page)).find((n) =>
    n.raw.includes("고유본문 단풍잎"),
  );
  expect(persisted?.raw).toContain("한글 / 질문?: 100% 🪨");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "한글 / 질문?: 100% 🪨",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await source(page);
  await expect(editor(page).locator(".cm-line")).toHaveText([
    "고유본문 단풍잎",
    "",
    "**남길 생각**",
  ]);
  expect(requests).toEqual([]);
});

test("S02 missing remembered note falls back to an existing demo note", async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() =>
    localStorage.setItem("granite.active.demo-v1", "missing-note.md"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "생각을 연결하는 작은 습관",
      exact: true,
    }),
  ).toBeVisible();
  await expect(editor(page)).toContainText("메모는 완성된 생각의 기록");
});

test("S02 S05 Korean extraction and further editing reopen the active note after reload", async ({
  page,
}) => {
  await demo(page);
  await create(page, "오늘의 한글 메모");
  await source(page);
  await body(page, "생각은 쓰면서 또렷해진다.");
  await saved(page);
  await editor(page).press("ControlOrMeta+a");
  await page.getByRole("button", { name: /새 노트로 옮기기/ }).click();
  await page.getByLabel("새 노트 제목").fill("내 말로 정리한 생각");
  await page.getByRole("button", { name: "옮기기", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "내 말로 정리한 생각",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await editor(page).press("ControlOrMeta+End");
  await page.keyboard.insertText("\n\n다시 읽고 한 문장을 덧붙인다.");
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "내 말로 정리한 생각",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await source(page);
  await expect(editor(page).locator(".cm-line")).toHaveText([
    "생각은 쓰면서 또렷해진다.",
    "",
    "다시 읽고 한 문장을 덧붙인다.",
  ]);
});

test("S02 duplicate and empty titles preserve the existing note", async ({
  page,
}) => {
  await demo(page);
  const before = await rawNotes(page);
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("제목을 입력");
  await page.getByLabel("새 노트 제목").fill("덤프");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("이미");
  expect(await rawNotes(page)).toEqual(before);
});

test("S05 S09 extract selected text, leave link and return through backlink", async ({
  page,
}) => {
  await demo(page);
  await create(page, "수집함");
  await source(page);
  await body(page, "분리할 생각 한 문장");
  await saved(page);
  await editor(page).press("ControlOrMeta+a");
  await page.getByRole("button", { name: /새 노트로 옮기기/ }).click();
  await page.getByLabel("새 노트 제목").fill("독립된 생각");
  await page.getByRole("button", { name: "옮기기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "독립된 생각", exact: true }),
  ).toBeVisible();
  await expect(editor(page)).toContainText("분리할 생각 한 문장");
  await page.locator(".backlink-card").filter({ hasText: "수집함" }).click();
  await expect(editor(page)).toContainText("[[독립된 생각]]");
  const persisted = Object.values(await rawNotes(page)).map((n) => n.raw);
  expect(persisted.some((n) => n.endsWith("[[독립된 생각]]"))).toBe(true);
  expect(persisted.some((n) => n.endsWith("분리할 생각 한 문장"))).toBe(true);
});

test("S06 wiki keyboard completion, cancellation and missing-note creation", async ({
  page,
}) => {
  await demo(page);
  await create(page, "연결 실험");
  await source(page);
  await editor(page).pressSequentially("[[덤");
  await expect(page.getByRole("option", { name: /덤프/ })).toBeVisible();
  await editor(page).press("ArrowDown");
  await editor(page).press("ArrowUp");
  await editor(page).press("Enter");
  await expect(editor(page)).toContainText("[[덤프]]");
  await body(page, "");
  await editor(page).pressSequentially("[[");
  await expect(page.getByRole("listbox")).toBeVisible();
  await editor(page).press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await body(page, "[[새로운 연결]]\n\n아래 줄");
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await page
    .getByRole("button", { name: "새로운 연결 노트 열기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "아직 없는 노트예요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "새로운 연결", exact: true }),
  ).toBeVisible();
});

test("S07 command dates use the browser local day and email is ordinary text", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-23T03:00:00Z") });
  await demo(page);
  await create(page, "날짜 연결");
  await source(page);
  for (const [command, date] of [
    ["오늘", "2026-10-23"],
    ["어제", "2026-10-22"],
    ["내일", "2026-10-24"],
  ]) {
    await body(page, "");
    await editor(page).pressSequentially("@");
    await page.getByRole("option", { name: new RegExp("^" + command) }).click();
    await expect(editor(page)).toContainText(`[[${date}]]`);
  }
  await body(page, "hello@example.com");
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.getByRole("button", { name: /오늘의 노트/ }).click();
  await expect(
    page.getByRole("heading", { name: "2026-10-23", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "덤프", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "덤프", exact: true }),
  ).toBeVisible();
});

test("S08 URL paste alias, selected alias, Escape and continued typing", async ({
  page,
}) => {
  await demo(page);
  await create(page, "출처 수집");
  await source(page);
  await editor(page).click();
  await paste(page, "https://example.com/a");
  await page.getByRole("button", { name: "별칭 달기", exact: true }).click();
  await page.getByLabel("링크 별칭").fill("읽을 글");
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(editor(page)).toContainText("[읽을 글](https://example.com/a)");
  await body(page, "선택한 이름");
  await editor(page).press("ControlOrMeta+a");
  await paste(page, "https://example.com/b");
  await page.getByRole("button", { name: "별칭 달기", exact: true }).click();
  await expect(editor(page)).toContainText(
    "[선택한 이름](https://example.com/b)",
  );
  await body(page, "");
  await paste(page, "https://example.com/c");
  await editor(page).press("Escape");
  await expect(
    page.getByRole("dialog", { name: "붙여넣은 링크" }),
  ).toBeHidden();
  await expect(editor(page)).toHaveText("https://example.com/c");
  await body(page, "");
  await paste(page, "https://example.com/d");
  await page.keyboard.insertText(" 이어 쓰기");
  await expect(
    page.getByRole("dialog", { name: "붙여넣은 링크" }),
  ).toBeHidden();
  await expect(editor(page)).toContainText("https://example.com/d 이어 쓰기");
});

test("S08 title fetch success/failure and late response cannot replace edited text", async ({
  page,
}) => {
  await demo(page);
  await create(page, "제목 가져오기");
  await source(page);
  await page.route("https://source.test/success", (r) =>
    r.fulfill({ contentType: "text/html", body: "<title>확인한 제목</title>" }),
  );
  await editor(page).click();
  await paste(page, "https://source.test/success");
  await page
    .getByRole("button", { name: "제목 가져오기", exact: true })
    .click();
  await expect(editor(page)).toContainText(
    "[확인한 제목](https://source.test/success)",
  );
  await page.route("https://source.test/failure", (r) =>
    r.abort("accessdenied"),
  );
  await body(page, "");
  await paste(page, "https://source.test/failure");
  await page
    .getByRole("button", { name: "제목 가져오기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "붙여넣은 링크" }),
  ).toContainText("가져오지 못했어요");
  await expect(editor(page)).toHaveText("https://source.test/failure");
  await page.getByRole("button", { name: "URL 그대로", exact: true }).click();
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://source.test/slow", async (r) => {
    await waiting;
    await r.fulfill({
      contentType: "text/html",
      body: "<title>늦은 제목</title>",
    });
  });
  await body(page, "");
  await paste(page, "https://source.test/slow");
  await page
    .getByRole("button", { name: "제목 가져오기", exact: true })
    .click();
  await expect(
    page.getByText("제목을 가져오는 중… 계속 써도 괜찮아요."),
  ).toBeVisible();
  await editor(page).click();
  await page.keyboard.insertText(" 새 문장");
  release();
  await expect(editor(page)).toContainText("https://source.test/slow 새 문장");
  await saved(page);
  expect(
    Object.values(await rawNotes(page)).some((n) =>
      n.raw.includes("늦은 제목"),
    ),
  ).toBe(false);
});

test("S04 S09 source/live preview and code links are literal, HTML remains inert", async ({
  page,
}) => {
  await demo(page);
  await create(page, "표시 실험");
  await source(page);
  const markdown =
    '# 제목\n\n**강조** 와 `[[덤프]]`\n\n```md\n[[덤프]]\n```\n\n<img src=x onerror="window.evil=1">\n\n마지막 줄';
  await body(page, markdown);
  await saved(page);
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await expect(page.locator(".cm-strong")).toContainText("강조");
  await expect(
    page.getByRole("button", { name: "덤프 노트 열기", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => "evil" in window)).toBe(false);
  await source(page);
  await expect(editor(page)).toContainText("<img src=x");
  await openListed(page, "덤프");
  await expect(
    page.locator(".backlink-card").filter({ hasText: "표시 실험" }),
  ).toHaveCount(0);
});

test("S09 S12 discovery, focus, panel toggles, keyboard dialog and narrow screenshots", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("welcome.png"),
    fullPage: true,
  });
  await testInfo.attach("welcome", {
    path: testInfo.outputPath("welcome.png"),
    contentType: "image/png",
  });
  await demo(page);
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  await testInfo.attach("desktop", {
    path: testInfo.outputPath("desktop.png"),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "집중 모드", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "노트 검색" })).toBeHidden();
  await page
    .getByRole("button", { name: "집중 모드 끝내기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "연결 패널 접기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "연결된 생각", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "연결 패널 열기", exact: true })
    .click();
  const prior = await page.getByRole("heading", { level: 1 }).innerText();
  await page.locator(".rediscovery-card").click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(prior);
  const newButton = page.getByRole("button", { name: "새 노트", exact: true });
  await newButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("새 노트 제목")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "만들기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(newButton).toBeFocused();
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(newButton).toBeVisible();
  await expect(editor(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "원문 보기", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("narrow.png"),
    fullPage: true,
  });
  await testInfo.attach("narrow", {
    path: testInfo.outputPath("narrow.png"),
    contentType: "image/png",
  });
});

test("S04 multiline Markdown links remain editable without crashing live preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await demo(page);
  await create(page, "여러 줄 링크");
  await source(page);
  await body(page, "[first\nsecond](https://example.com)\n\nend");
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await editor(page).press("ControlOrMeta+Home");
  await page.keyboard.insertText("편집 ");
  await source(page);
  await expect(editor(page)).toContainText("편집 ");
  await expect(editor(page)).toContainText("https://example.com");
  await saved(page);
  expect(errors).toEqual([]);
});
