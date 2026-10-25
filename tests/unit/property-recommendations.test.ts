import { expect, it } from "vitest";
import {
  noteReference,
  recommendNotes,
  linkWarnings,
} from "../../src/schema/references";
it("S24 ranks range alternatives and inheritance before unknown and known mismatches", () => {
  const notes = [
    noteReference("book", "---\ntype: Book\n---\n"),
    noteReference("unknown", "body"),
    noteReference("org", "---\ntype: Organization\n---\n"),
    noteReference(
      "person",
      "---\ntype: [Custom, 'https://schema.org/Person']\n---\n",
    ),
  ];
  expect(
    recommendNotes(notes, "author", "").map((n) => [n.title, n.compatibility]),
  ).toEqual([
    ["org", "compatible"],
    ["person", "compatible"],
    ["unknown", "unknown"],
    ["book", "mismatch"],
  ]);
  expect(
    recommendNotes(notes, "about", "").find((n) => n.title === "book")
      ?.compatibility,
  ).toBe("compatible");
  expect(
    recommendNotes(notes, "custom", "").every(
      (n) => n.compatibility === "unknown",
    ),
  ).toBe(true);
  expect(
    linkWarnings("[[book]] [[unknown]] [[missing]]", "author", notes),
  ).toHaveLength(1);
  expect(linkWarnings("[[book]]", "about", notes)).toHaveLength(0);
});
it("S24 keeps mixed custom and invalid declarations uncertain, and all search matches", () => {
  const notes = [
    noteReference("mixed", "---\ntype: [Book, Custom]\n---\n"),
    noteReference("invalid", "---\ntype: 23\n---\n"),
  ];
  expect(
    recommendNotes(notes, "author", "").every(
      (n) => n.compatibility === "unknown",
    ),
  ).toBe(true);
  expect(
    recommendNotes(
      Array.from({ length: 30 }, (_, i) => noteReference(`노트 ${i}`, "body")),
      "author",
      "",
    ),
  ).toHaveLength(30);
});
