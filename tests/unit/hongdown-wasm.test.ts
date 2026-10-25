// @vitest-environment node
import { expect, it } from "vitest";
import { formatWithWarnings } from "@hongdown/wasm";
import { hongdownOptions } from "../../src/editor/formatting/options";
it("S20 real pinned WASM retains conservative syntax and emits reference links", async () => {
  const source =
    "# Heading\n\n> quoted\n> words\n\n[[A\\[B\\]C]] $x+1$\n\n```mermaid\ngraph TD\n A-->B\n```\n\n[site](https://example.com)\n";
  const result = await formatWithWarnings(source, hongdownOptions);
  expect(result.output).toContain("# Heading");
  expect(result.output).toContain("[[A\\[B\\]C]]");
  expect(result.output).toContain("$x+1$");
  expect(result.output).toContain("```mermaid\ngraph TD\n A-->B\n```");
  expect(result.output).toContain("[site]: https://example.com");
});
