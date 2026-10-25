import { test, expect } from "@playwright/test";
import { filenameFor } from "../../src/domain/notes";
import {
  create,
  demo,
  editor,
  source,
  redo,
  rawNotes,
  saved,
} from "../helpers/ui";
test("S20 Linux shifted redo restores the formatted document before save", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "platform", { get: () => "Linux x86_64" }),
  );
  await demo(page);
  await create(page, "Linux probe");
  await source(page);
  await editor(page).click();
  await page.keyboard.insertText("[site](https://example.com)\n");
  await editor(page).press("Control+s");
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await editor(page).press("Control+z");
  await expect(editor(page)).toContainText("[site](https://example.com)");
  await redo(page, "Control");
  await expect(editor(page)).toContainText("[site]: https://example.com");
  await editor(page).press("Control+s");
  await saved(page);
  expect((await rawNotes(page))[filenameFor("Linux probe")].raw).toContain(
    "[site]: https://example.com",
  );
});
