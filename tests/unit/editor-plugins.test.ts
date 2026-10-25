import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import {
  resolveEditorPlugins,
  pluginCompletions,
} from "../../src/editor/plugins/registry";
import { builtinPlugins } from "../../src/editor/plugins/builtins";
import { documentContext } from "../../src/editor/document-context";
import { richNodes } from "../../src/editor/rich-preview";
import { readFrontmatter } from "../../src/domain/frontmatter";

it("S20 rejects duplicate stable IDs across providers and plugins", () => {
  expect(() => resolveEditorPlugins([{ id: "same" }, { id: "same" }])).toThrow(
    /same/,
  );
  expect(() =>
    resolveEditorPlugins([
      { id: "test", completions: [{ id: "test", complete: () => [] }] },
    ]),
  ).toThrow(/test/);
});
it("S20 extra command and formatter register without host branching", async () => {
  const plugins = resolveEditorPlugins([
    ...builtinPlugins,
    {
      id: "example",
      completions: [
        {
          id: "example.hello",
          complete: ({ trigger }) =>
            trigger.kind === "command"
              ? [{ label: "hello", apply: "Hello" }]
              : [],
        },
      ],
      formatters: [
        {
          id: "example.uppercase",
          label: "Uppercase",
          format: async (text) => text.toUpperCase(),
        },
      ],
    },
  ]);
  const state = EditorState.create({ doc: "@" });
  const result = pluginCompletions(
    () => plugins,
    () => [],
  )(new CompletionContext(state, 1, true));
  expect(
    result?.options.find((option) => option.label === "hello")?.apply,
  ).toBe("Hello");
  expect(
    await plugins.at(-1)?.formatters?.[0].format("hello", {
      signal: new AbortController().signal,
    }),
  ).toBe("HELLO");
});
it.each(["---\nname: '@'\n---\nbody", "---\nname: @\n---\nbody"])(
  "S17 metadata excludes completions even when visible or invalid",
  (text) => {
    const state = EditorState.create({ doc: text });
    expect(
      pluginCompletions(
        () => builtinPlugins,
        () => [],
      )(new CompletionContext(state, text.indexOf("@") + 1, true)),
    ).toBeNull();
  },
);
it("S17 metadata excludes math and image rendering", () => {
  const text =
    '---\nmath: "$x$"\nimage: "![x](assets/' +
    "a".repeat(64) +
    '.png)"\n---\n$y$';
  expect(
    richNodes(EditorState.create({ doc: text })).map((node) => node.value),
  ).toEqual(["y"]);
});
it.each(["---\r\nname: x\r\n---\r\nBody", "---\n---", "---\n---\nBody"])(
  "S17 authoritative source boundary includes both fences for %j",
  (text) => {
    const metadata = readFrontmatter(text);
    expect(text.slice(metadata.bodyStart)).toBe(metadata.markdown);
    expect(documentContext(text).bodyStart).toBe(metadata.bodyStart);
  },
);

it("S17 completion at the end of unclosed metadata stays suppressed", () => {
  const text = "---\nname: @";
  const state = EditorState.create({ doc: text });
  expect(
    pluginCompletions(
      () => builtinPlugins,
      () => [],
    )(new CompletionContext(state, text.length, true)),
  ).toBeNull();
});

it("S17 YAML literal fences do not change body rich syntax or completion exclusions", () => {
  const text = "---\nexample: |\n  ```\n---\n$x$\n\n```\n$code$\n```\n\n@";
  const state = EditorState.create({ doc: text });
  expect(richNodes(state).map((node) => node.value)).toEqual(["x"]);
  const complete = pluginCompletions(
    () => builtinPlugins,
    () => [],
  );
  expect(
    complete(new CompletionContext(state, text.length, true))?.options.some(
      (option) => option.label === "오늘",
    ),
  ).toBe(true);
  const inCode = text.replace("$code$", "@");
  expect(
    complete(
      new CompletionContext(
        EditorState.create({ doc: inCode }),
        inCode.indexOf("@") + 1,
        true,
      ),
    ),
  ).toBeNull();
});
