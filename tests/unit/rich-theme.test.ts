import { afterEach, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { richPreview } from "../../src/editor/rich-preview";

const library = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: library }));
const views: EditorView[] = [];
const source = "start\n\n```mermaid\ngraph TD; A-->B\n```\n\nend";
function mount() {
  const parent = document.body.appendChild(document.createElement("div"));
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: source, extensions: [richPreview()] }),
  });
  views.push(view);
  return view;
}
function theme(value: "dark" | "light") {
  document.documentElement.dataset.theme = value;
  window.dispatchEvent(new CustomEvent("granite-theme-change"));
}
function svg(label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`;
}
afterEach(() => {
  views.splice(0).forEach((view) => view.destroy());
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  vi.clearAllMocks();
});
it("S14 switches diagram theme without editor transactions and preserves strict rendering", async () => {
  library.render.mockResolvedValue({ svg: svg("diagram") });
  theme("light");
  const view = mount();
  const state = view.state;
  await vi.waitFor(() => expect(library.render).toHaveBeenCalledTimes(1));
  theme("dark");
  await vi.waitFor(() => expect(library.render).toHaveBeenCalledTimes(2));
  expect(library.initialize.mock.calls.map(([config]) => config.theme)).toEqual(
    ["default", "dark"],
  );
  expect(library.initialize).toHaveBeenLastCalledWith(
    expect.objectContaining({
      securityLevel: "strict",
      htmlLabels: false,
      suppressErrorRendering: true,
    }),
  );
  expect(view.state).toBe(state);
  expect(view.state.doc.toString()).toBe(source);
});
it("S14 serializes configuration and drops an in-flight old-theme SVG", async () => {
  let finish!: (value: { svg: string }) => void;
  library.render
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ svg: svg("current dark") });
  theme("light");
  const view = mount();
  await vi.waitFor(() => expect(library.render).toHaveBeenCalledTimes(1));
  theme("dark");
  await Promise.resolve();
  expect(library.initialize).toHaveBeenCalledTimes(1);
  finish({ svg: svg("stale light") });
  await vi.waitFor(() =>
    expect(view.dom.querySelector(".cm-rich-mermaid")?.textContent).toBe(
      "current dark",
    ),
  );
  expect(view.dom.textContent).not.toContain("stale light");
  view.destroy();
  theme("light");
  await Promise.resolve();
  expect(library.render).toHaveBeenCalledTimes(2);
});
