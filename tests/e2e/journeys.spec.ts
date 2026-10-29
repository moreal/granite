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

test("S05 retired: selection preserves text and S09 backlinks remain available", async ({
  page,
}) => {
  await demo(page);
  await create(page, "수집함");
  await source(page);
  await body(page, "남겨 둘 문장 [[독립된 생각]]");
  await saved(page);
  const before = await rawNotes(page);
  await editor(page).press("ControlOrMeta+a");
  await expect(
    page.getByRole("button", { name: /새 노트로 옮기기/ }),
  ).toHaveCount(0);
  expect(await rawNotes(page)).toEqual(before);
  await create(page, "독립된 생각");
  await page.locator(".backlink-card").filter({ hasText: "수집함" }).click();
  await expect(editor(page)).toContainText("남겨 둘 문장 [[독립된 생각]]");
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
    .locator(".cm-note-link")
    .filter({ hasText: "새로운 연결" })
    .click({ modifiers: ["ControlOrMeta"] });
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
  await page
    .getByRole("navigation", { name: "빠른 노트" })
    .getByRole("button", { name: "덤프", exact: true })
    .click();
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
  await page.keyboard.insertText("읽을 글");
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
  await expect(page.getByRole("group", { name: "붙여넣은 링크" })).toBeHidden();
  await expect(editor(page)).toHaveText("https://example.com/c");
  await body(page, "");
  await paste(page, "https://example.com/d");
  await page.keyboard.insertText(" 이어 쓰기");
  await expect(page.getByRole("group", { name: "붙여넣은 링크" })).toBeHidden();
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
    .getByRole("group", { name: "붙여넣은 링크" })
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
    .getByRole("group", { name: "붙여넣은 링크" })
    .getByRole("button", { name: "제목 가져오기", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "붙여넣은 링크" }),
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
    .getByRole("group", { name: "붙여넣은 링크" })
    .getByRole("button", { name: "제목 가져오기", exact: true })
    .click();
  await expect(
    page.getByText("제목을 가져오는 중… 계속 써도 괜찮아요."),
  ).toBeVisible();
  // Click the visible source line; the textbox center can be under the paste menu.
  await editor(page).locator(".cm-line").first().click();
  await editor(page).press("ControlOrMeta+End");
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
  await expect(editor(page).locator(".cm-note-link")).toHaveCount(0);
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

test("S04 S06 writing-focus labels edit locally and modifier clicks navigate", async ({
  page,
}) => {
  await demo(page);
  await create(page, "링크 맥락");
  await source(page);
  await body(page, "앞 [[덤프]] 중간 [출처](https://example.com) 끝\n\n아래");
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  const links = editor(page).locator(".cm-note-link");
  await expect(links).toHaveCount(2);
  await links.filter({ hasText: "덤프" }).click();
  await expect(
    page.getByRole("heading", { name: "링크 맥락", exact: true }),
  ).toBeVisible();
  await expect(editor(page)).toContainText("[[덤프]]");
  await expect(links).toHaveCount(1);
  await page.keyboard.insertText("수정");
  await editor(page).press("ControlOrMeta+End");
  await expect(links).toHaveCount(2);
  await page.getByRole("button", { name: "원문 보기", exact: true }).click();
  await expect(editor(page)).toContainText("수정");
  await body(page, "앞 [[덤프]] 중간 [출처](https://example.com) 끝\n\n아래");
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await page
    .context()
    .route("https://example.com/", (route) =>
      route.fulfill({ body: "source", contentType: "text/plain" }),
    );
  const popup = page.waitForEvent("popup");
  await links
    .filter({ hasText: "출처" })
    .click({ modifiers: ["ControlOrMeta"] });
  const external = await popup;
  await expect(external).toHaveURL("https://example.com/");
  await external.close();
  await links
    .filter({ hasText: "덤프" })
    .click({ modifiers: ["ControlOrMeta"] });
  await expect(
    page.getByRole("heading", { name: "덤프", exact: true }),
  ).toBeVisible();
});

test("S09 S12 writing-focus opening connections exits focus with coherent controls", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "집중 모드", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "집중 모드 끝내기", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "연결된 생각", exact: true }),
  ).toBeHidden();
  const panel = page.getByRole("button", {
    name: "연결 패널 열기",
    exact: true,
  });
  await expect(panel).toHaveAttribute("aria-expanded", "false");
  await panel.click();
  await expect(
    page.getByRole("heading", { name: "연결된 생각", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "노트 검색" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "집중 모드", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "연결 패널 접기", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("S04 writing-focus composition keeps Korean text, undo, and code links intact", async ({
  page,
}) => {
  await demo(page);
  await create(page, "한글 조합");
  await source(page);
  const original = "앞 [[덤프]] 중간 `[[코드]]` 끝\n\n입력 ";
  await body(page, original);
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await editor(page).press("ControlOrMeta+End");
  const cdp = await page.context().newCDPSession(page);
  for (const text of ["ㅎ", "하", "한"]) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
    await expect(editor(page).locator(".cm-note-link")).toHaveCount(1);
  }
  await cdp.send("Input.insertText", { text: "한" });
  await editor(page).press("ArrowLeft");
  await saved(page);
  await source(page);
  await expect(editor(page)).toContainText("입력 한");
  await expect(editor(page)).toContainText("`[[코드]]`");
  await editor(page).press("ControlOrMeta+z");
  await expect(editor(page)).not.toContainText("입력 한");
  await editor(page).press("ControlOrMeta+Shift+KeyZ");
  await expect(editor(page)).toContainText("입력 한");
});

test("S12 writing-focus actual editor text inherits readable typography at every width", async ({
  page,
}, testInfo) => {
  await demo(page);
  const textStyle = () =>
    editor(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        font: style.fontFamily,
        size: parseFloat(style.fontSize),
        line: parseFloat(style.lineHeight),
        width: element.getBoundingClientRect().width,
      };
    });
  expect(await textStyle()).toMatchObject({ size: 19.2, line: 30.72 });
  expect((await textStyle()).font).not.toContain("monospace");
  await page.getByRole("button", { name: "집중 모드", exact: true }).click();
  expect((await textStyle()).width).toBeLessThanOrEqual(835.3);
  await page.screenshot({
    path: testInfo.outputPath("focus.png"),
    fullPage: true,
  });
  await source(page);
  expect((await textStyle()).font).toContain("monospace");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await textStyle()).toMatchObject({ size: 19.2, line: 30.72, width: 390 });
  expect((await textStyle()).font).not.toContain("monospace");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("phone-focus.png"),
    fullPage: true,
  });
});

