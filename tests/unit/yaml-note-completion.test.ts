import { expect, it } from "vitest";
import { yamlNoteContext, planYamlNote } from "../../src/schema/yaml-notes";
import { parseDocument } from "yaml";
it("S24 completes only the active YAML scalar and preserves CRLF, comments, prose and wiki escaping", () => {
  for (const raw of ["@윤", '"[[윤"', "'[[윤'", '"앞 \\\\ @윤 뒤"']) {
    const source = `---\r\ntype: Book\r\nauthor: ${raw} # keep\r\nother: 'raw'\r\n---\r\nbody`;
    const pos = source.indexOf("윤") + 1;
    const ctx = yamlNoteContext(source, pos, "frontmatter");
    expect(ctx, raw).not.toBeNull();
    const edit = planYamlNote(source, ctx!, '윤[가]: "말"\\이름')!;
    const changed =
      source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
    expect(changed.endsWith(" # keep\r\nother: 'raw'\r\n---\r\nbody")).toBe(
      true,
    );
    const parsed = parseDocument(changed.split("---")[1]).toJS();
    expect(parsed.author).toContain('[[윤\\[가\\]: "말"\\\\이름]]');
    expect(planYamlNote(source + "x", ctx!, "윤")).toBeNull();
  }
});
it("S24 supports direct list items but excludes nested maps, comments, block text, aliases/tags and ambiguous YAML", () => {
  for (const source of ["author:\n  - @윤", 'author:\n  - "[[윤"'])
    expect(yamlNoteContext(source, source.indexOf("윤") + 1)?.property).toBe(
      "author",
    );
  for (const source of [
    "# author: @윤",
    "author: old # @윤",
    "other: |\n  author: @윤",
    "other:\n  author: @윤",
    "author: &id @윤",
    "author: !custom @윤",
    "other: *bad\nauthor: @윤",
    "bad: [\nauthor: @윤",
    "author: @윤\nauthor: old",
    "author: @윤\n" + "x".repeat(32768),
  ])
    expect(
      yamlNoteContext(source, source.indexOf("윤") + 1),
      source.slice(0, 70),
    ).toBeNull();
});
it("S24 preserves single quotes and refuses positions in suffix/comments and unrelated syntax errors", () => {
  const text = "author: '앞 @윤 뒤' # comment";
  const context = yamlNoteContext(text, text.indexOf("윤") + 1)!;
  expect(planYamlNote(text, context, "윤's")?.insert).toBe("'앞 [[윤''s]] 뒤'");
  for (const source of [
    'author: "[[윤" # @a',
    'author: "[[윤"\nother: !bad a',
    'author: "[[윤"\nother: [',
    "author: |\n  @윤",
    "author: [@윤]",
  ]) {
    const pos = source.includes("# @a")
      ? source.length
      : source.indexOf("윤") + 1;
    expect(yamlNoteContext(source, pos)).toBeNull();
  }
});

it("S24 completes quoted type scalars and direct-list types into valid exact YAML", async () => {
  const { propertyCompletionScope, planPropertyCompletion } =
    await import("../../src/schema/property-completions");
  for (const raw of ['"Per', '"Per"', "'Per'", "https://schema.org/Per"]) {
    const source = `type:\n  - ${raw} # keep`;
    const at = source.indexOf("Per") + 3;
    const scope = propertyCompletionScope(source, at);
    if (raw === '\"Per') {
      // An unfinished quote treats the following hash as string content; no safe type prefix.
      expect(scope).toBeNull();
      continue;
    }
    const edit = planPropertyCompletion(source, scope!, "Person")!;
    const changed =
      source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
    expect(parseDocument(changed).errors).toEqual([]);
    expect(changed.endsWith(" # keep")).toBe(true);
  }
  const source = 'type: "Per';
  const scope = propertyCompletionScope(source, source.length)!;
  const edit = planPropertyCompletion(source, scope, "Person")!;
  expect(edit.insert).toBe('"Person"');
});
it("S24 refuses repaired flow collections and malformed mapping values instead of converting them to text", () => {
  for (const source of [
    "author: [old, @윤]",
    'author: [old, "[[윤"]',
    "author:\n  - [old, @윤]",
    "author: pre: @윤",
    "author: @윤:",
  ])
    expect(
      yamlNoteContext(source, source.indexOf("윤") + 1),
      source,
    ).toBeNull();
});
it("S24 accepts valid indentationless direct scalar lists", () => {
  const source = "author:\n- @윤";
  expect(yamlNoteContext(source, source.length)?.property).toBe("author");
});
it("S24 bounds every completion branch by YAML size without bounding ordinary prose", async () => {
  const { propertyCompletionScope, propertyCompletionOptions } =
    await import("../../src/schema/property-completions");
  const oversized = "name" + "a".repeat(40000);
  expect(propertyCompletionScope(oversized, 4)).toBeNull();
  expect(
    propertyCompletionScope(`---\n${oversized}\n---\nbody`, 8, "frontmatter"),
  ).toBeNull();
  const source = "---\ntype:\n- Per\n---\n" + "prose".repeat(20000);
  const context = propertyCompletionScope(
    source,
    source.indexOf("Per") + 3,
    "frontmatter",
  );
  expect(context).not.toBeNull();
  expect(
    propertyCompletionOptions(context!, []).map((option) => option.id),
  ).toContain("Person");
});
it("S24 proves plain scalar grammar by preserving all structure outside the active trigger", () => {
  for (const source of [
    "author: - @윤",
    "author: ? @윤",
    "author: , @윤",
    "author: % @윤",
    "author: ` @윤",
    "author: [[old], @윤]",
    'author: [[old], "[[윤"]',
  ])
    expect(
      yamlNoteContext(source, source.indexOf("윤") + 1),
      source,
    ).toBeNull();
  for (const source of [
    "author: = @윤",
    "author: 앞 @윤 뒤",
    "author: [[윤",
    "author: [[윤]]",
  ])
    expect(
      yamlNoteContext(source, source.indexOf("윤") + 1),
      source,
    ).not.toBeNull();
});
