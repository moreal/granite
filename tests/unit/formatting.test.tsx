import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import { Editor, type EditorHandle } from "../../src/editor/Editor";
import { noteMarkdownLanguage } from "../../src/domain/markdown";
import { previewLinks } from "../../src/editor/live-preview";
import {
  formatBody,
  preserveFormatting,
  runHongdown,
  FORMAT_TIMEOUT,
} from "../../src/editor/formatting/hongdown";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
Object.defineProperty(Range.prototype, "getClientRects", {
  value: () => [],
  configurable: true,
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  value: () => new DOMRect(),
  configurable: true,
});
it("S20 preserves exact CRLF metadata and rejects invalid metadata and semantic changes", () => {
  const prefix = '--- \r\nname: "[[속성]]"\r\n---\r\n';
  expect(preserveFormatting(prefix + "body", "body\n")).toBe(
    prefix + "body\r\n",
  );
  for (const text of [
    "---\nbad: [\n---\nbody",
    "---\na: b",
    "x".repeat(1024 * 1024 + 1),
  ])
    expect(() => formatBody(text)).toThrow();
  for (const text of [
    "[[A\\[B\\]C]]",
    "![](assets/test.png)",
    "$x+1$",
    "```mermaid\ngraph TD\n A-->B\n```",
  ])
    expect(() => preserveFormatting(text, "removed")).toThrow();
  expect(preserveFormatting("\\[[literal]]", "\\[[literal]]\n")).toBe(
    "\\[[literal]]\n",
  );
});
it("S20 references resolve full/collapsed/shortcut case-insensitively without code/wiki/metadata URLs", () => {
  const text =
    '---\nurl: "[bad]: https://bad.test"\n---\n[Full][ID] [id][] [ID] [[id]] [unsafe]\n\n[Id]: https://example.com\n[unsafe]: javascript:alert(1)\n\n`[ID]`';
  const links = previewLinks(
    EditorState.create({ doc: text, extensions: [noteMarkdownLanguage] }),
  );
  expect(links.filter((l) => l.external).map((l) => l.target)).toEqual(
    Array(3).fill("https://example.com"),
  );
  expect(links.filter((l) => !l.external).map((l) => l.target)).toEqual(["id"]);
});
function setup(
  format: (s: string, c: { signal: AbortSignal }) => Promise<string>,
) {
  const ref = createRef<EditorHandle>(),
    onChange = vi.fn();
  const props = {
    ref,
    value: "original",
    source: true,
    locked: false,
    documentKey: "one",
    titles: [],
    onChange,
    onSelection: () => {},
    onOpen: () => {},
    plugins: [
      {
        id: "test",
        formatters: [{ id: "test.format", label: "Test format", format }],
      },
    ],
  };
  const rendered = render(<Editor {...props} />);
  const box = screen.getByRole("textbox", { name: "노트 본문" }),
    view = EditorView.findFromDOM(box)!;
  return { ref, props, rendered, box, view, onChange };
}
it("S20 formatter review applies only on confirmation in one undo unit", async () => {
  const { ref, view, onChange } = setup(async () => "formatted");
  await act(async () => ref.current!.requestFormatting("test.format"));
  expect(view.state.sliceDoc()).toBe("original");
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(view.state.sliceDoc()).toBe("formatted");
  expect(onChange).toHaveBeenLastCalledWith("formatted");
  act(() => {
    undo(view);
  });
  expect(view.state.sliceDoc()).toBe("original");
});
it.each(["edit", "key", "lock", "composition", "cancel"])(
  "S20 discards pending result after %s",
  async (action) => {
    let resolve!: (s: string) => void;
    let signal!: AbortSignal;
    const s = setup((_text, context) => {
      signal = context.signal;
      return new Promise((r) => (resolve = r));
    });
    act(() => s.ref.current!.requestFormatting());
    if (action === "edit")
      act(() => s.view.dispatch({ changes: { from: 0, insert: "new " } }));
    if (action === "key" || action === "lock")
      s.rendered.rerender(
        <Editor
          {...s.props}
          documentKey={action === "key" ? "two" : "one"}
          locked={action === "lock"}
        />,
      );
    if (action === "composition") fireEvent.compositionStart(s.box);
    if (action === "cancel")
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await act(async () => resolve("stale"));
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(s.view.state.sliceDoc()).not.toBe("stale");
  },
);
it.each(["same", "error"])("S20 %s does not write", async (kind) => {
  const s = setup(async (text) => {
    if (kind === "error") throw Error("format failed");
    return text;
  });
  await act(async () => s.ref.current!.requestFormatting());
  expect(s.onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain(
    kind === "same" ? "변경 사항" : "format failed",
  );
});
it("S20 edit while reviewing invalidates apply", async () => {
  const s = setup(async () => "formatted");
  await act(async () => s.ref.current!.requestFormatting());
  act(() => s.view.dispatch({ changes: { from: 0, insert: "new " } }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(s.view.state.sliceDoc()).toBe("new original");
});
it("S20 worker timeout and abort terminate computation", async () => {
  vi.useFakeTimers();
  const terminate = vi.fn();
  vi.stubGlobal(
    "Worker",
    class {
      terminate = terminate;
      postMessage() {}
    },
  );
  const controller = new AbortController();
  const result = runHongdown("text", controller.signal);
  const assertion = expect(result).rejects.toThrow("시간");
  await vi.advanceTimersByTimeAsync(FORMAT_TIMEOUT);
  await assertion;
  expect(terminate).toHaveBeenCalledTimes(1);
  const cancelled = runHongdown("text", controller.signal);
  controller.abort();
  await expect(cancelled).rejects.toThrow("Cancelled");
  expect(terminate).toHaveBeenCalledTimes(2);
});
it("S20 reference labels remain editable and modifier navigation opens only safe URL", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const text = "앞 [출처][ref] 뒤\n\n[ref]: https://example.com\n\nend";
  render(
    <Editor
      value={text}
      source={false}
      locked={false}
      titles={[]}
      onChange={() => {}}
      onOpen={() => {}}
      onSelection={() => {}}
    />,
  );
  const box = screen.getByRole("textbox", { name: "노트 본문" }),
    view = EditorView.findFromDOM(box)!;
  const label = box.querySelector<HTMLElement>(".cm-note-link")!;
  expect(label.textContent).toBe("출처");
  fireEvent.click(label);
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(label, { ctrlKey: true });
  expect(open).toHaveBeenCalledWith(
    "https://example.com/",
    "_blank",
    "noopener,noreferrer",
  );
  act(() => view.dispatch({ selection: { anchor: 5 } }));
  expect(box.textContent).toContain("[출처][ref]");
  expect(view.state.sliceDoc()).toBe(text);
  open.mockRestore();
});
it("S20 preview traps Tab, Escape cancels, and restores invoking focus", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const s = setup(async () => "formatted");
  trigger.focus();
  await act(async () => s.ref.current!.requestFormatting());
  const first = screen.getByRole("textbox", { name: "정리 전 원문" }),
    last = screen.getByRole("button", { name: "적용" });
  expect(document.activeElement).toBe(first);
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
