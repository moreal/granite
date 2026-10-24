import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { markdownLanguage } from "@codemirror/lang-markdown";
import katex from "katex";
import { isImageAssetPath } from "../storage/assets";
import "katex/dist/katex.min.css";

interface RichNode {
  from: number;
  to: number;
  kind: "image" | "math" | "mermaid";
  value: string;
  label?: string;
  block: boolean;
}
export const imagePath = isImageAssetPath;
export const refreshRichPreview = StateEffect.define<null>();
export function richNodes(state: EditorState): RichNode[] {
  const text = state.doc.toString(),
    nodes: RichNode[] = [],
    excluded: { from: number; to: number }[] = [];
  markdownLanguage.parser.parse(text).iterate({
    enter(node) {
      if (
        [
          "FencedCode",
          "CodeBlock",
          "InlineCode",
          "Link",
          "Autolink",
          "URL",
          "HTMLBlock",
          "HTMLTag",
        ].includes(node.name)
      ) {
        excluded.push({ from: node.from, to: node.to });
        if (node.name === "FencedCode") {
          const raw = text.slice(node.from, node.to),
            match =
              /^(`{3,}|~{3,})mermaid[^\S\n]*\n([\s\S]*?)\n(?:`{3,}|~{3,})\s*$/.exec(
                raw,
              );
          if (match)
            nodes.push({
              from: node.from,
              to: node.to,
              kind: "mermaid",
              value: match[2],
              block: true,
            });
        }
        return false;
      }
      if (node.name === "Image") {
        excluded.push({ from: node.from, to: node.to });
        const raw = text.slice(node.from, node.to),
          match = /^!\[((?:\\.|[^\]\\])*)\]\(([^\s]+)\)$/.exec(raw);
        if (match) {
          let path = "";
          try {
            path = decodeURIComponent(match[2]);
          } catch {
            return false;
          }
          if (imagePath(path))
            nodes.push({
              from: node.from,
              to: node.to,
              kind: "image",
              value: path,
              label: match[1].replace(/\\(.)/g, "$1"),
              block: false,
            });
        }
        return false;
      }
    },
  });
  const available = (from: number, to: number) =>
    !excluded.some((r) => from < r.to && to > r.from) &&
    !nodes.some((r) => from < r.to && to > r.from);
  for (const m of text.matchAll(/^\$\$[^\S\n]*\n([\s\S]*?)\n\$\$[^\S\n]*$/gm)) {
    if (available(m.index, m.index + m[0].length))
      nodes.push({
        from: m.index,
        to: m.index + m[0].length,
        kind: "math",
        value: m[1],
        block: true,
      });
  }
  const escaped = (at: number) => {
    let slashes = 0;
    for (let i = at - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
    return slashes % 2 === 1;
  };
  for (let from = 0; from < text.length; from++) {
    if (
      text[from] !== "$" ||
      escaped(from) ||
      text[from - 1] === "$" ||
      text[from + 1] === "$" ||
      /\s/.test(text[from + 1] ?? "")
    )
      continue;
    let end = from + 1;
    for (; end < text.length && text[end] !== "\n"; end++)
      if (text[end] === "$" && !escaped(end)) break;
    if (text[end] !== "$") continue;
    const to = end + 1,
      value = text.slice(from + 1, end),
      after = text[to] ?? "";
    const preceding = text.slice(0, from).match(/\S*$/)?.[0] ?? "";
    if (
      !value ||
      /\s$/.test(value) ||
      after === "$" ||
      /\d/.test(after) ||
      preceding.includes("://") ||
      !available(from, to)
    )
      continue;
    nodes.push({ from, to, kind: "math", value, block: false });
    from = end;
  }
  return nodes.sort((a, b) => a.from - b.from);
}
export function safeMermaidSource(source: string) {
  return (
    source.length <= 50000 &&
    !/(%%\s*\{|^\s*---|\bclick\b|\b(?:href|img|image|icon)\s*:|<|>|url\s*\(|@import|https?:|data:|javascript:)/im.test(
      source.replace(/-->|==>|-\.->/g, ""),
    )
  );
}
export function sanitizeDiagram(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw Error("Invalid SVG");
  for (const el of doc.querySelectorAll("*")) {
    if (
      [
        "script",
        "foreignObject",
        "image",
        "a",
        "iframe",
        "object",
        "embed",
        "animate",
        "set",
      ].includes(el.localName)
    )
      throw Error("Unsafe SVG");
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase(),
        value = attr.value;
      if (
        name.startsWith("on") ||
        ((name === "href" || name.endsWith(":href")) && !value.startsWith("#"))
      )
        throw Error("Unsafe SVG reference");
      if (
        /(?:url\(\s*["']?(?!#)|@import|javascript:|data:|https?:)/i.test(
          value,
        ) &&
        name !== "xmlns" &&
        !name.startsWith("xmlns:")
      )
        throw Error("Unsafe SVG resource");
    }
    if (
      el.localName === "style" &&
      /(?:url\(\s*["']?(?!#)|@import|https?:|data:)/i.test(el.textContent ?? "")
    )
      throw Error("Unsafe SVG style");
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
let diagramId = 0;
let mermaidLibrary: Promise<(typeof import("mermaid"))["default"]> | undefined;
function mermaid() {
  return (mermaidLibrary ??= import("mermaid").then(
    ({ default: library }) => library,
  ));
}
// Mermaid configuration is global. Keep initialization and its entire async render
// together so another widget cannot change the theme midway through rendering.
let diagramQueue: Promise<unknown> = Promise.resolve();
function renderDiagram(source: string, dark: boolean, current: () => boolean) {
  const result = diagramQueue.then(async () => {
    if (!current()) return;
    const library = await mermaid();
    if (!current()) return;
    library.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
      fontFamily: "system-ui, sans-serif",
      flowchart: { htmlLabels: false },
      htmlLabels: false,
      suppressErrorRendering: true,
    });
    const rendered = await library.render(
      `granite-diagram-${++diagramId}`,
      source,
    );
    return current() ? sanitizeDiagram(rendered.svg) : undefined;
  });
  diagramQueue = result.catch(() => undefined);
  return result;
}
class RichWidget extends WidgetType {
  private disposed = false;
  private objectUrl?: string;
  private renderVersion = 0;
  private stopThemeListener?: () => void;
  constructor(
    readonly node: RichNode,
    readonly readImage?: (path: string) => Promise<Blob>,
  ) {
    super();
  }
  eq(other: RichWidget) {
    return (
      this.node.kind === other.node.kind &&
      this.node.value === other.node.value &&
      this.node.label === other.node.label &&
      this.node.from === other.node.from &&
      this.node.to === other.node.to &&
      this.node.block === other.node.block &&
      this.readImage === other.readImage
    );
  }
  toDOM(view: EditorView) {
    this.disposed = false;
    const el = document.createElement(this.node.block ? "div" : "span");
    el.className = `cm-rich-preview cm-rich-${this.node.kind}`;
    el.setAttribute(
      "aria-label",
      this.node.kind === "image"
        ? this.node.label || "이미지"
        : this.node.kind === "math"
          ? "수식"
          : "다이어그램",
    );
    el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.node.from } });
      view.focus();
    });
    const fail = (message: string) => {
      if (this.disposed) return;
      el.classList.add("cm-rich-error");
      el.textContent = view.state.doc.sliceString(this.node.from, this.node.to);
      el.title = message;
      view.requestMeasure();
    };
    if (this.node.kind === "math") {
      try {
        el.innerHTML = katex.renderToString(this.node.value, {
          displayMode: this.node.block,
          throwOnError: true,
          trust: false,
          strict: "error",
          macros: {},
          maxExpand: 100,
          maxSize: 20,
          output: "htmlAndMathml",
        });
      } catch {
        fail("수식을 표시할 수 없습니다. 클릭해서 수정하세요.");
      }
    } else if (this.node.kind === "image") {
      el.textContent = "이미지 불러오는 중…";
      if (!this.readImage) fail("이미지를 불러올 수 없습니다.");
      else
        void this.readImage(this.node.value)
          .then((blob) => {
            if (this.disposed) return;
            this.objectUrl = URL.createObjectURL(blob);
            const img = document.createElement("img");
            img.alt = this.node.label ?? "";
            img.src = this.objectUrl;
            img.addEventListener("load", () => view.requestMeasure());
            img.addEventListener("error", () =>
              fail("이미지를 표시할 수 없습니다."),
            );
            el.replaceChildren(img);
            view.requestMeasure();
          })
          .catch(() =>
            fail("이미지를 불러올 수 없습니다. 경로와 파일을 확인하세요."),
          );
    } else {
      el.textContent = "다이어그램 그리는 중…";
      if (!safeMermaidSource(this.node.value))
        fail("안전하지 않거나 지원하지 않는 다이어그램입니다.");
      else {
        const render = () => {
          const version = ++this.renderVersion;
          const current = () =>
            !this.disposed && version === this.renderVersion;
          const dark = document.documentElement.dataset.theme === "dark";
          void renderDiagram(this.node.value, dark, current)
            .then((safe) => {
              if (!current() || safe === undefined) return;
              el.classList.remove("cm-rich-error");
              el.removeAttribute("title");
              el.innerHTML = safe;
              view.requestMeasure();
            })
            .catch(() => {
              if (current())
                fail("다이어그램을 표시할 수 없습니다. 클릭해서 수정하세요.");
            });
        };
        window.addEventListener("granite-theme-change", render);
        this.stopThemeListener = () =>
          window.removeEventListener("granite-theme-change", render);
        render();
      }
    }
    return el;
  }
  ignoreEvent() {
    return true;
  }
  destroy() {
    this.disposed = true;
    this.renderVersion++;
    this.stopThemeListener?.();
    this.stopThemeListener = undefined;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
  }
}
export function richPreview(readImage?: (path: string) => Promise<Blob>) {
  const build = (state: EditorState) =>
    Decoration.set(
      richNodes(state)
        .filter(
          (node) =>
            !state.selection.ranges.some(
              (r) => r.from <= node.to && r.to >= node.from,
            ),
        )
        .map((node) =>
          Decoration.replace({
            widget: new RichWidget(node, readImage),
            block: node.block,
          }).range(node.from, node.to),
        ),
      true,
    );
  return StateField.define<DecorationSet>({
    create: build,
    update(value, tr) {
      if (tr.isUserEvent("input.type.compose")) return value.map(tr.changes);
      return tr.docChanged ||
        tr.selection ||
        tr.effects.some((effect) => effect.is(refreshRichPreview))
        ? build(tr.state)
        : value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
