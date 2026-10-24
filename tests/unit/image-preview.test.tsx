import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { Editor } from "../../src/editor/Editor";
afterEach(() => {
  cleanup();
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
const path = `assets/${"a".repeat(64)}.png`;
it("S13 releases image URLs on source mode and ignores a destroyed widget's pending read", async () => {
  const createObjectURL = vi.fn(() => "blob:local-image"),
    revokeObjectURL = vi.fn();
  const originalURL = URL;
  class TestURL extends originalURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("URL", TestURL);
  let resolve!: (blob: Blob) => void;
  const props = {
    value: `앞 ![alt](${path}) 뒤`,
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
    readImage: () =>
      new Promise<Blob>((done) => {
        resolve = done;
      }),
  };
  const rendered = render(<Editor {...props} />);
  await act(async () => {
    resolve(new Blob(["image"]));
  });
  expect(screen.getByRole("img").getAttribute("src")).toBe("blob:local-image");
  rendered.rerender(<Editor {...props} source />);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-image");
  rendered.rerender(<Editor {...props} />);
  rendered.unmount();
  await act(async () => {
    resolve(new Blob(["late"]));
  });
  expect(createObjectURL).toHaveBeenCalledTimes(1);
});
it("S14 preserves a widget during composing updates and refreshes at composition end", () => {
  const props = {
    value: "앞 $x$ 뒤",
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
  };
  render(<Editor {...props} />);
  const box = screen.getByRole("textbox"),
    view = EditorView.findFromDOM(box)!;
  const widget = box.querySelector(".cm-rich-math");
  act(() =>
    view.dispatch({
      changes: { from: 0, insert: "가" },
      userEvent: "input.type.compose",
    }),
  );
  expect(box.querySelector(".cm-rich-math")).toBe(widget);
  expect(view.state.doc.toString()).toBe("가앞 $x$ 뒤");
});
