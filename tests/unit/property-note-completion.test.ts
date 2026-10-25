import { expect, it } from "vitest";
import {
  propertyNoteContext,
  propertyNoteTitles,
  completePropertyNote,
} from "../../src/components/properties/property-note-completion";

it("S23 matches @ and [[ at the caret, excluding email, escaped and completed links", () => {
  expect(propertyNoteContext("앞 @작 뒤", 4, 4)).toEqual({
    from: 2,
    to: 4,
    query: "작",
    closing: false,
  });
  expect(propertyNoteContext("앞 [[작 뒤", 5, 5)).toEqual({
    from: 2,
    to: 5,
    query: "작",
    closing: false,
  });
  for (const text of ["mail@example", "\\[[작", "[[작가]]", "@a@b"]) {
    expect(propertyNoteContext(text, text.length, text.length)).toBeNull();
  }
  expect(propertyNoteContext("[[작", 3, 1)).toBeNull();
});
it("S23 searches only existing titles with Korean and case folding, unescaping wiki query", () => {
  expect(
    propertyNoteTitles(["작가", "다른 노트", "BOOK", "작[가]"], "작"),
  ).toEqual(["작가", "작[가]"]);
  expect(propertyNoteTitles(["BOOK", "다른 노트"], "book")).toEqual(["BOOK"]);
  expect(propertyNoteTitles(["작[가]"], "작\\[")).toEqual(["작[가]"]);
  expect(propertyNoteTitles(["작가"], "missing")).toEqual([]);
});
it("S23 replaces only trigger and optional closing brackets with escaped persisted link and caret", () => {
  expect(
    completePropertyNote(
      "앞 @작 뒤",
      propertyNoteContext("앞 @작 뒤", 4, 4)!,
      "작[가]\\이름",
    ),
  ).toEqual({
    value: "앞 [[작\\[가\\]\\\\이름]] 뒤",
    caret: 16,
  });
  expect(
    completePropertyNote(
      "[[작]] 뒤",
      propertyNoteContext("[[작]] 뒤", 3, 3)!,
      "작가",
    ),
  ).toEqual({ value: "[[작가]] 뒤", caret: 6 });
});
it("S23 bounds visible suggestions after filtering, keeping later matching notes discoverable", () => {
  const titles = Array.from({ length: 50 }, (_, index) => `note ${index}`);
  expect(propertyNoteTitles(titles, "")).toHaveLength(20);
  expect(propertyNoteTitles(titles, "49")).toEqual(["note 49"]);
});
