import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "./solid-render";
const createRef = <T,>() => ({ current: null as T | null });
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
  format: (
    s: string,
    c: {
      signal: AbortSignal;
    },
  ) => Promise<string>,
) {
  const ref = createRef<EditorHandle>(),
    onChange = vi.fn();
  const props = {
    ref: (handle: EditorHandle) => {
      ref.current = handle;
    },
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
  const rendered = render(Editor, {
    ...props,
  });
  const box = screen.getByRole("textbox", { name: "노트 본문" }),
    view = EditorView.findFromDOM(box)!;
  return { ref, props, rendered, box, view, onChange };
}
it.each(["edit", "key", "lock", "composition"])(
  "S20 discards pending result after %s",
  async (action) => {
    let resolve!: (s: string) => void;
    let signal!: AbortSignal;
    const s = setup((_text, context) => {
      signal = context.signal;
      return new Promise((r) => (resolve = r));
    });
    act(() => s.ref.current!.formatForSave());
    if (action === "edit")
      act(() => s.view.dispatch({ changes: { from: 0, insert: "new " } }));
    if (action === "key" || action === "lock")
      s.rendered.rerender({
        ...s.props,
        documentKey: action === "key" ? "two" : "one",
        locked: action === "lock",
      });
    if (action === "composition") fireEvent.compositionStart(s.box);
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
  await act(async () => s.ref.current!.formatForSave());
  expect(s.onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
  if (kind === "error")
    expect(screen.getByRole("status").textContent).toContain("format failed");
  else expect(screen.queryByRole("status")).toBeNull();
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
  render(Editor, {
    value: text,
    source: false,
    locked: false,
    titles: [],
    onChange: () => {},
    onOpen: () => {},
    onSelection: () => {},
  });
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
it("S20 auto formats only real edits after 1500ms and undo stays undone", async () => {
  vi.useFakeTimers();
  const s = setup(async (text) => text + " formatted");
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(s.view.state.sliceDoc()).toBe("original");
  act(() =>
    s.view.dispatch({
      changes: { from: 8, insert: "!" },
      userEvent: "input.paste",
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(1400));
  expect(s.view.state.sliceDoc()).toBe("original!");
  act(() =>
    s.view.dispatch({
      changes: { from: 9, insert: "?" },
      userEvent: "input.paste",
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(1499));
  expect(s.view.state.sliceDoc()).toBe("original!?");
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(s.view.state.sliceDoc()).toBe("original!? formatted");
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => {
    undo(s.view);
  });
  await act(async () => vi.advanceTimersByTimeAsync(4000));
  expect(s.view.state.sliceDoc()).toBe("original!?");
});
it.each(["cursor", "selection", "edit", "off", "key", "lock", "unmount"])(
  "S20 running auto job cancels on %s and preserves pending edits when appropriate",
  async (action) => {
    vi.useFakeTimers();
    const jobs: {
      resolve: (text: string) => void;
      signal: AbortSignal;
      text: string;
    }[] = [];
    const s = setup(
      (text, { signal }) =>
        new Promise((resolve) => jobs.push({ resolve, signal, text })),
    );
    act(() =>
      s.view.dispatch({
        changes: { from: 8, insert: "!" },
        userEvent: "input.paste",
      }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(jobs).toHaveLength(1);
    if (action === "cursor" || action === "selection")
      act(() =>
        s.view.dispatch({
          selection: { anchor: 1, head: action === "selection" ? 4 : 1 },
        }),
      );
    if (action === "edit")
      act(() =>
        s.view.dispatch({
          changes: { from: 9, insert: "?" },
          userEvent: "input.paste",
        }),
      );
    if (["off", "key", "lock"].includes(action))
      s.rendered.rerender({
        ...s.props,
        autoFormat: action !== "off",
        documentKey: action === "key" ? "two" : "one",
        locked: action === "lock",
      });
    if (action === "unmount") s.rendered.unmount();
    expect(jobs[0].signal.aborted).toBe(true);
    await act(async () => jobs[0].resolve("stale"));
    if (action !== "unmount") expect(s.view.state.sliceDoc()).not.toBe("stale");
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(jobs).toHaveLength(["cursor", "edit"].includes(action) ? 2 : 1);
    if (action === "selection") {
      act(() => s.view.dispatch({ selection: { anchor: 4 } }));
      await act(async () => vi.advanceTimersByTimeAsync(1500));
      expect(jobs).toHaveLength(2);
    }
    if (["cursor", "selection", "edit"].includes(action)) {
      await act(async () => jobs[1].resolve(jobs[1].text + " formatted"));
      expect(s.view.state.sliceDoc()).toBe(jobs[1].text + " formatted");
      if (action === "cursor")
        expect(s.view.state.selection.main.anchor).toBe(1);
    }
  },
);
it("S20 automatic failure preserves normal changes, does not retry, and clears on next edit", async () => {
  vi.useFakeTimers();
  let attempts = 0;
  const s = setup(async (text) => {
    if (++attempts === 1) throw Error("format failed");
    return text + " formatted";
  });
  act(() =>
    s.view.dispatch({
      changes: { from: 8, insert: "!" },
      userEvent: "input.paste",
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(s.onChange).toHaveBeenLastCalledWith("original!");
  expect(screen.getByRole("status").textContent).toContain("format failed");
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(attempts).toBe(1);
  act(() =>
    s.view.dispatch({
      changes: { from: 9, insert: "?" },
      userEvent: "input.paste",
    }),
  );
  expect(screen.queryByRole("status")).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(s.view.state.sliceDoc()).toBe("original!? formatted");
});
it("S20 synthetic composition waits until composition ends and automatic formatting keeps external focus", async () => {
  vi.useFakeTimers();
  const s = setup(async (text) => text + " formatted");
  fireEvent.compositionStart(s.box);
  act(() =>
    s.view.dispatch({
      changes: { from: 8, insert: "한" },
      userEvent: "input.paste",
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(s.view.state.sliceDoc()).toBe("original한");
  fireEvent.compositionEnd(s.box);
  const button = document.createElement("button");
  document.body.append(button);
  button.focus();
  await act(async () => vi.advanceTimersByTimeAsync(1600));
  expect(s.view.state.sliceDoc()).toBe("original한 formatted");
  expect(document.activeElement).toBe(button);
  button.remove();
});
it("S20 source changes, synchronized values, and enabling never create eligible edits", async () => {
  vi.useFakeTimers();
  const s = setup(async () => "unexpected");
  s.rendered.rerender({
    ...s.props,
    autoFormat: false,
    source: false,
    value: "external",
  });
  s.rendered.rerender({
    ...s.props,
    autoFormat: true,
    source: true,
    value: "external",
  });
  await act(async () => vi.advanceTimersByTimeAsync(4000));
  expect(s.view.state.sliceDoc()).toBe("external");
  act(() =>
    s.view.dispatch({
      changes: { from: 8, insert: "!" },
      userEvent: "input.paste",
    }),
  );
  s.rendered.rerender({
    ...s.props,
    autoFormat: false,
    value: "external!",
  });
  await act(async () => vi.advanceTimersByTimeAsync(4000));
  expect(s.view.state.sliceDoc()).toBe("external!");
});
it("S20 completion menu defers automatic work until dismissal", async () => {
  vi.useFakeTimers();
  const { startCompletion, closeCompletion, completionStatus } =
    await import("@codemirror/autocomplete");
  const s = setup(async (text) => text + " formatted");
  s.rendered.rerender({
    ...s.props,
    plugins: [
      ...s.props.plugins,
      {
        id: "menu",
        completions: [{ id: "choice", complete: () => [{ label: "today" }] }],
      },
    ],
  });
  act(() => {
    s.view.dispatch({
      changes: { from: 8, insert: " @" },
      selection: { anchor: 10 },
      userEvent: "input.paste",
    });
    startCompletion(s.view);
  });
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(completionStatus(s.view.state)).toBe("active");
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(s.view.state.sliceDoc()).toBe("original @");
  act(() => {
    closeCompletion(s.view);
  });
  await act(async () => vi.advanceTimersByTimeAsync(1499));
  expect(s.view.state.sliceDoc()).toBe("original @");
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(s.view.state.sliceDoc()).toBe("original @ formatted");
});
it("S20 paste choices defer automatic work until dismissal", async () => {
  vi.useFakeTimers();
  const s = setup(async (text) => text + " formatted");
  fireEvent.paste(s.box, {
    clipboardData: { items: [], getData: () => "https://example.com" },
  });
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole("group", { name: "붙여넣은 링크" })).toBeTruthy();
  expect(s.view.state.sliceDoc()).not.toContain("formatted");
  fireEvent.click(screen.getByRole("button", { name: "닫기 · Esc" }));
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(s.view.state.sliceDoc()).toContain("formatted");
});
it("S20 save formatting applies without review and keeps one undo unit", async () => {
  const { ref, view } = setup(async () => "formatted");
  await act(async () => await ref.current!.formatForSave());
  expect(view.state.sliceDoc()).toBe("formatted");
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => {
    undo(view);
  });
  expect(view.state.sliceDoc()).toBe("original");
});
it("S20 save formatting failure leaves raw source and selection protects source", async () => {
  const format = vi.fn(async () => {
    throw Error("failed");
  });
  const { ref, view } = setup(format);
  await act(async () => await ref.current!.formatForSave());
  expect(view.state.sliceDoc()).toBe("original");
  view.dispatch({ selection: { anchor: 0, head: 3 } });
  await act(async () => await ref.current!.formatForSave());
  expect(format).toHaveBeenCalledTimes(1);
});
it.each(["edit", "key", "lock", "composition"])(
  "S20 save discards stale asynchronous result after %s",
  async (action) => {
    let resolve!: (value: string) => void;
    const s = setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = s.ref.current!.formatForSave();
    if (action === "edit")
      act(() => s.view.dispatch({ changes: { from: 0, insert: "new " } }));
    if (action === "key" || action === "lock")
      s.rendered.rerender({
        ...s.props,
        documentKey: action === "key" ? "two" : "one",
        locked: action === "lock",
      });
    if (action === "composition") fireEvent.compositionStart(s.box);
    await act(async () => {
      resolve("stale");
      await pending;
    });
    expect(s.view.state.sliceDoc()).not.toBe("stale");
    expect(s.onChange).not.toHaveBeenCalledWith("stale");
  },
);
it("S20 repeated save jobs apply only the newest result", async () => {
  const done: ((value: string) => void)[] = [];
  const s = setup(
    () =>
      new Promise((resolve) => {
        done.push(resolve);
      }),
  );
  const first = s.ref.current!.formatForSave();
  const second = s.ref.current!.formatForSave();
  await act(async () => {
    done[1]("newest");
    await second;
  });
  await act(async () => {
    done[0]("stale");
    await first;
  });
  expect(s.view.state.sliceDoc()).toBe("newest");
  expect(s.onChange).toHaveBeenCalledTimes(1);
});

it("S20 applying save formatting preserves command chrome intent instead of simulating typing", async () => {
  const s = setup(async () => "formatted");
  const typing = vi.fn();
  s.rendered.rerender({ ...s.props, onUserEdit: typing });
  await act(async () => await s.ref.current!.formatForSave());
  expect(s.view.state.sliceDoc()).toBe("formatted");
  expect(typing).not.toHaveBeenCalled();
});
