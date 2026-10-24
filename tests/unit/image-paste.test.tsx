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
afterEach(cleanup);
Object.defineProperty(Range.prototype, "getClientRects", {
  value: () => [],
  configurable: true,
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  value: () => new DOMRect(),
  configurable: true,
});
const path = `assets/${"a".repeat(64)}.png`;
function setup() {
  let finish!: (value: string) => void;
  const props = {
    value: "before selected after",
    source: true,
    locked: false,
    documentKey: "A",
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
    onImageStatus: vi.fn(),
    onPasteImage: vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const rendered = render(<Editor {...props} />);
  const box = screen.getByRole("textbox");
  const view = EditorView.findFromDOM(box)!;
  act(() => view.dispatch({ selection: { anchor: 7, head: 15 } }));
  fireEvent.paste(box, {
    clipboardData: {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => new File(["bytes"], "a.png", { type: "image/png" }),
        },
      ],
      getData: () => "https://ignored.test",
    },
  });
  return {
    view,
    props,
    rendered,
    finish: (value = path) =>
      act(async () => {
        finish(value);
        await Promise.resolve();
      }),
  };
}
it("S13 stores before replacing selection and maps an unrelated preceding edit", async () => {
  const { view, finish } = setup();
  expect(view.state.doc.toString()).toBe("before selected after");
  act(() =>
    view.dispatch({
      changes: { from: 0, insert: "new " },
      userEvent: "input.type",
    }),
  );
  await finish();
  expect(view.state.doc.toString()).toBe(`new before ![이미지](${path}) after`);
});
it.each(["edit", "note", "lock", "unmount"])(
  "S13 cancels a late image after %s",
  async (action) => {
    const { view, finish, rendered, props } = setup();
    if (action === "edit")
      act(() =>
        view.dispatch({
          changes: { from: 8, insert: "!" },
          userEvent: "input.type",
        }),
      );
    if (action === "note")
      rendered.rerender(<Editor {...props} documentKey="B" />);
    if (action === "lock") rendered.rerender(<Editor {...props} locked />);
    if (action === "unmount") rendered.unmount();
    await finish();
    expect(view.state.doc.toString()).not.toContain("assets/");
  },
);
it.each([false, true])(
  "S13 waits for all images in order and preserves selection if a later save fails: %s",
  async (fail) => {
    const secondPath = `assets/${"b".repeat(64)}.jpg`;
    let finish!: (value: string) => void, reject!: (error: Error) => void;
    let calls = 0;
    const onPasteImage = async () => {
      calls++;
      if (calls === 1) return path;
      return new Promise<string>((resolve, fail) => {
        finish = resolve;
        reject = fail;
      });
    };
    const onImageStatus = vi.fn();
    render(
      <Editor
        value="keep"
        source
        locked={false}
        titles={[]}
        onChange={() => {}}
        onOpen={() => {}}
        onSelection={() => {}}
        onPasteImage={onPasteImage}
        onImageStatus={onImageStatus}
      />,
    );
    const box = screen.getByRole("textbox"),
      view = EditorView.findFromDOM(box)!;
    act(() => view.dispatch({ selection: { anchor: 0, head: 4 } }));
    await act(async () => {
      fireEvent.paste(box, {
        clipboardData: {
          items: [0, 1].map(() => ({
            kind: "file",
            type: "image/png",
            getAsFile: () => new File(["x"], "x.png", { type: "image/png" }),
          })),
          getData: () => "",
        },
      });
    });
    expect(view.state.doc.toString()).toBe("keep");
    await act(async () => {
      if (fail) reject(new Error("storage full"));
      else finish(secondPath);
    });
    expect(view.state.doc.toString()).toBe(
      fail ? "keep" : `![이미지](${path})\n![이미지](${secondPath})`,
    );
    if (fail)
      expect(onImageStatus).toHaveBeenLastCalledWith({
        message: "storage full",
        error: true,
      });
  },
);
