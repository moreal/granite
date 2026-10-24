import { expect, test } from "@playwright/test";
import { demo, openListed, saved } from "../helpers/ui";

const person = "윤여울 — 가상의 작가";
const book = "느린 질문의 숲 — 가상의 책";
const article = "질문을 산책시키는 독서 — 예시 글";

test("S15/S17 typed fixtures expose relationships and edits survive reopening", async ({
  page,
}) => {
  await demo(page);
  await openListed(page, article);
  await page.locator(".note-properties summary").click();
  await expect(page.locator(".note-properties")).toContainText("Article");
  await page.locator(".note-graph summary").click();
  const graph = page.getByRole("region", { name: "노트 그래프" });
  await expect(graph).toContainText(person);
  await expect(graph).toContainText("Person");
  await expect(graph).toContainText(book);
  await expect(graph).toContainText("Book");
  await expect(graph.getByRole("button")).toHaveCount(2);
  await expect(graph).not.toContainText("본문 링크");
  await expect(graph).toContainText("author");
  await expect(graph).toContainText("about");
  await page
    .getByLabel("속성 YAML 원문")
    .fill(
      'type: Article\nauthor: "[[덤프]]"\nabout: "[[좋은 질문을 모으는 일]]"',
    );
  await expect(graph).toContainText("덤프");
  await expect(graph).toContainText("좋은 질문을 모으는 일");
  await expect(graph).not.toContainText(person);
  await expect(graph).not.toContainText(book);
  await saved(page);
  await page.screenshot({ path: "docs/screenshots/typed-demo-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/screenshots/typed-demo-narrow.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: article, exact: true }),
  ).toBeVisible();
  await page.locator(".note-properties summary").click();
  await expect(page.getByLabel("속성 YAML 원문")).toHaveValue(
    'type: Article\nauthor: "[[덤프]]"\nabout: "[[좋은 질문을 모으는 일]]"',
  );
  await page.locator(".note-graph summary").click();
  await expect(graph).toContainText("덤프");
  await expect(graph).toContainText("좋은 질문을 모으는 일");
});

test("S15/S17 collision-safe references and partial seed retries preserve edits", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const demoPath = "/src/storage/demo.ts";
    const storagePath = "/src/storage/storage.ts";
    const { openDemo, typedDemoSeedKey, typedDemoTitles, richDemoSeedKey } =
      await import(demoPath);
    const { DemoStorage } = await import(storagePath);
    const s = new DemoStorage();
    localStorage.setItem(richDemoSeedKey, JSON.stringify({ complete: true }));
    const original = await s.create(typedDemoTitles.person, "사용자 원본");
    await s.create(typedDemoTitles.book, "사용자 책");
    const setItem = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === typedDemoSeedKey &&
        JSON.parse(value).book?.complete &&
        !failed
      ) {
        failed = true;
        throw Error("injected marker failure");
      }
      return setItem.call(this, key, value);
    };
    try {
      await openDemo();
    } catch {
      /* Resume committed pending book. */
    } finally {
      Storage.prototype.setItem = setItem;
    }
    const partial = await s.list();
    const seededBook = partial.find(
      (n: { title: string }) => n.title === typedDemoTitles.book + " (2)",
    );
    await s.write(seededBook, seededBook.body + "\n내 편집");
    await Promise.all([openDemo(), openDemo()]);
    const notes = await s.list();
    return {
      failed,
      count: notes.length,
      original: (await s.read(original.filename)).body,
      book: (await s.read(seededBook.filename)).body,
      article: notes.find(
        (n: { title: string }) => n.title === typedDemoTitles.article,
      ).body,
      journal: JSON.parse(localStorage.getItem(typedDemoSeedKey)!),
    };
  });
  expect(result.failed).toBe(true);
  expect(result.count).toBe(5);
  expect(result.original).toBe("사용자 원본");
  expect(result.book).toContain(`author: "[[${person} (2)]]"`);
  expect(result.book).toContain("내 편집");
  expect(result.article).toContain(`author: "[[${person} (2)]]"`);
  expect(result.article).toContain(`about: "[[${book} (2)]]"`);
  expect(
    Object.values(result.journal).every(
      (entry) => (entry as { complete: boolean }).complete,
    ),
  ).toBe(true);
});
