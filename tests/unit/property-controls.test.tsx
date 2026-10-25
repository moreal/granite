import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "./solid-render";
import { PropertyPicker } from "../../src/components/properties/PropertyPicker";
import { NoteProperties } from "../../src/components/NoteProperties";
import { YamlEditor } from "../../src/components/properties/YamlEditor";
afterEach(cleanup);
it("S21 offers union properties and suppresses duplicates; keyboard and IME are distinct", () => {
  const select = vi.fn();
  render(PropertyPicker, {
    value: "birth",
    types: ["Book", "Person"],
    existingKeys: ["author"],
    onChange: vi.fn(),
    onSelect: select,
  });
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(screen.getAllByRole("option")[0].textContent).toContain("birthDate");
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(select).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(select).toHaveBeenCalledWith("birthDate");
  expect(input.getAttribute("aria-expanded")).toBe("false");
});
it("S21 stages values without insertion, commits exact CRLF and cancels", async () => {
  let body = "---\r\n# comment\r\ntype: Book\r\nunknown: x\r\n---\r\nprose";
  const change = vi.fn((next: string) => {
    body = next;
    view.rerender({ body, locked: false, onChange: change });
  });
  const view = render(NoteProperties, {
    body,
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  const picker = screen.getByRole("combobox");
  fireEvent.input(picker, { target: { value: "author" } });
  fireEvent.keyDown(picker, { key: "Enter" });
  await act(async () => await Promise.resolve());
  expect(change).not.toHaveBeenCalled();
  const value = screen.getByLabelText("author 값");
  expect(document.activeElement).toBe(value);
  fireEvent.input(value, { target: { value: "[[새 저자]]" } });
  fireEvent.keyDown(value, { key: "Enter" });
  expect(body).toBe(
    '---\r\n# comment\r\ntype: Book\r\nunknown: x\r\n"author": "[[새 저자]]"\r\n---\r\nprose',
  );
  fireEvent.input(picker, { target: { value: "about" } });
  fireEvent.click(screen.getByRole("button", { name: "속성 넣기" }));
  fireEvent.keyDown(screen.getByLabelText("about 값"), { key: "Escape" });
  expect(change).toHaveBeenCalledTimes(1);
});
it("S21 rejects stale document and source drafts while preserving their values", () => {
  const change = vi.fn();
  const body = "---\ntype: Book\ncount: 2 # keep\n---\nprose";
  const view = render(NoteProperties, {
    body,
    documentKey: "one",
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "count 값 편집" }));
  const input = screen.getByLabelText("count 값");
  fireEvent.input(input, { target: { value: "3" } });
  view.rerender({
    body: body + "changed",
    documentKey: "one",
    locked: false,
    onChange: change,
  });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
  expect((input as HTMLInputElement).value).toBe("3");
  expect(screen.getByRole("alert").textContent).toContain("문서가 변경");
  view.rerender({ body, documentKey: "two", locked: false, onChange: change });
  fireEvent.keyDown(input, { key: "s", ctrlKey: true });
  expect(change).not.toHaveBeenCalled();
});
it("S21 refuses guided insertion into invalid YAML while retaining editable source", () => {
  const change = vi.fn();
  const onSource = vi.fn();
  const view = render(NoteProperties, {
    body: "---\ntype: [broken\n---\nprose",
    locked: false,
    onChange: change,
    onSource,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.input(screen.getByRole("combobox"), {
    target: { value: "author" },
  });
  fireEvent.click(screen.getByRole("button", { name: "속성 넣기" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText("author 값"), { key: "Enter" });
  expect(screen.getAllByRole("alert").length).toBe(2);
  fireEvent.click(
    screen.getByRole("button", { name: "전체 원문에서 복잡한 속성 편집" }),
  );
  expect(onSource).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("속성 YAML 원문")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  view.rerender({
    body: "---\ntype: [broken\n---\nprose",
    locked: false,
    onChange: change,
    mode: "yaml",
  });
  fireEvent.input(screen.getByLabelText("속성 YAML 원문"), {
    target: { value: "type: Book" },
  });
  expect(change).toHaveBeenCalledWith("---\ntype: Book\n---\nprose");
});
it("S21 raw YAML completions use exact ranges, Escape dismisses, disabled guards selection", () => {
  const change = vi.fn();
  render(YamlEditor, { value: "type: Book\nau", onChange: change });
  const input = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  input.setSelectionRange(input.value.length, input.value.length);
  fireEvent.click(input);
  expect(
    screen
      .getAllByRole("option")
      .some((option) => option.textContent?.includes("author")),
  ).toBe(true);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("option")).toBeNull();
  fireEvent.keyDown(input, { key: " ", ctrlKey: true });
  fireEvent.click(screen.getByRole("option", { name: /^author/ }));
  expect(change).toHaveBeenCalledWith("type: Book\nauthor: ");
});
it("S21 completion keeps untouched mixed line endings and custom source text", async () => {
  const { textareaChange } =
    await import("../../src/components/properties/yaml-text");
  expect(
    textareaChange("# keep\r\ntype: Book\nau", "# keep\ntype: Book\nauthor: "),
  ).toBe("# keep\r\ntype: Book\nauthor: ");
});
it("S21 stale popup cannot replace text after caret moves or a range is selected", () => {
  const change = vi.fn();
  render(YamlEditor, { value: "type: Book\nauthor", onChange: change });
  const input = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  input.setSelectionRange(input.value.length, input.value.length);
  fireEvent.click(input);
  const oldOption = screen.getByRole("option", { name: /^author/ });
  input.setSelectionRange(0, 0);
  fireEvent.click(oldOption);
  expect(change).not.toHaveBeenCalled();
  input.setSelectionRange(input.value.length, input.value.length);
  fireEvent.click(input);
  input.setSelectionRange(0, 4);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
});

it("S21 a deleted property or removed frontmatter leaves its stale draft visible and cancellable", () => {
  const change = vi.fn();
  const body = "---\ntype: Book\ncount: 2\n---\nprose";
  const view = render(NoteProperties, {
    body,
    documentKey: "one",
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "count 값 편집" }));
  fireEvent.input(screen.getByLabelText("count 값"), {
    target: { value: "3" },
  });
  for (const changed of ["---\ntype: Book\n---\nprose", "prose"]) {
    view.rerender({
      body: changed,
      documentKey: "one",
      locked: false,
      onChange: change,
    });
    const pending = screen.getByLabelText("count 값") as HTMLInputElement;
    expect(pending.value).toBe("3");
    fireEvent.keyDown(pending, { key: "Enter" });
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("문서가 변경");
  }
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.queryByLabelText("count 값")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("S23 selects local note links without committing and preserves the input across keystrokes", async () => {
  let body = "---\ntype: Book\nauthor: old\n---\nprose";
  const change = vi.fn((next: string) => {
    body = next;
  });
  const view = render(NoteProperties, {
    body,
    documentKey: "one",
    titles: ["작가", "작[가]"],
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "author 값 편집" }));
  await act(async () => await Promise.resolve());
  const input = screen.getByLabelText("author 값") as HTMLInputElement;
  fireEvent.input(input, {
    target: { value: "앞 @작 뒤", selectionStart: 4, selectionEnd: 4 },
  });
  expect(screen.getByLabelText("author 값")).toBe(input);
  expect(screen.getAllByRole("option").map((node) => node.textContent)).toEqual(
    ["작가", "작[가]"],
  );
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe("앞 [[작\\[가\\]]] 뒤");
  expect(change).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(12);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(body).toContain('author: "앞 [[작\\\\[가\\\\]]] 뒤"');
});

it.each([
  ["count", "2"],
  ["enabled", "true"],
  ["empty", "null"],
])(
  "S23 preserves %s scalar type and excludes note suggestions",
  (name, original) => {
    let body = `---\ntype: Book\n${name}: ${original}\n---\nprose`;
    const view = render(NoteProperties, {
      body,
      documentKey: "one",
      titles: ["작가"],
      locked: false,
      onChange: (value) => {
        body = value;
      },
    });
    view.container.querySelector("details")!.open = true;
    fireEvent.click(screen.getByRole("button", { name: `${name} 값 편집` }));
    const input = screen.getByLabelText(`${name} 값`);
    fireEvent.input(input, { target: { value: "@작가" } });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(body).toContain(`${name}: ${original}`);
    expect(screen.getByRole("alert")).toBeTruthy();
  },
);
it("S24 YAML caps matching render after ranking and a refined query finds later mismatches", async () => {
  const { noteReference } = await import("../../src/schema/references");
  const references = [
    ...Array.from({ length: 24 }, (_, i) =>
      noteReference(`대상 작가 ${i}`, "---\ntype: Person\n---\n"),
    ),
    noteReference("대상 책", "---\ntype: Book\n---\n"),
  ];
  const view = render(YamlEditor, {
    value: "author: @대상",
    references,
    onChange: vi.fn(),
  });
  const input = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  input.setSelectionRange(input.value.length, input.value.length);
  fireEvent.click(input);
  expect(screen.getAllByRole("option")).toHaveLength(20);
  expect(screen.getByText(/처음 20개/)).toBeTruthy();
  view.rerender({ value: "author: @책", references, onChange: vi.fn() });
  input.setSelectionRange(input.value.length, input.value.length);
  fireEvent.click(input);
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option").textContent).toContain(
    "Book · 권장 유형과 다름",
  );
});
it("S24 preserves initial type queries across mode/source round trips without creating metadata", () => {
  const change = vi.fn();
  const props = {
    body: "본문",
    documentKey: "initial",
    locked: false,
    onChange: change,
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  expect(
    (screen.getByRole("combobox", { name: "노트 유형" }) as HTMLInputElement)
      .value,
  ).toBe("Thing");
  for (const query of ["Per", "CustomType"]) {
    fireEvent.input(screen.getByRole("combobox", { name: "노트 유형" }), {
      target: { value: query },
    });
    view.rerender({ ...props, mode: "yaml" });
    expect(screen.queryByRole("combobox", { name: "노트 유형" })).toBeNull();
    expect(change).not.toHaveBeenCalled();
    view.rerender({ ...props, mode: "form" });
    expect(
      (screen.getByRole("combobox", { name: "노트 유형" }) as HTMLInputElement)
        .value,
    ).toBe(query);
    view.rerender({ ...props, source: true });
    expect(screen.queryByRole("combobox", { name: "노트 유형" })).toBeNull();
    view.rerender({ ...props, source: false });
    expect(
      (screen.getByRole("combobox", { name: "노트 유형" }) as HTMLInputElement)
        .value,
    ).toBe(query);
  }
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  expect(change).toHaveBeenCalledWith("---\ntype: CustomType\n---\n본문");
});
