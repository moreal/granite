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
  expect(screen.getByRole("dialog", { name: "붙여넣은 링크" })).toBeTruthy();
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
    expect(screen.queryByRole("dialog", { name: "붙여넣은 링크" })).toBeNull();
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
