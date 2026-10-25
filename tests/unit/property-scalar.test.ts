import { expect, it } from "vitest";
import {
  patchPropertyScalar,
  readFrontmatter,
} from "../../src/domain/frontmatter";
it("S21 patches only AST scalar token, retaining CRLF, comments, unknown keys and prose", () => {
  const body =
    "---\r\n# comment\r\nname: old # tail\r\nunknown: [x, y]\r\n---\r\nprose";
  expect(patchPropertyScalar(body, "name", "한글 # : 새 값")).toEqual({
    body: body.replace("old # tail", '"한글 # : 새 값" # tail'),
    error: null,
  });
});
it.each([
  ["2", "3", "3"],
  ["true", "false", "false"],
  ["null", "null", "null"],
  ['"2"', "03", '"03"'],
])("S21 preserves scalar type %s", (original, input, expected) => {
  expect(
    patchPropertyScalar(`---\nx: ${original}\n---\nbody`, "x", input).body,
  ).toBe(`---\nx: ${expected}\n---\nbody`);
});
it.each([
  ["2", "no"],
  ["true", "yes"],
  ["null", "empty"],
  ["[x, y]", "flat"],
  ["{x: y}", "flat"],
  ["|\n  multiline", "flat"],
  ["&anchor value", "new"],
])("S21 rejects unsafe or mistyped scalar %s", (original, input) => {
  expect(
    patchPropertyScalar(`---\nx: ${original}\n---\nbody`, "x", input).body,
  ).toBeUndefined();
});

it.each([
  ["x:", "x: null"],
  ["x: # keep", "x: null # keep"],
  ["x:  # keep", "x:  null # keep"],
])(
  "S21 implicit null token preserves key and comment separation %s",
  (yaml, expected) => {
    const body = `---\r\n${yaml}\r\nother: unknown\r\n---\r\nprose`;
    const result = patchPropertyScalar(body, "x", "null");
    expect(result).toEqual({
      body: `---\r\n${expected}\r\nother: unknown\r\n---\r\nprose`,
      error: null,
    });
    expect(readFrontmatter(result.body!).properties.get("x")).toBe(null);
  },
);
