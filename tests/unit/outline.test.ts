import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { frontmatterSyntax } from "../../src/domain/markdown";
import { writingHeadings } from "../../src/editor/outline";
it("S30d reads real ATX and Setext headings with document positions", () => {
  const doc =
    "---\ntitle: metadata\n---\n# 첫째\n\n둘째\n----\n\n```md\n# 거짓\n```\n\n#### 깊음\n\n### 셋째";
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: frontmatterSyntax })],
  });
  expect(
    writingHeadings(state).map(({ text, level, from }) => ({
      text,
      level,
      from,
    })),
  ).toEqual([
    { text: "첫째", level: 1, from: doc.indexOf("# 첫째") },
    { text: "둘째", level: 2, from: doc.indexOf("둘째") },
    { text: "셋째", level: 3, from: doc.indexOf("### 셋째") },
  ]);
});
it("S30d includes a far tail heading immediately without a partially parsed syntax tree", () => {
  const doc =
    "# 처음\n\n" + "긴 문장을 이어 적습니다. ".repeat(500) + "\n\n## 마지막";
  const state = EditorState.create({ doc, extensions: [markdown()] });
  expect(writingHeadings(state).map((h) => h.text)).toEqual(["처음", "마지막"]);
});
it("S30d preserves escaped literal punctuation in heading labels", () => {
  const state = EditorState.create({
    doc: "# \\*별표\\*와 **강조**",
    extensions: [markdown()],
  });
  expect(writingHeadings(state)[0].text).toBe("*별표*와 강조");
});
