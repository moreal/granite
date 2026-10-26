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
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  let picker = screen.getByRole("combobox");
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
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  picker = screen.getByRole("combobox");
  fireEvent.input(picker, { target: { value: "about" } });
  fireEvent.keyDown(picker, { key: "Enter" });
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
it("S25 unreadable YAML offers source repair without misleading form creation", () => {
  const change = vi.fn(),
    onSource = vi.fn();
  const view = render(NoteProperties, {
    body: "---\ntype: [broken\n---\nprose",
    locked: false,
    onChange: change,
    onSource,
  });
  view.container.querySelector("details")!.open = true;
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("button", { name: "속성 넣기" })).toBeNull();
  expect(view.container.querySelector("summary")!.textContent).toContain(
    "확인 필요",
  );
  expect(view.container.querySelector("summary")!.textContent).not.toContain(
    "Thing",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "전체 원문에서 속성 수정" }),
  );
  expect(onSource).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
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
it("S29 preserves a new type draft across mode/source round trips without creating metadata", async () => {
  const change = vi.fn();
  const props = {
    body: "본문",
    documentKey: "initial",
    locked: false,
    onChange: change,
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  const name = screen.getByRole("combobox", { name: "속성 이름 검색" });
  fireEvent.input(name, { target: { value: "type" } });
  fireEvent.keyDown(name, { key: "Tab" });
  const value = screen.getByLabelText("type 값");
  fireEvent.input(value, { target: { value: "CustomType" } });
  for (const patch of [
    { mode: "yaml" as const },
    { mode: "form" as const },
    { source: true },
    { source: false },
  ]) {
    view.rerender({ ...props, ...patch });
    expect(change).not.toHaveBeenCalled();
  }
  expect((screen.getByLabelText("type 값") as HTMLInputElement).value).toBe(
    "CustomType",
  );
  fireEvent.click(screen.getByRole("button", { name: "추가 / 적용" }));
  expect(change).toHaveBeenCalledWith('---\n"type": "CustomType"\n---\n본문');
});

it("S24d YAML warning and source echoes keep the native textarea value and selection", () => {
  let body = "---\r\nauthor: old # keep\r\nabout: untouched\r\n---\r\n본문";
  const props = {
    body,
    documentKey: "typing",
    locked: false,
    mode: "yaml" as const,
    onChange: (next: string) => {
      body = next;
      view.rerender({ ...props, body });
    },
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  const input = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  const value = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )!;
  const writes = vi.fn((next: string) => value.set!.call(input, next));
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => value.get!.call(input),
    set: writes,
  });
  input.focus();
  for (const [next, start, end, warning] of [
    ["t\nauthor: old # keep\nabout: untouched", 1, 1, true],
    ["type:\nauthor: old # keep\nabout: untouched", 5, 5, false],
    ["type: [\nauthor: old # keep\nabout: untouched", 7, 7, true],
    ["type: Book\nauthor: old # keep\nabout: untouched", 6, 10, false],
  ] as const) {
    value.set!.call(input, next);
    input.setSelectionRange(start, end);
    fireEvent.input(input);
    expect(screen.getByLabelText("속성 YAML 원문")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([start, end]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("확인 필요")).toBeNull();
    expect(writes).not.toHaveBeenCalled();
  }
  expect(body).toBe(
    "---\r\ntype: Book\r\nauthor: old # keep\r\nabout: untouched\r\n---\r\n본문",
  );
  view.rerender({ ...props, body: body + "\r\n本文追加" });
  expect([input.selectionStart, input.selectionEnd]).toEqual([6, 10]);
  expect(writes).not.toHaveBeenCalled();
  view.rerender({
    ...props,
    documentKey: "other",
    body: "---\ntype: Person\n---\n別の本文",
  });
  expect(input.value).toBe("type: Person");
});

