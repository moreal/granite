import { openConnections } from "../helpers/ui";
import { test, expect } from "@playwright/test";
import {
  body,
  create,
  demo,
  editor,
  saved,
  source,
  live,
  propertyMode,
  rawNotes,
} from "../helpers/ui";
import { decodeNote, filenameFor } from "../../src/domain/notes";

test("S17 schema metadata preserves source and shows typed draft connections", async ({
  page,
}, testInfo) => {
  await demo(page);
  await create(page, "스키마 책");
  await source(page);
  const original =
    '---\n# 그대로 두는 주석\ntype: Book\nauthor: "[[새 저자]]"\ncustom: [one, 2]\n---\n그대로 두는 본문';
  await body(page, original);
  await saved(page);
  await propertyMode(page, "yaml");
  await live(page);
  await page.getByText("속성", { exact: true }).click();
  await expect(page.locator(".note-properties")).toContainText("Book");
  await expect(page.getByLabel("속성 YAML 원문")).toHaveValue(
    original.split("---\n")[1].trimEnd(),
  );
  await openConnections(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  const graph = page.getByRole("region", { name: "노트 그래프" });
  await expect(graph).toContainText("author");
  await expect(graph).toContainText("새 저자");
  await expect(graph).toContainText("없는 노트");
  await page.screenshot({
    path: testInfo.outputPath("schema-graph-desktop.png"),
  });
  await page
    .getByLabel("속성 YAML 원문")
    .fill(
      '# 그대로 두는 주석\ntype: [Book, CreativeWork]\nauthor: "[[바뀐 저자]]"\ncustom: [one, 2]',
    );
  await expect(graph).toContainText("바뀐 저자");
  await expect(graph).not.toContainText("새 저자");
  await saved(page);
  await page.reload();
  await source(page);
  await expect(editor(page)).toContainText("# 그대로 두는 주석");
  await expect(editor(page)).toContainText("custom: [one, 2]");
  await expect(editor(page)).toContainText("그대로 두는 본문");
  await openConnections(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  await graph.getByRole("button").filter({ hasText: "바뀐 저자" }).click();
  await expect(
    page.getByRole("heading", { name: "아직 없는 노트예요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "바뀐 저자", exact: true }),
  ).toBeVisible();
  await openConnections(page);
  await page.getByText("노트 그래프", { exact: true }).click();
  await expect(graph).toContainText("스키마 책");
  await expect(graph).toContainText("author");
});

test("S17 invalid properties stay editable and safe on a narrow screen", async ({
  page,
}, testInfo) => {
  await demo(page);
  await create(page, "잘못된 속성");
  await source(page);
  const original =
    '---\ntype: [broken\ncustom: "<img src=x onerror=alert(1)>"\n---\n보존할 글';
  await body(page, original);
  await propertyMode(page, "yaml");
  await live(page);
  await page.getByText("속성", { exact: true }).click();
  const properties = page.locator(".note-properties");
  const warning = properties.locator(".property-warning[role=status]");
  const cue = properties.locator("summary .property-validation-cue");
  const yaml = page.getByLabel("속성 YAML 원문");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("YAML 문법을 확인해 주세요");
  await expect(cue).toHaveText("확인 필요");
  await expect(yaml).toHaveAttribute("aria-invalid", "true");
  await expect(properties.locator("[role=alert]")).toHaveCount(0);
  await expect(editor(page)).toContainText("보존할 글");
  await saved(page);
  const filename = filenameFor("잘못된 속성");
  expect(decodeNote(filename, (await rawNotes(page))[filename].raw).body).toBe(
    original,
  );
  const correctedYaml = 'type: Person\ncustom: "<img src=x onerror=alert(1)>"';
  await yaml.fill(correctedYaml);
  await expect(yaml).toHaveValue(correctedYaml);
  await expect(warning).toHaveCount(0);
  await expect(cue).toHaveCount(0);
  await expect(yaml).not.toHaveAttribute("aria-invalid", "true");
  await expect(properties.locator("[role=alert]")).toHaveCount(0);
  await expect(page.locator(".note-properties img")).toHaveCount(0);
  await expect(page.locator(".note-pane img")).toHaveCount(0);
  await expect(editor(page)).toContainText("보존할 글");
  await saved(page);
  expect(decodeNote(filename, (await rawNotes(page))[filename].raw).body).toBe(
    original.replace("type: [broken", "type: Person"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("schema-properties-narrow.png"),
  });
});