test("S04 S06 writing-focus escaped labels edit as source and open decoded targets", async ({
  page,
}) => {
  await demo(page);
  await create(page, "대괄호[제목]");
  await create(page, "이스케이프 연결");
  await source(page);
  const original =
    "앞 [[대괄호\\[제목\\]]] [별칭\\]](https://example.com) 뒤\n\n끝";
  await body(page, original);
  await saved(page);
  await editor(page).press("ControlOrMeta+End");
  await page
    .getByRole("button", { name: "라이브 프리뷰", exact: true })
    .click();
  const labels = editor(page).locator(".cm-note-link");
  await expect(labels).toHaveText(["대괄호[제목]", "별칭]"]);
  await labels.first().hover();
  await expect(labels).toHaveCount(2);
  await labels.first().click();
  await expect(editor(page)).toContainText("[[대괄호\\[제목\\]]]");
  await expect(
    page.getByRole("heading", { name: "이스케이프 연결", exact: true }),
  ).toBeVisible();
  await editor(page).press("ControlOrMeta+End");
  expect(
    Object.values(await rawNotes(page)).some((note) =>
      note.raw.endsWith(original),
    ),
  ).toBe(true);
  await labels.first().click({ modifiers: ["ControlOrMeta"] });
  await expect(
    page.getByRole("heading", { name: "대괄호[제목]", exact: true }),
  ).toBeVisible();
});
