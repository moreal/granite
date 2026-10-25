import { describe, it, expect } from "vitest";
import { parseDocument } from "yaml";
import {
  searchTypes,
  suggestProperties,
  typeAncestors,
} from "../../src/schema";
import {
  completionContext,
  planCompletion,
  planPropertyInsertion,
} from "../../src/schema/yaml";
import provenance from "../../src/schema/provenance.json";
const apply = (
  source: string,
  edit: { from: number; to: number; insert: string },
) => source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
describe("S21 offline vocabulary", () => {
  it("pins complete official classes and property data", () => {
    expect(provenance.types).toBeGreaterThan(900);
    expect(provenance.properties).toBeGreaterThan(1500);
    expect(searchTypes("3DModel")[0].id).toBe("3DModel");
  });
  it("unions inherited and multiple type domains; retains all range hints", () => {
    const names = suggestProperties(
      ["https://schema.org/Book", "Product"],
      [],
      "",
      100,
    ).map((p) => p.id);
    expect(names).toContain("author");
    expect(suggestProperties(["Book"], [], "isbn")[0].id).toBe("isbn");
    expect(names).toContain("brand");
    expect(suggestProperties(["Book"], [], "author")[0].ranges).toEqual(
      expect.arrayContaining(["Person", "Organization"]),
    );
    expect(suggestProperties(["Book"], ["author"], "author")).toEqual([]);
    expect(suggestProperties(["custom"], [], "name")[0].id).toBe("name");
  });
  it("terminates cyclic multiple inheritance", () => {
    const data = new Map([
      ["A", { id: "A", label: "A", description: "", parents: ["B", "C"] }],
      ["B", { id: "B", label: "B", description: "", parents: ["A"] }],
      ["C", { id: "C", label: "C", description: "", parents: [] }],
    ]);
    expect([...typeAncestors(["A"], data)].sort()).toEqual(["A", "B", "C"]);
  });
});
describe("S21 source edits", () => {
  it("preserves every existing byte and safely quotes only new string values", () => {
    const source =
      "---\r\ntype: Book\r\n# comment\r\ncustom: yes\r\n---  \r\nProse";
    const result = planPropertyInsertion(
      source,
      "author",
      '[[a: #"b]]\nnext',
      "frontmatter",
    );
    expect(result.error).toBeNull();
    const next = apply(source, result.edit!);
    expect(next).toBe(
      '---\r\ntype: Book\r\n# comment\r\ncustom: yes\r\n"author": "[[a: #\\"b]]\\nnext"\r\n---  \r\nProse',
    );
  });
  it("keeps a bare document terminator last and ignores indented scalar dots", () => {
    const source = "name: a\n...";
    const next = apply(
      source,
      planPropertyInsertion(source, "author", "b").edit!,
    );
    expect(next).toBe('name: a\n"author": "b"\n...');
    expect(parseDocument(next).errors).toEqual([]);
    const scalar = "description: |\n  ...";
    const scalarNext = apply(
      scalar,
      planPropertyInsertion(scalar, "author", "b").edit!,
    );
    expect(scalarNext).toBe('description: |\n  ...\n"author": "b"');
    expect(parseDocument(scalarNext).get("description")).toBe("...\n");
  });
  it.each(["\n", "\r\n"])(
    "inserts before explicit YAML document end with %j separators",
    (newline) => {
      const yaml = `name: a${newline}# before end${newline}... # end${newline}# footer`;
      for (const mode of ["yaml", "frontmatter"] as const) {
        const source =
          mode === "yaml"
            ? yaml
            : `---${newline}${yaml}${newline}---  ${newline}Prose`;
        const result = planPropertyInsertion(source, "author", "b", mode);
        expect(result.error).toBeNull();
        const next = apply(source, result.edit!);
        expect(next).toBe(
          source.replace("... # end", `"author": "b"${newline}... # end`),
        );
        const nextYaml =
          mode === "yaml"
            ? next
            : next.slice(3 + newline.length, next.lastIndexOf(`${newline}---`));
        const doc = parseDocument(nextYaml);
        expect(doc.errors).toEqual([]);
        expect(doc.get("author")).toBe("b");
      }
    },
  );
  it.each([
    "{type: Book}",
    "a: [",
    "a: 1\na: 2",
    "a: &x 1\nb: *x",
    "- item",
    "a: !custom foo",
  ])("refuses unsafe map %s", (source) => {
    expect(planPropertyInsertion(source, "name", "x").edit).toBeNull();
  });
  it("refuses duplicate, unclosed metadata and stale completion plans", () => {
    expect(planPropertyInsertion("name: x", "name", "y").edit).toBeNull();
    expect(
      planPropertyInsertion("---\na: 1", "name", "y", "frontmatter").edit,
    ).toBeNull();
    const context = completionContext("auth", 4)!;
    expect(planCompletion("other", context, "author")).toBeNull();
  });
  it("completes partial keys and keeps colon, comment and scalar value", () => {
    for (const source of [
      "type: Book\nauth",
      'type: Book\nauth: "x:y" # keep',
    ]) {
      const pos = source.indexOf("auth") + 4;
      const context = completionContext(source, pos)!;
      expect(context.kind).toBe("property");
      expect(apply(source, planCompletion(source, context, "author")!)).toBe(
        source.replace("auth", source.endsWith("auth") ? "author: " : "author"),
      );
    }
  });
  it("completes plain type tokens including 3DModel", () => {
    const source = "type: Sch # hi";
    const context = completionContext(source, 9)!;
    expect(context.kind).toBe("type");
    expect(
      apply(source, planCompletion(source, context, "ScholarlyArticle")!),
    ).toBe("type: ScholarlyArticle # hi");
  });
  it.each([
    'type: "Boo" # keep',
    "'@type': 'Boo' # keep",
    '"@type": "https://schema.org/Boo" # keep',
    "type: http://schema.org/Boo # keep",
  ])("completes only local type scalar text in %s", (source) => {
    for (const mode of ["yaml", "frontmatter"] as const) {
      const input =
        mode === "yaml" ? source : `---\r\n${source}\r\n---  \r\nBody`;
      const cursor = input.indexOf("Boo") + 3;
      const context = completionContext(input, cursor, mode)!;
      expect(context.kind).toBe("type");
      expect(context.prefix).toBe("Boo");
      expect(apply(input, planCompletion(input, context, "Book")!)).toBe(
        input.replace("Boo", "Book"),
      );
      expect(
        completionContext(input, input.indexOf("# keep") + 3, mode),
      ).toBeNull();
    }
  });
  it.each([
    'type: "Boo',
    "type: [Boo]",
    'type: "https://other.org/Boo"',
    'other: "Boo"',
    'type: "Boo\\n"',
    "type: Book\nother: [",
  ])("does not complete unsafe or unsupported type scalar %s", (source) => {
    expect(completionContext(source, source.indexOf("Boo") + 3)).toBeNull();
  });
  it.each([
    "a:\n  auth",
    "a: |\n  auth",
    'a: "auth"',
    "# auth",
    "a: [\nauth",
    "a:\n- auth",
  ])("excludes nested/quoted/comments/invalid contexts %s", (source) => {
    expect(completionContext(source, source.length)).toBeNull();
  });
  it("does not offer metadata completion in body", () => {
    const source = "---\ntype: Book\n---\nauth";
    expect(completionContext(source, source.length, "frontmatter")).toBeNull();
  });
});
