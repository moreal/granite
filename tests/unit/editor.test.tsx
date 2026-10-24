import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
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
  render(
    <Editor
      value={value}
      source={false}
      locked={false}
      titles={[]}
      onChange={() => {}}
      onOpen={onOpen}
      onSelection={() => {}}
    />,
  );
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
  const rendered = render(<Editor {...props} />);
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "노트 본문" }),
  )!;
  rendered.rerender(<Editor {...props} value="loaded externally" />);
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
  render(
    <Editor
      value="[[덤"
      source={true}
      locked={false}
      titles={[]}
      onChange={() => {}}
      onSelection={() => {}}
      onOpen={() => {}}
      onUserEdit={onUserEdit}
      onCommand={onCommand}
    />,
  );
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
