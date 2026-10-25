import { afterEach, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { cleanup, render, screen, fireEvent } from "./solid-render";
import { PropertyValueInput } from "../../src/components/properties/PropertyValueInput";
afterEach(cleanup);
function setup(initial = "", linkable = true) {
  const commit = vi.fn();
  const cancel = vi.fn();
  const view = render(() => {
    const [value, setValue] = createSignal(initial);
    return (
      <PropertyValueInput
        label="author 값"
        value={value()}
        titles={["작가", "다른 작가"]}
        linkable={linkable}
        onChange={setValue}
        onCommit={commit}
        onCancel={cancel}
      />
    );
  }, {});
  const input = screen.getByLabelText("author 값") as HTMLInputElement;
  expect(
    screen.getByRole(linkable ? "combobox" : "textbox", { name: "author 값" }),
  ).toBe(input);
  input.focus();
  const type = (value: string, caret = value.length) =>
    fireEvent.input(input, {
      target: { value, selectionStart: caret, selectionEnd: caret },
    });
  return { input, type, commit, cancel, view };
}
it("S23 first Escape dismisses suggestions; second cancels the retained draft", () => {
  const { input, type, cancel } = setup();
  type("@작");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(input.value).toBe("@작");
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(cancel).toHaveBeenCalledOnce();
});
it("S23 mouse selection preserves focus and completes [[ without duplicate closing delimiters", () => {
  const { input, type, commit } = setup();
  type("앞 [[작]] 뒤", 5);
  const option = screen.getByRole("option", { name: "작가" });
  expect(fireEvent.mouseDown(option)).toBe(false);
  fireEvent.click(option);
  expect(input.value).toBe("앞 [[작가]] 뒤");
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(8);
  expect(commit).not.toHaveBeenCalled();
});
it("S23 CmdS commits literal draft and never accepts highlighted suggestions", () => {
  const { input, type, commit } = setup();
  type("@작");
  fireEvent.keyDown(input, { key: "s", ctrlKey: true });
  expect(input.value).toBe("@작");
  expect(commit).toHaveBeenCalledOnce();
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("S23 email and non-string scalars do not suggest; unmatched text remains committable", () => {
  const { input, type, commit } = setup();
  type("mail@example");
  expect(screen.queryByRole("listbox")).toBeNull();
  type("[[없는 노트");
  expect(screen.getByRole("status").textContent).toContain(
    "일치하는 노트가 없습니다",
  );
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.queryByRole("option")).toBeNull();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(commit).toHaveBeenCalledOnce();
  expect(input.value).toBe("[[없는 노트");
  cleanup();
  const numeric = setup("2", false);
  numeric.type("@작");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("S23 composing events do not select, commit, cancel or reopen a menu", () => {
  const { input, type, commit, cancel } = setup();
  type("@작");
  fireEvent.compositionStart(input);
  expect(screen.queryByRole("listbox")).toBeNull();
  type("@작가");
  for (const key of ["Enter", "Escape", "s"])
    fireEvent.keyDown(input, { key, ctrlKey: key === "s" });
  expect(commit).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
  expect(commit).not.toHaveBeenCalled();
  expect(input.value).toBe("@작가");
});
it("S23 stale mouse/keyboard options cannot replace a moved caret or range", () => {
  const { input, type, commit } = setup();
  type("앞 @작 뒤", 4);
  const old = screen.getByRole("option", { name: "작가" });
  input.setSelectionRange(0, 0);
  fireEvent.click(old);
  expect(input.value).toBe("앞 @작 뒤");
  expect(screen.queryByRole("listbox")).toBeNull();
  type("@작");
  input.setSelectionRange(0, 1);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe("@작");
  expect(commit).not.toHaveBeenCalled();
});
it("S23 source/document changes hide an old popup and refuse its detached option", () => {
  let changed = "";
  const props = {
    label: "author 값",
    value: "@작",
    titles: ["작가"],
    linkable: true,
    contextKey: "one",
    onChange: (value: string) => {
      changed = value;
    },
    onCommit: vi.fn(),
    onCancel: vi.fn(),
  };
  const view = render(PropertyValueInput, props);
  const input = screen.getByLabelText("author 값") as HTMLInputElement;
  input.setSelectionRange(2, 2);
  fireEvent.click(input);
  const option = screen.getByRole("option");
  view.rerender({ ...props, contextKey: "two" });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(option);
  expect(changed).toBe("");
  expect(input.value).toBe("@작");
  view.rerender(props);
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("S24 bounds rendered typed recommendations after ranking and refinement finds known mismatches", async () => {
  const { noteReference } = await import("../../src/schema/references");
  const references = [
    ...Array.from({ length: 24 }, (_, i) =>
      noteReference(`대상 작가 ${i}`, "---\ntype: Person\n---\n"),
    ),
    noteReference("대상 책", "---\ntype: Book\n---\n"),
  ];
  render(() => {
    const [value, setValue] = createSignal("");
    return (
      <PropertyValueInput
        label="author 값"
        value={value()}
        titles={references.map((note) => note.title)}
        references={references}
        property="author"
        linkable
        onChange={setValue}
        onCommit={() => {}}
        onCancel={() => {}}
      />
    );
  }, {});
  const input = screen.getByLabelText("author 값") as HTMLInputElement;
  fireEvent.input(input, {
    target: { value: "@대상", selectionStart: 3, selectionEnd: 3 },
  });
  expect(screen.getAllByRole("option")).toHaveLength(20);
  expect(screen.getByText(/처음 20개/)).toBeTruthy();
  fireEvent.input(input, {
    target: { value: "@책", selectionStart: 2, selectionEnd: 2 },
  });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option").textContent).toContain(
    "Book · 권장 유형과 다름",
  );
});
