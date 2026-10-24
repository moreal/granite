import { expect, test } from "@playwright/test";

test("S15 new demo persists editable examples and deduplicates the bundled asset", async ({
  page,
}) => {
  await page.goto("/");
  const first = await page.evaluate(async () => {
    const path = "/src/storage/demo.ts";
    const { openDemo, richDemoTitle } = await import(path);
    const [s] = await Promise.all([openDemo(), openDemo()]);
    const notes = await s.list();
    const note = notes.find(
      (n: { title: string }) => n.title === richDemoTitle,
    );
    const image = note.body.match(/!\[[^\]]*\]\((assets\/[^)]+)\)/)[1];
    const blob = await s.readImage(image);
    const dedup = await s.putImage(blob);
    await s.write(note, note.body + "\n내가 남긴 문장");
    return {
      count: notes.length,
      body: note.body,
      image,
      dedup,
      bytes: blob.size,
    };
  });
  expect(first.count).toBe(5);
  expect(first.body).toContain("```javascript");
  expect(first.body).toContain("```python");
  expect(first.body).toContain("```mermaid");
  expect(first.body).toContain("\\sum_{i=1}^{7}");
  expect(first.image).toMatch(/^assets\/[a-f0-9]{64}\.png$/);
  expect(first.dedup).toBe(first.image);
  expect(first.bytes).toBeGreaterThan(100);
  await page.reload();
  const restored = await page.evaluate(async (image) => {
    const path = "/src/storage/demo.ts";
    const { openDemo, richDemoTitle } = await import(path);
    const s = await openDemo();
    const notes = await s.list();
    return {
      count: notes.length,
      body: notes.find((n: { title: string }) => n.title === richDemoTitle)
        .body,
      bytes: (await s.readImage(image)).size,
    };
  }, first.image);
  expect(restored.count).toBe(5);
  expect(restored.body).toContain("내가 남긴 문장");
  expect(restored.bytes).toBe(first.bytes);
});

test("S15 existing notes and colliding titles survive upgrades and marker failure retry", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const demoPath = "/src/storage/demo.ts";
    const storagePath = "/src/storage/storage.ts";
    const { openDemo, richDemoTitle, richDemoSeedKey } = await import(demoPath);
    const { DemoStorage } = await import(storagePath);
    const storage = new DemoStorage();
    const old = await storage.create(richDemoTitle, "내 원래 글");
    const setItem = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function (key, value) {
      if (key === richDemoSeedKey && JSON.parse(value).complete && !failed) {
        failed = true;
        throw new DOMException("injected quota", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
    try {
      await openDemo();
    } catch {
      /* Retry after committed note + failed marker. */
    } finally {
      Storage.prototype.setItem = setItem;
    }
    const added = (await storage.list()).find(
      (n: { title: string }) => n.title === richDemoTitle + " (2)",
    );
    await storage.write(added, "실패 직후에도 사용자가 편집한 예시");
    await Promise.all([openDemo(), openDemo()]);
    const notes = await storage.list();
    return {
      failed,
      count: notes.length,
      original: (await storage.read(old.filename)).body,
      edited: (await storage.read(added.filename)).body,
      marker: JSON.parse(localStorage.getItem(richDemoSeedKey)!),
    };
  });
  expect(result.failed).toBe(true);
  expect(result.count).toBe(2);
  expect(result.original).toBe("내 원래 글");
  expect(result.edited).toBe("실패 직후에도 사용자가 편집한 예시");
  expect(result.marker.complete).toBe(true);
});

test("S15 two tabs seed one example and image failure remains retryable", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const failed = await page.evaluate(async () => {
    const demoPath = "/src/storage/demo.ts";
    const storagePath = "/src/storage/storage.ts";
    const { openDemo, richDemoSeedKey } = await import(demoPath);
    const { DemoStorage } = await import(storagePath);
    await new DemoStorage().create("기존 글", "보존");
    const putImage = DemoStorage.prototype.putImage;
    DemoStorage.prototype.putImage = async () => {
      throw Error("injected image failure");
    };
    let rejected = false;
    try {
      await openDemo();
    } catch {
      rejected = true;
    } finally {
      DemoStorage.prototype.putImage = putImage;
    }
    return {
      rejected,
      marker: localStorage.getItem(richDemoSeedKey),
      count: (await new DemoStorage().list()).length,
    };
  });
  expect(failed).toEqual({ rejected: true, marker: null, count: 1 });
  const second = await context.newPage();
  await second.goto("/");
  await Promise.all(
    [page, second].map((tab) =>
      tab.evaluate(async () => {
        const demoPath = "/src/storage/demo.ts";
        const { openDemo } = await import(demoPath);
        await openDemo();
      }),
    ),
  );
  const count = await page.evaluate(async () => {
    const demoPath = "/src/storage/demo.ts";
    const { openDemo } = await import(demoPath);
    return (await (await openDemo()).list()).length;
  });
  expect(count).toBe(2);
});

test("S15 example previews render on desktop and narrow screens and math edits persist", async ({
  page,
}) => {
  const { demo, openListed, editor, source, body, saved } =
    await import("../helpers/ui");
  await demo(page);
  await openListed(page, "직접 고쳐 보는 생각의 지도");
  await expect(page.locator(".cm-rich-image img")).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/demo-examples-desktop.png" });
  await page.locator(".cm-rich-math").last().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/demo-examples-math-code.png",
  });
  await editor(page).press("ControlOrMeta+End");
  await page.locator(".cm-rich-mermaid").scrollIntoViewIfNeeded();
  await expect(page.locator(".cm-rich-mermaid svg")).toBeVisible();

  await page.screenshot({ path: "docs/screenshots/demo-examples-mermaid.png" });
  await page.setViewportSize({ width: 760, height: 900 });
  await page.screenshot({ path: "docs/screenshots/demo-examples-narrow.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await source(page);
  const original = await page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem("granite.demo.v1")!);
    return (Object.values(notes) as { raw: string }[])
      .find((n) => n.raw.includes("\\sum_{i=1}^{7}"))!
      .raw.split(" -->\n")
      .slice(1)
      .join(" -->\n");
  });
  await body(page, original.replace("\\sum_{i=1}^{7}", "\\sum_{i=1}^{30}"));
  await saved(page);
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText("\\sum_{i=1}^{30}");
});