it("S25 guards row and new-property switching without losing rejected numeric draft", async () => {
  const change = vi.fn();
  const view = render(NoteProperties, {
    body: "---\ntype: Book\nauthor: old\ncount: 2\n---\nbody",
    documentKey: "one",
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "count 값 편집" }));
  const input = screen.getByLabelText("count 값") as HTMLInputElement;
  fireEvent.input(input, { target: { value: "invalid" } });
  fireEvent.keyDown(input, { key: "Enter" });
  const error = screen.getByRole("alert").textContent;
  fireEvent.click(screen.getByRole("button", { name: "author 값 편집" }));
  expect(screen.getByLabelText("count 값")).toBe(input);
  expect(input.value).toBe("invalid");
  expect(screen.getByRole("alert").textContent).toBe(error);
  expect(screen.getByRole("status").textContent).toContain("적용하거나 취소");
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  expect(input.value).toBe("invalid");
  expect(screen.getByRole("alert").textContent).toBe(error);
  await act(async () => await Promise.resolve());
  expect(screen.getByLabelText("count 값")).toBe(input);
  expect(input.value).toBe("invalid");
  expect(document.activeElement).toBe(input);
  expect(change).not.toHaveBeenCalled();
});
it("S25 apply and cancel return focus to the existing row or new-property picker", async () => {
  let body = "---\ntype: Book\nauthor: old\n---\nbody";
  const props = {
    body,
    documentKey: "one",
    locked: false,
    onChange: (next: string) => {
      body = next;
      view.rerender({ ...props, body });
    },
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "author 값 편집" }));
  fireEvent.input(screen.getByLabelText("author 값"), {
    target: { value: "new" },
  });
  fireEvent.keyDown(screen.getByLabelText("author 값"), { key: "Enter" });
  await act(async () => await Promise.resolve());
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "author 값 편집" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "author 값 편집" }));
  fireEvent.keyDown(screen.getByLabelText("author 값"), { key: "Escape" });
  await act(async () => await Promise.resolve());
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "author 값 편집" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));
  const picker = screen.getByRole("combobox", { name: "속성 이름 검색" });
  fireEvent.input(picker, { target: { value: "custom" } });
  fireEvent.keyDown(picker, { key: "Enter" });
  fireEvent.keyDown(screen.getByLabelText("custom 값"), { key: "Escape" });
  await act(async () => await Promise.resolve());
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "속성 추가" }),
  );
});
it("S25 YAML warnings wait for blur or save, stay discoverable collapsed, and reset on edit", () => {
  let body = "---\ntype: Book\n---\nbody";
  const props = {
    body,
    documentKey: "one",
    mode: "yaml" as const,
    locked: false,
    onChange: (next: string) => {
      body = next;
      view.rerender({ ...props, body });
    },
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  const input = screen.getByLabelText("속성 YAML 원문");
  fireEvent.input(input, { target: { value: "type: [" } });
  expect(screen.queryByText("확인 필요")).toBeNull();
  expect(view.container.querySelector(".property-warning")).toBeNull();
  fireEvent.blur(input);
  expect(
    view.container.querySelector(".property-warning")!.getAttribute("role"),
  ).not.toBe("alert");
  expect(screen.getByText("확인 필요")).toBeTruthy();
  view.container.querySelector("details")!.open = false;
  expect(view.container.querySelector("summary")!.textContent).toContain(
    "확인 필요",
  );
  fireEvent.input(input, { target: { value: "type: [b" } });
  expect(screen.queryByText("확인 필요")).toBeNull();
  fireEvent.keyDown(input, { key: "s", ctrlKey: true });
  expect(screen.getByText("확인 필요")).toBeTruthy();
  fireEvent.input(input, { target: { value: "type: Book" } });
  expect(screen.queryByText("확인 필요")).toBeNull();
  view.rerender({
    ...props,
    body: "---\ntype: [\n---\nbody",
    documentKey: "two",
  });
  expect(screen.getByText("확인 필요")).toBeTruthy();
  view.rerender({
    ...props,
    body: "---\ntype: [\n---\nbody",
    documentKey: "one",
  });
  expect(screen.getByText("확인 필요")).toBeTruthy();
});
it("S25 recognized YAML note misses explain results while unsupported contexts stay quiet", () => {
  const view = render(YamlEditor, {
    value: 'author: "@missing"',
    references: [],
    onChange: vi.fn(),
  });
  const input = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  input.setSelectionRange(17, 17);
  fireEvent.click(input);
  expect(screen.getByRole("status").textContent).toContain(
    "일치하는 기존 노트가 없습니다",
  );
  expect(screen.queryByRole("option")).toBeNull();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("status")).toBeNull();
  view.rerender({
    value: 'nested: {author: "@missing"}',
    references: [],
    onChange: vi.fn(),
  });
  input.setSelectionRange(25, 25);
  fireEvent.click(input);
  expect(screen.queryByRole("status")).toBeNull();
});

it("S25 unreadable source retains prior numeric draft/error/cancel, while a readable type advisory permits custom properties", () => {
  const change = vi.fn();
  const props = {
    body: "---\ntype: Book\ncount: 2\n---\nbody",
    documentKey: "one",
    locked: false,
    onChange: change,
  };
  const view = render(NoteProperties, props);
  view.container.querySelector("details")!.open = true;
  fireEvent.click(screen.getByRole("button", { name: "count 값 편집" }));
  fireEvent.input(screen.getByLabelText("count 값"), {
    target: { value: "not a number" },
  });
  fireEvent.keyDown(screen.getByLabelText("count 값"), { key: "Enter" });
  const error = screen.getByRole("alert").textContent;
  view.rerender({ ...props, body: "---\ntype: [\n---\nbody" });
  expect((screen.getByLabelText("count 값") as HTMLInputElement).value).toBe(
    "not a number",
  );
  expect(screen.getByRole("alert").textContent).toBe(error);
  expect(screen.queryByRole("combobox", { name: "속성 이름 검색" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.queryByLabelText("count 값")).toBeNull();
  view.rerender({ ...props, body: "---\ntype: 2\ncustom: keep\n---\nbody" });
  expect(screen.getByRole("button", { name: "속성 추가" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "custom 값 편집" }));
  expect((screen.getByLabelText("custom 값") as HTMLInputElement).value).toBe(
    "keep",
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.input(screen.getByLabelText("custom 값"), {
    target: { value: "new" },
  });
  fireEvent.keyDown(screen.getByLabelText("custom 값"), { key: "Enter" });
  expect(change).toHaveBeenCalledWith('---\ntype: 2\ncustom: "new"\n---\nbody');
});
