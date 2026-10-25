import { expect, it } from "vitest";
import { notePreview } from "../../src/domain/note-preview";
it("S28 projects bounded safe local text, omits only closed metadata and distinguishes empty content", () => {
  expect(
    notePreview("작가", "---\ntype: Person\n---\n한 사람의 기록\n둘째 줄"),
  ).toEqual({ title: "작가", excerpt: "한 사람의 기록 둘째 줄" });
  expect(notePreview("빈 노트", "---\ntype: Thing\n---\n").excerpt).toBe("");
  expect(notePreview("불완전", "---\n닫지 않은 원문").excerpt).toContain(
    "닫지 않은 원문",
  );
  expect(notePreview("<img>", "<script>alert(1)</script>").excerpt).toBe(
    "<script>alert(1)</script>",
  );
  expect(
    Array.from(notePreview("긴 노트", "한".repeat(500)).excerpt).length,
  ).toBeLessThanOrEqual(241);
});
