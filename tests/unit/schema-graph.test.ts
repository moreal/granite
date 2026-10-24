import { describe, expect, it } from "vitest";
import {
  readFrontmatter,
  replaceFrontmatter,
} from "../../src/domain/frontmatter";
import { projectNoteGraph } from "../../src/domain/note-graph";
import { decodeNote, encodeNote, serializeNote } from "../../src/domain/notes";

describe("S17 schema frontmatter", () => {
  it("preserves comments, unknown fields and storage bytes while deriving multiple types", () => {
    const body =
      '---\n# my comment\ntype: [Book, "https://schema.org/CreativeWork"]\nunknown: [one, 2, true]\nauthor: "[[Ada]]"\n---\nMy book';
    const note = decodeNote("book.md", encodeNote("Book", body));
    const meta = readFrontmatter(note.body);
    expect(meta.types).toEqual(["Book", "CreativeWork"]);
    expect(meta.properties.get("unknown")).toEqual(["one", 2, true]);
    expect(meta.markdown).toBe("My book");
    expect(serializeNote(note, note.body)).toBe(note.baseline);
    expect(replaceFrontmatter(body, meta.yaml)).toBe(body);
  });
  it("accepts quoted @type and defaults ordinary Markdown to Thing", () => {
    expect(readFrontmatter('---\n"@type": Person\n---\n').types).toEqual([
      "Person",
    ]);
    expect(readFrontmatter("# Ordinary\n---\ntext").types).toEqual(["Thing"]);
    expect(readFrontmatter("# Ordinary\n---\ntext").present).toBe(false);
  });
  it.each([
    "type: [broken",
    "a: &a [one]\nb: *a",
    "a: !custom value",
    "type: Book\ntype: Person",
    "- not a mapping",
    "deep: " + "[".repeat(50) + "0" + "]".repeat(50),
    "large: " + "x".repeat(33_000),
  ])("warns without changing invalid or unsupported YAML: %s", (yaml) => {
    const body = `---\n${yaml}\n---\n[[Body link]]`;
    expect(readFrontmatter(body).warning).toBeTruthy();
    expect(readFrontmatter(body).types).toEqual(["Thing"]);
    expect(replaceFrontmatter(body, yaml)).toBe(body);
  });
  it("stores prototype-looking keys safely without mutating object prototypes", () => {
    const meta = readFrontmatter(
      "---\n__proto__: value\nconstructor: other\ntype: Book\n---\n",
    );
    expect(meta.warning).toBeNull();
    expect(meta.properties.get("__proto__")).toBe("value");
    expect(meta.properties.get("constructor")).toBe("other");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("keeps unclosed frontmatter editable and inserts new metadata only explicitly", () => {
    expect(readFrontmatter("---\ntype: Book").warning).toBeTruthy();
    expect(replaceFrontmatter("Keep my prose", "type: Book")).toBe(
      "---\ntype: Book\n---\nKeep my prose",
    );
    expect(replaceFrontmatter("---\ntype: Book", "type: Person")).toBe(
      "---\ntype: Person",
    );
  });
});

describe("S17 note graph", () => {
  const note = (title: string, body: string) => ({
    title,
    filename: `${title}.md`,
    body,
  });
  it("projects every note and separates typed property links from body links", () => {
    const graph = projectNoteGraph([
      note(
        "Book",
        '---\ntype: Book\nauthor: "[[Ada]]"\nabout: ["[[Missing]]", "[[Ada]]"]\n---\n[[Ada]] and `[[ignored]]`',
      ),
      note("Ada", "---\ntype: Person\n---\n"),
      note("Isolated", "No links"),
    ]);
    expect(graph.nodes.map((n) => n.id)).toEqual([
      "Book.md",
      "Ada.md",
      "Isolated.md",
      "missing:Missing",
    ]);
    expect(graph.nodes.find((n) => n.title === "Missing")?.missing).toBe(true);
    expect(graph.edges.map((e) => [e.target, e.property])).toEqual([
      ["Ada.md", "author"],
      ["missing:Missing", "about"],
      ["Ada.md", "about"],
      ["Ada.md", null],
    ]);
    expect(graph.nodes.find((n) => n.title === "Ada")?.types).toEqual([
      "Person",
    ]);
  });
  it("preserves nested fields without treating them as supported relationship values", () => {
    const graph = projectNoteGraph([
      note(
        "Book",
        '---\ntype: Book\nauthor: {name: "[[Nested]]"}\nabout: [["[[Deep]]"]]\n---\n',
      ),
    ]);
    expect(graph.edges).toEqual([]);
  });
  it("reprojects drafts immediately and ignores invalid metadata links", () => {
    const old = note("Book", '---\nauthor: "[[Old]]"\n---\n');
    expect(projectNoteGraph([old]).edges[0].target).toBe("missing:Old");
    expect(
      projectNoteGraph([{ ...old, body: '---\nauthor: "[[New]]"\n---\n' }])
        .edges[0].target,
    ).toBe("missing:New");
    expect(
      projectNoteGraph([
        note("Bad", '---\nauthor: ["[[No]]"\n---\n[[Yes]]'),
      ]).edges.map((e) => e.target),
    ).toEqual(["missing:Yes"]);
  });
});
