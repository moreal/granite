import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { readFrontmatter } from "../../src/domain/frontmatter";
import { builtinPlugins } from "../../src/editor/plugins/builtins";
import { pluginCompletions } from "../../src/editor/plugins/registry";
it("S21 accepts official numeric-leading types and custom types", () => {
  for (const type of ["3DModel", "CustomType"]) {
    const metadata = readFrontmatter(`---\ntype: ${type}\n---\n`);
    expect(metadata.warning).toBeNull();
    expect(metadata.types).toEqual([type]);
  }
});
it("S21 registers schema completion through plugins inside frontmatter", async () => {
  const text = "---\ntype: Book\nau\n---\nbody";
  const result = await pluginCompletions(
    () => builtinPlugins,
    () => [],
  )(
    new CompletionContext(
      EditorState.create({ doc: text }),
      text.indexOf("au") + 2,
      true,
    ),
  );
  expect(result?.options.some((option) => option.label === "author")).toBe(
    true,
  );
});
it("S21 schema plugin refuses comments, nested content, read-only and composing views", () => {
  for (const text of [
    "---\ntype: Book\n# au\n---\n",
    "---\ntype: Book\nextra:\n  au\n---\n",
    "plain au",
  ]) {
    const at = text.lastIndexOf("au") + 2;
    const result = pluginCompletions(
      () => builtinPlugins,
      () => [],
    )(new CompletionContext(EditorState.create({ doc: text }), at, true));
    expect(result).toBeNull();
  }
  const text = "---\ntype: Book\nau\n---\n";
  expect(
    pluginCompletions(
      () => builtinPlugins,
      () => [],
    )(
      new CompletionContext(
        EditorState.create({
          doc: text,
          extensions: EditorState.readOnly.of(true),
        }),
        text.indexOf("au") + 2,
        true,
      ),
    ),
  ).toBeNull();
});
