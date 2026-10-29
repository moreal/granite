import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "./solid-render";
import { EditorView } from "@codemirror/view";
import { Editor } from "../../src/editor/Editor";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
function setup(value = "", onOpen = () => {}) {
  render(Editor, {
    value: value,
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: onOpen,
    onSelection: () => {},
  });
  const box = screen.getByRole("textbox", { name: "노트 본문" });
  const view = EditorView.findFromDOM(box)!;
  return { box, view };
}
it("offers URL paste choices and preserves selected text as alias", async () => {
  const { box, view } = setup("selected words");
  act(() => view.dispatch({ selection: { anchor: 0, head: 14 } }));
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.com/" },
  });
  expect(screen.getByRole("group", { name: "붙여넣은 링크" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "별칭 달기" }));
  expect(view.state.doc.toString()).toBe(
    "[selected words](https://example.com/)",
  );
});
it.each(["Escape", "닫기"])(
  "preserves URL after %s cancels a pending title fetch",
  async (action) => {
    let finish!: (r: unknown) => void;
    vi.stubGlobal("fetch", () => new Promise((r) => (finish = r)));
    const { box, view } = setup();
    fireEvent.paste(box, {
      clipboardData: { getData: () => "https://example.com/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "제목 가져오기" }));
    if (action === "Escape") fireEvent.keyDown(box, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: /닫기/ }));
    await act(async () => {
      finish({ ok: true, text: async () => "<title>Fetched title</title>" });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(view.state.doc.toString()).toBe("https://example.com/");
    expect(screen.queryByRole("group", { name: "붙여넣은 링크" })).toBeNull();
  },
);
it("keeps multiline Markdown links editable without crashing live preview", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const { view } = setup("[first\nsecond](https://example.com)\n\nend");
  act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
  expect(
    errors.mock.calls
      .flat()
      .some((x) => String(x).includes("CodeMirror plugin crashed")),
  ).toBe(false);
  expect(view.state.doc.toString()).toContain("[first\nsecond]");
});
// S04 / writing-focus 1: link reveal follows the whole node, not its line.
it("reveals only the link intersecting the selection, including both boundaries", () => {
  const text = "앞 [[하나]] 중간 [둘](https://example.com) 뒤";
  const { box, view } = setup(text);
  const labels = () =>
    [...box.querySelectorAll(".cm-note-link")].map((el) => el.textContent);
  expect(labels()).toEqual(["하나", "둘"]);
  for (const anchor of [2, 4, 8]) {
    act(() => view.dispatch({ selection: { anchor } }));
    expect(labels()).toEqual(["둘"]);
    expect(box.textContent).toContain("[[하나]]");
  }
  act(() => view.dispatch({ selection: { anchor: 9 } }));
  expect(labels()).toEqual(["하나", "둘"]);
  act(() => view.dispatch({ selection: { anchor: 0, head: 4 } }));
  expect(labels()).toEqual(["둘"]);
  for (const anchor of [12, 14, 36]) {
    act(() => view.dispatch({ selection: { anchor } }));
    expect(labels()).toEqual(["하나"]);
    expect(box.textContent).toContain("[둘](https://example.com)");
  }
  expect(view.state.doc.toString()).toBe(text);
});
// S04/S06 / writing-focus 2–3: labels stay editable, navigation requires a modifier.
it("renders editable labels and navigates safe links only with Cmd/Ctrl click", () => {
  const onOpen = vi.fn();
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const { box, view } = setup(
    "앞 [[노트]] [출처](https://example.com) [위험](javascript:alert) 뒤",
    onOpen,
  );
  const note = box.querySelector<HTMLElement>(".cm-note-link")!;
  expect(note.tagName).toBe("SPAN");
  fireEvent.click(note);
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.click(note, { ctrlKey: true });
  expect(onOpen).toHaveBeenCalledWith("노트");
  fireEvent.click(box.querySelectorAll(".cm-note-link")[1], { metaKey: true });
  expect(open).toHaveBeenCalledWith(
    "https://example.com/",
    "_blank",
    "noopener,noreferrer",
  );
  expect(box.querySelectorAll(".cm-note-link")).toHaveLength(2);
  expect(view.state.doc.toString()).toContain("[위험](javascript:alert)");
});
it("leaves code links and multiline links as source without navigation targets", () => {
  const text =
    "앞 `[[코드]] [코드](https://example.com)`\n\n```md\n[[블록]] [블록](https://example.com)\n```\n\n[여러\n줄](https://example.com)\n\n끝";
  const { box, view } = setup(text);
  act(() => view.dispatch({ selection: { anchor: text.length } }));
  expect(box.querySelectorAll(".cm-note-link")).toHaveLength(0);
  expect(view.state.doc.toString()).toBe(text);
});
it("shows escaped link labels without changing their persisted source", () => {
  const text = "앞 [[대괄호\\[제목\\]]] [별칭\\]](https://example.com) 뒤";
  const { box, view } = setup(text);
  const labels = [...box.querySelectorAll(".cm-note-link")].map(
    (el) => el.textContent,
  );
  expect(labels).toEqual(["대괄호[제목]", "별칭]"]);
  expect(view.state.doc.toString()).toBe(text);
});
it("S04/S12: reports user document edits but not value synchronization or selection", () => {
  const onUserEdit = vi.fn();
  const props = {
    value: "initial",
    source: true,
    locked: false,
    titles: [],
    onChange: vi.fn(),
    onOpen: vi.fn(),
    onSelection: vi.fn(),
    onUserEdit,
  };
  const rendered = render(Editor, {
    ...props,
  });
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "노트 본문" }),
  )!;
  rendered.rerender({
    ...props,
    value: "loaded externally",
  });
  act(() => view.dispatch({ selection: { anchor: 2 } }));
  expect(onUserEdit).not.toHaveBeenCalled();
  for (const userEvent of [
    "input.type",
    "input.type.compose",
    "delete.backward",
    "undo",
    "redo",
    "input.paste",
  ]) {
    act(() => view.dispatch({ changes: { from: 0, insert: "가" }, userEvent }));
  }
  expect(onUserEdit).toHaveBeenCalledTimes(6);
});
it("S06/S07/S12: completion is an explicit command rather than ordinary typing", () => {
  const onUserEdit = vi.fn();
  const onCommand = vi.fn();
  render(Editor, {
    value: "[[덤",
    source: true,
    locked: false,
    titles: [],
    onChange: () => {},
    onSelection: () => {},
    onOpen: () => {},
    onUserEdit: onUserEdit,
    onCommand: onCommand,
  });
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "노트 본문" }),
  )!;
  act(() =>
    view.dispatch({
      changes: { from: 0, to: 3, insert: "[[덤프]]" },
      userEvent: "input.complete",
    }),
  );
  expect(onCommand).toHaveBeenCalledTimes(1);
  expect(onUserEdit).not.toHaveBeenCalled();
  act(() =>
    view.dispatch({
      changes: { from: 6, insert: " 계속" },
      userEvent: "input.type",
    }),
  );
  expect(onUserEdit).toHaveBeenCalledTimes(1);
});
it("S08/S19 keyboard paste choices wrap and alias leaves the caret inside empty brackets", () => {
  const { box, view } = setup();
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.com/" },
  });
  fireEvent.keyDown(box, { key: "ArrowUp" });
  expect(
    screen
      .getByRole("button", { name: "제목 가져오기" })
      .getAttribute("data-active"),
  ).toBe("true");
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(view.state.doc.toString()).toBe("[](https://example.com/)");
  expect(view.state.selection.main.head).toBe(1);
});
it("S08/S19 caret movement closes URL choices and IME Enter does not select", () => {
  const { box, view } = setup();
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.com/" },
  });
  fireEvent.keyDown(box, { key: "Enter", isComposing: true });
  expect(view.state.doc.toString()).not.toContain("[](");
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.org/" },
  });
  act(() => view.dispatch({ selection: { anchor: 0 } }));
  expect(screen.queryByRole("group", { name: "붙여넣은 링크" })).toBeNull();
});
it.each([
  "https://example.com/ text",
  "https://example.com/\nhttps://example.org/",
])("S08/S19 mixed clipboard text does not offer URL choices: %s", (text) => {
  const { box } = setup();
  fireEvent.paste(box, { clipboardData: { getData: () => text } });
  expect(screen.queryByRole("group", { name: "붙여넣은 링크" })).toBeNull();
});
it("S08 menu-focused Escape dismisses and returns to the editor", () => {
  const { box } = setup();
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.com/" },
  });
  const button = screen.getByRole("button", { name: "별칭 달기" });
  act(() => button.focus());
  expect(document.activeElement).toBe(button);
  expect(button.isConnected).toBe(true);
  fireEvent.keyDown(button, { key: "ArrowDown" });
  const next = screen.getByRole("button", { name: "제목 가져오기" });
  expect(document.activeElement).toBe(next);
  fireEvent.keyDown(next, { key: "ArrowUp" });
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(button, { key: "Escape" });
  expect(screen.queryByRole("group", { name: "붙여넣은 링크" })).toBeNull();
  expect(document.activeElement).toBe(box);
});
it("S08 title retrieval prefers normalized OG title and escapes remote Markdown", async () => {
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    text: async () =>
      '<title>Fallback</title><meta property="og:title" content="  A   [title] &amp; *text*  ">',
  }));
  const { box, view } = setup();
  fireEvent.paste(box, {
    clipboardData: { getData: () => "https://example.com/" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "제목 가져오기" }));
  });
  expect(view.state.doc.toString()).toBe(
    "[A \\[title\\] & \\*text\\*](https://example.com/)",
  );
});
it.each(["## 제목  안쪽 공백", "###\t\t제목", "  ##   제목", "## 제목 ##  "])(
  "S30c retains dim heading syntax and exact spacing: %s",
  (heading) => {
    const value = `${heading}\n\n끝`;
    const { box, view } = setup(value);
    act(() => view.dispatch({ selection: { anchor: value.length } }));
    expect(box.querySelector(".cm-heading")?.textContent).toBe(heading);
    expect(box.querySelector(".cm-heading .cm-md-mark")?.textContent).toMatch(
      /^#+$/,
    );
    expect(view.state.doc.toString()).toBe(value);
    act(() =>
      view.dispatch({ selection: { anchor: heading.indexOf("제목") } }),
    );
    expect(box.querySelector(".cm-heading")?.textContent).toBe(heading);
    expect(view.state.doc.toString()).toBe(value);
  },
);
it("S04 leaves escaped hashes and code spacing intact", () => {
  const value =
    "\\##   평문\n\n    ##   들여쓴 코드\n\n```md\n##   코드\n```\n\n끝";
  const { box, view } = setup(value);
  act(() => view.dispatch({ selection: { anchor: value.length } }));
  expect(box.querySelectorAll(".cm-heading")).toHaveLength(0);
  expect(box.textContent).toContain("##   평문");
  expect(box.textContent).toContain("    ##   들여쓴 코드");
  expect(box.textContent).toContain("##   코드");
  expect(view.state.doc.toString()).toBe(value);
});
it("S17 hides valid frontmatter and reveals before a destructive boundary edit", () => {
  const value = "---\ntitle: secret\n---\nBody";
  const { box, view } = setup(value);
  const start = value.indexOf("Body");
  expect(view.state.selection.main.head).toBe(start);
  expect(box.textContent).not.toContain("secret");
  act(() =>
    view.dispatch({
      changes: { from: start - 1, to: start },
      userEvent: "delete.backward",
    }),
  );
  expect(view.state.doc.toString()).toBe(value);
  expect(box.textContent).toContain("secret");
});
it("S04 styles inactive nested and lazy quote lines without styling escaped markers", () => {
  const { box, view } = setup(
    "> quote\n> > nested\nlazy continuation\n\n\\> escaped\n\nlast",
  );
  act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
  expect(box.querySelectorAll(".cm-blockquote").length).toBe(3);
  expect(box.querySelector(".cm-blockquote")?.textContent).toBe("> quote");
  expect(
    box
      .querySelectorAll<HTMLElement>(".cm-blockquote")[1]
      .style.getPropertyValue("--quote-depth"),
  ).toBe("2");
  expect(box.textContent).toContain("\\> escaped");
});
it.each(["---\n---\n", "---\ntitle: secret\n---\n"])(
  "S17 metadata-only %j retains an editable body position and protects its bytes",
  (value) => {
    const { box, view } = setup(value);
    expect(view.state.selection.main.head).toBe(value.length);
    expect(box.textContent).not.toContain("secret");
    act(() =>
      view.dispatch({
        changes: { from: value.length, insert: "Body" },
        userEvent: "input",
      }),
    );
    expect(view.state.doc.toString()).toBe(value + "Body");
  },
);
it("S17 select-all reveals metadata and allows an intentional edit with undo", async () => {
  const { undo } = await import("@codemirror/commands");
  const value = "---\ntitle: secret\n---\nBody";
  const { box, view } = setup(value);
  act(() => view.dispatch({ selection: { anchor: 0, head: value.length } }));
  expect(box.textContent).toContain("secret");
  act(() =>
    view.dispatch({
      changes: { from: 0, to: value.length, insert: "new" },
      userEvent: "input",
    }),
  );
  act(() => {
    undo(view);
  });
  expect(view.state.doc.toString()).toBe(value);
});
it.each(["---\ntitle: [bad\n---\nBody", "---\ntitle: secret\nBody"])(
  "S17 malformed metadata %j stays visible",
  (value) => {
    const { box } = setup(value);
    expect(box.textContent).toContain("title:");
  },
);
it("S17 editing CRLF prose preserves original line separators", () => {
  const value = "---\r\ntitle: secret\r\n---\r\nBody";
  const onChange = vi.fn();
  render(Editor, {
    value: value,
    source: false,
    locked: false,
    titles: [],
    onChange: onChange,
    onOpen: () => {},
    onSelection: () => {},
  });
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "노트 본문" }),
  )!;
  expect(view.state.selection.main.head).toBe(view.state.doc.length - 4);
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "!" },
      userEvent: "input",
    }),
  );
  expect(onChange).toHaveBeenLastCalledWith(value + "!");
});
it("S20 a registered live extension adds presentation without host changes", async () => {
  const { Decoration, ViewPlugin } = await import("@codemirror/view");
  const { builtinPlugins } = await import("../../src/editor/plugins/builtins");
  render(Editor, {
    value: "Hello",
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
    plugins: [
      ...builtinPlugins,
      {
        id: "example.format",
        liveExtensions: () =>
          ViewPlugin.fromClass(
            class {
              decorations = Decoration.set([
                Decoration.mark({ class: "example-format" }).range(0, 5),
              ]);
            },
            { decorations: (plugin) => plugin.decorations },
          ),
      },
    ],
  });
  expect(
    screen
      .getByRole("textbox", { name: "노트 본문" })
      .querySelector(".example-format")?.textContent,
  ).toBe("Hello");
});
it("S17 metadata-only document without final newline creates prose after the closing fence", () => {
  const value = "---\ntitle: secret\n---";
  const { view } = setup(value);
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "Body" },
      selection: { anchor: view.state.doc.length + 4 },
      userEvent: "input",
    }),
  );
  expect(view.state.doc.toString()).toBe(value + "\nBody");
  expect(view.state.selection.main.head).toBe(value.length + 5);
});
it("S17 trusted property synchronization preserves a body caret and undo history", async () => {
  const { undo, redo } = await import("@codemirror/commands");
  const initial = "---\ntitle: first\n---\nBody";
  const updated = initial.replace("first", "longer value");
  const props = {
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
  };
  const { rerender } = render(Editor, {
    ...props,
    value: initial,
  });
  const box = screen.getByRole("textbox", { name: "노트 본문" });
  const view = EditorView.findFromDOM(box)!;
  act(() =>
    view.dispatch({ selection: { anchor: view.state.doc.length - 2 } }),
  );
  rerender({
    ...props,
    value: updated,
  });
  expect(view.state.doc.toString()).toBe(updated);
  expect(view.state.selection.main.head).toBe(updated.length - 2);
  act(() => {
    undo(view);
  });
  expect(view.state.doc.toString()).toBe(initial);
  expect(box.textContent).toContain("first");
  act(() => {
    redo(view);
  });
  expect(view.state.doc.toString()).toBe(updated);
});
it("S17 CRLF property line additions preserve logical lines, bytes, caret and history", async () => {
  const { undo, redo } = await import("@codemirror/commands");
  const initial = "---\r\ntype: Book\r\n---\r\nBody";
  const updated = "---\r\ntype: Book\r\nauthor: Person\r\n---\r\nBody";
  const onChange = vi.fn();
  const props = {
    source: false,
    locked: false,
    titles: [],
    onChange,
    onOpen: () => {},
    onSelection: () => {},
  };
  const { rerender } = render(Editor, {
    ...props,
    value: initial,
  });
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "노트 본문" }),
  )!;
  act(() =>
    view.dispatch({ selection: { anchor: view.state.doc.length - 2 } }),
  );
  rerender({
    ...props,
    value: updated,
  });
  expect(view.state.sliceDoc()).toBe(updated);
  expect(view.state.doc.lines).toBe(5);
  expect(view.state.doc.line(3).text).toBe("author: Person");
  expect(view.state.selection.main.head).toBe(view.state.doc.length - 2);
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    undo(view);
  });
  expect(view.state.sliceDoc()).toBe(initial);
  expect(view.state.doc.lines).toBe(4);
  expect(onChange).toHaveBeenLastCalledWith(initial);
  act(() => {
    redo(view);
  });
  expect(view.state.sliceDoc()).toBe(updated);
  expect(view.state.doc.lines).toBe(5);
  expect(onChange).toHaveBeenLastCalledWith(updated);
});
it("S17 CRLF metadata-only body insertion creates a logical CRLF line", () => {
  const value = "---\r\ntitle: secret\r\n---";
  const { view } = setup(value);
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "Body" },
      userEvent: "input",
    }),
  );
  expect(view.state.sliceDoc()).toBe(value + "\r\nBody");
  expect(view.state.doc.lines).toBe(4);
  expect(view.state.doc.line(4).text).toBe("Body");
});
it("S04/S17 YAML literal fences cannot swallow body Markdown syntax", () => {
  const value = "---\nexample: |\n  ```\n---\n# Heading\n\n> quote\n\nBody";
  const { box, view } = setup(value);
  act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
  expect(box.querySelector(".cm-heading")?.textContent).toBe("# Heading");
  expect(box.querySelector(".cm-blockquote")?.textContent).toBe("> quote");
  expect(box.textContent).not.toContain("example:");
});
