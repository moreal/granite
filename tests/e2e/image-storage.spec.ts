import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

// Valid 1×1 PNG: exercise real browser SHA-256 and IndexedDB Blob cloning.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=";
const expectedPath = `assets/${createHash("sha256").update(Buffer.from(png, "base64")).digest("hex")}.png`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("S13 demo image bytes survive reload and identical pastes share one record", async ({
  page,
}) => {
  const saved = await page.evaluate(async (base64) => {
    const modulePath = "/src/storage/storage.ts";
    const { DemoStorage } = await import(modulePath);
    const storage = new DemoStorage();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const paths = await Promise.all([
      storage.putImage(new Blob([bytes], { type: "image/png" })),
      storage.putImage(new Blob([bytes], { type: "application/octet-stream" })),
    ]);
    const count = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("granite.image-assets.v1", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("images");
        const request = tx.objectStore("images").count();
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    return { paths, count };
  }, png);
  expect(saved).toEqual({ paths: [expectedPath, expectedPath], count: 1 });

  await page.reload();
  const restored = await page.evaluate(async (path) => {
    const modulePath = "/src/storage/storage.ts";
    const { DemoStorage } = await import(modulePath);
    const blob = await new DemoStorage().readImage(path);
    return {
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      type: blob.type,
    };
  }, expectedPath);
  expect(restored.bytes).toEqual(Array.from(Buffer.from(png, "base64")));
  expect(restored.type).toBe("image/png");
});

test("S13 demo asset lookup is isolated by storage namespace", async ({
  page,
}) => {
  const result = await page.evaluate(async (base64) => {
    const modulePath = "/src/storage/storage.ts";
    const { DemoStorage } = await import(modulePath);
    const first = new DemoStorage();
    first.id = "fixture-first";
    const second = new DemoStorage();
    second.id = "fixture-second";
    const blob = new Blob([
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    ]);
    const path = await first.putImage(blob);
    let missing = "";
    try {
      await second.readImage(path);
    } catch (error) {
      missing = (error as Error).message;
    }
    const secondPath = await second.putImage(blob);
    return {
      path,
      secondPath,
      missing,
      firstSize: (await first.readImage(path)).size,
      secondSize: (await second.readImage(path)).size,
    };
  }, png);
  expect(result.missing).toContain("찾을 수 없습니다");
  expect(result.path).toBe(expectedPath);
  expect(result.secondPath).toBe(expectedPath);
  expect(result.firstSize).toBe(Buffer.from(png, "base64").length);
  expect(result.secondSize).toBe(result.firstSize);
});

for (const failure of ["abort", "quota"] as const) {
  test(`S13 demo image ${failure} after add success rejects before note mutation`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ base64, failure }) => {
        const modulePath = "/src/storage/storage.ts";
        const { DemoStorage } = await import(modulePath);
        const storage = new DemoStorage();
        const note = await storage.create("보존할 글", "선택된 원래 문장");
        const original = localStorage.getItem(DemoStorage.key);
        const blob = new Blob([
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
        ]);
        const originalAdd = IDBObjectStore.prototype.add;
        let requestSucceeded = false;
        // Abort a genuine IDB transaction after its write request succeeds.
        // Quota is injected, not a claim that the browser disk was filled.
        IDBObjectStore.prototype.add = function (...args) {
          const request = originalAdd.apply(this, args);
          if (this.name === "images") {
            const transaction = this.transaction;
            request.addEventListener("success", () => {
              requestSucceeded = true;
              if (failure === "quota") {
                Object.defineProperty(transaction, "error", {
                  value: new DOMException(
                    "Injected quota failure",
                    "QuotaExceededError",
                  ),
                });
              }
              transaction.abort();
            });
          }
          return request;
        };
        let errorName = "";
        let errorMessage = "";
        let resolved = false;
        try {
          const path = await storage.putImage(blob);
          resolved = true;
          await storage.write(note, `![이미지](${path})`);
        } catch (error) {
          errorName = (error as Error).name;
          errorMessage = (error as Error).message;
        } finally {
          IDBObjectStore.prototype.add = originalAdd;
        }
        const unchanged = localStorage.getItem(DemoStorage.key) === original;
        const count = await new Promise<number>((resolve, reject) => {
          const open = indexedDB.open("granite.image-assets.v1", 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("images");
            const request = tx.objectStore("images").count();
            tx.oncomplete = () => {
              db.close();
              resolve(request.result);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
        const retryPath = await storage.putImage(blob);
        return {
          requestSucceeded,
          resolved,
          errorName,
          errorMessage,
          unchanged,
          count,
          retryPath,
        };
      },
      { base64: png, failure },
    );
    expect(result.requestSucceeded).toBe(true);
    expect(result.resolved).toBe(false);
    expect(result.errorMessage).not.toBe("");
    if (failure === "quota")
      expect(result.errorName).toBe("QuotaExceededError");
    expect(result.unchanged).toBe(true);
    expect(result.count).toBe(0);
    expect(result.retryPath).toBe(expectedPath);
  });
}
