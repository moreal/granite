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
it("S21 adds a quoted empty value preserving CRLF and focuses that value", async () => {
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
  const details = view.container.querySelector("details")!;
  details.open = true;
  const picker = screen.getByRole("combobox");
  fireEvent.input(picker, { target: { value: "author" } });
  fireEvent.keyDown(picker, { key: "Enter" });
  await act(async () => await Promise.resolve());
  expect(body).toBe(
    '---\r\n# comment\r\ntype: Book\r\nunknown: x\r\n"author": ""\r\n---\r\nprose',
  );
  const yaml = screen.getByLabelText("속성 YAML 원문") as HTMLTextAreaElement;
  expect(document.activeElement).toBe(yaml);
  // Native textarea normalizes CRLF to LF; selection follows its actual value.
  expect(yaml.value[yaml.selectionStart]).toBe('"');
});
it("S21 refuses guided insertion into invalid YAML while retaining editable source", () => {
  const change = vi.fn();
  const view = render(NoteProperties, {
    body: "---\ntype: [broken\n---\nprose",
    locked: false,
    onChange: change,
  });
  view.container.querySelector("details")!.open = true;
  fireEvent.input(screen.getByRole("combobox"), {
    target: { value: "author" },
  });
  fireEvent.click(screen.getByRole("button", { name: "속성 넣기" }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getAllByRole("alert").length).toBe(2);
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
