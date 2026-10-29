// @vitest-environment node
import { expect, it } from "vitest";
import { formatWithWarnings } from "@hongdown/wasm";
import { hongdownOptions } from "../../src/editor/formatting/options";

it("S31 uses the CMS hongdown defaults for headings, wrapping, punctuation and fences", async () => {
  const source =
    '# 제목 Heading\n\n## 작은 Heading\n\n"Hello" -- world...\n\n' +
    "한글 문장을 길게 씁니다. ".repeat(12) +
    "\n\n```mermaid\ngraph TD\n A-->B\n```\n\n[[A\\[B\\]C]] $x+1$\n\n[site](https://example.com)\n";
  const defaults = await formatWithWarnings(source, {});
  const result = await formatWithWarnings(source, hongdownOptions);
  expect(result.output).toBe(defaults.output);
  expect(result.output).toContain("제목 Heading\n============");
  expect(result.output).toContain("작은 Heading\n------------");
  expect(result.output).toContain("“Hello” — world…");
  expect(result.output).not.toContain("한글 문장을 길게 씁니다. ".repeat(12));
  expect(result.output).toContain("~~~~ mermaid\ngraph TD\n A-->B\n~~~~");
  expect(result.output).toContain("[[A\\[B\\]C]] $x+1$");
  expect(result.output).toContain("[site]: https://example.com");
});
