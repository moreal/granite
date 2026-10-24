import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import {
  richNodes,
  safeMermaidSource,
  sanitizeDiagram,
} from "../../src/editor/rich-preview";
function nodes(text: string) {
  return richNodes(EditorState.create({ doc: text, extensions: [markdown()] }));
}
describe("S13/S14 contextual rich content", () => {
  it("finds local images, math and mermaid while excluding code, currency and URLs", () => {
    const path = `assets/${"a".repeat(64)}.png`;
    const text = `![alt](${path})\n\n$x^2$ and $5 or $10 and https://e.test/$a$\n\n\`$ignored$\`\n\n$$\nx+y\n$$\n\n\`\`\`mermaid\ngraph TD; A-->B\n\`\`\`\n\n\`\`\`txt\n$ignored$\n\`\`\``;
    expect(nodes(text).map((n) => n.kind)).toEqual([
      "image",
      "math",
      "math",
      "mermaid",
    ]);
    expect(nodes(`![x](https://example.com/a.png) \\$escaped$`)).toEqual([]);
  });
  it("rejects Mermaid configuration, interaction and resource directives", () => {
    expect(safeMermaidSource("graph TD; A-->B")).toBe(true);
    for (const source of [
      "%%{init: {}}%%\ngraph TD",
      "graph TD; A-->B; style A fill:url(//evil.test/image)",
      "---\nconfig: {}\n---\ngraph TD",
      'graph TD\nclick A "https://evil.test"',
      'flowchart TD\nA@{img: "https://evil.test/a"}',
      "graph TD\nA[<img src=x>]",
    ])
      expect(safeMermaidSource(source)).toBe(false);
  });
  it("rejects executable SVG and remote references, allowing local diagram markers", () => {
    expect(
      sanitizeDiagram(
        '<svg xmlns="http://www.w3.org/2000/svg"><path marker-end="url(#a)"/></svg>',
      ),
    ).toContain("marker-end");
    for (const svg of [
      '<svg onload="alert(1)"/>',
      "<svg><script>alert(1)</script></svg>",
      '<svg><image href="https://evil.test/x"/></svg>',
      "<svg><style>path{fill:url(https://evil.test/x)}</style></svg>",
    ])
      expect(() => sanitizeDiagram(svg)).toThrow();
  });
});
it("S14 parses escaped dollars and backslash parity without truncating math", () => {
  expect(nodes(String.raw`$x \$ y$`).map((n) => n.value)).toEqual([
    String.raw`x \$ y`,
  ]);
  expect(nodes(String.raw`\\$x$`).map((n) => n.value)).toEqual(["x"]);
  expect(nodes(String.raw`\$x$`)).toEqual([]);
});
it("S14 excludes math deep inside a long fenced code document", () => {
  const prefix = "ordinary text\n\n".repeat(800);
  expect(nodes(prefix + "```text\n$x$\n```\n\nend")).toEqual([]);
});
it("S14 allows number-led equations but leaves currency prose as text", () => {
  expect(nodes("$2x$ $2 + 2 = 4$ $123$").map((n) => n.value)).toEqual([
    "2x",
    "2 + 2 = 4",
    "123",
  ]);
  expect(nodes("costs $5 or $10")).toEqual([]);
});
