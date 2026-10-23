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
function setup(value = "") {
  render(
    <Editor
      value={value}
      source={false}
      locked={false}
      titles={[]}
      onChange={() => {}}
      onOpen={() => {}}
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
