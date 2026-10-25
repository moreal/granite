import { EditorState, StateEffect } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { parseWikiLinks } from "../domain/links";
import { safeWebUrl } from "./helpers";
import { refreshRichPreview } from "./rich-preview";
import { documentContext } from "./document-context";
interface PreviewLink {
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
  target: string;
  external: boolean;
}
export function previewLinks(state: EditorState): PreviewLink[] {
  const metadataEnd = documentContext(state.doc.toString()).metadataEnd;
  const links: PreviewLink[] = parseWikiLinks(state.doc.toString())
    .filter((link) => link.from >= metadataEnd)
    .map((link) => ({
      ...link,
      labelFrom: link.from + 2,
      labelTo: link.to - 2,
      target: link.title,
      external: false,
    }));
  const definitions = new Map<string, string>();
  const referenceKey = (label: string) =>
    label.replace(/\\(.)/g, "$1").trim().replace(/\s+/g, " ").toLowerCase();
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Document" && node.from < metadataEnd) return false;
      if (
        ["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock"].includes(
          node.name,
        )
      )
        return false;
      if (node.name === "LinkReference") {
        const raw = state.sliceDoc(node.from, node.to);
        const match = /^\[((?:\\.|[^\]])+)\]:\s*(?:<([^>]+)>|(\S+))/.exec(raw);
        if (match) {
          const key = referenceKey(match[1]);
          if (!definitions.has(key)) definitions.set(key, match[2] ?? match[3]);
        }
        return false;
      }
    },
  });
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Document" && node.from < metadataEnd) return false;
      if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name))
        return false;
      if (node.name !== "Link") return;
      const raw = state.doc.sliceString(node.from, node.to);
      const inline = /^\[((?:\\.|[^\]])*)\]\(([^\s]+)\)$/.exec(raw);
      const reference =
        /^\[((?:\\.|[^\]\[])*)\](?:\[((?:\\.|[^\]])*)\])?$/.exec(raw);
      // Wiki syntax always belongs to note navigation, including unresolved notes.
      const wiki = links.some(
        (link) => node.from < link.to && node.to > link.from,
      );
      const target =
        reference && !wiki
          ? definitions.get(referenceKey(reference[2] || reference[1]))
          : undefined;
      const match =
        inline ?? (reference && target ? [raw, reference[1], target] : null);
      if (match && !raw.includes("\n") && safeWebUrl(match[2])) {
        links.push({
          from: node.from,
          to: node.to,
          labelFrom: node.from + 1,
          labelTo: node.from + 1 + match[1].length,
          target: match[2],
          external: true,
        });
      }
      return false;
    },
  });
  return links;
}
const refreshPreview = StateEffect.define<null>();
export function preview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        // Keep the composing DOM stable, while tracking positions through edits.
        if (update.view.composing) {
          this.decorations = this.decorations.map(update.changes);
          return;
        }
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(refreshPreview)),
          )
        ) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView) {
        const ranges: ReturnType<
          ReturnType<typeof Decoration.mark>["range"]
        >[] = [];
        const doc = view.state.doc;
        const metadataEnd = documentContext(doc.toString()).metadataEnd;
        const quoteLines = new Map<number, number>();
        const selection = view.state.selection.ranges;
        const activeLines = new Set(
          selection.flatMap((range) => {
            const lines: number[] = [];
            for (
              let n = doc.lineAt(range.from).number;
              n <= doc.lineAt(range.to).number;
              n++
            )
              lines.push(n);
            return lines;
          }),
        );
        syntaxTree(view.state).iterate({
          enter(node) {
            if (node.name !== "Document" && node.from < metadataEnd)
              return false;
            if (node.name === "Blockquote") {
              for (
                let n = doc.lineAt(node.from).number;
                n <= doc.lineAt(node.to).number;
                n++
              )
                quoteLines.set(n, (quoteLines.get(n) ?? 0) + 1);
            }
            const line = doc.lineAt(node.from);
            if (node.name === "FencedCode" || node.name === "CodeBlock") {
              for (
                let number = line.number;
                number <= doc.lineAt(node.to).number;
                number++
              ) {
                ranges.push(
                  Decoration.line({
                    class:
                      node.name === "FencedCode"
                        ? "cm-fenced-code cm-code-layout"
                        : "cm-code-layout",
                  }).range(doc.line(number).from),
                );
              }
            }
            if (/^ATXHeading[1-6]$/.test(node.name)) {
              ranges.push(
                Decoration.line({
                  class: "cm-heading cm-heading-" + node.name.slice(-1),
                }).range(line.from),
              );
            }
            if (node.name === "InlineCode") {
              ranges.push(
                Decoration.mark({ class: "cm-code-layout" }).range(
                  node.from,
                  node.to,
                ),
              );
            }
            if (activeLines.has(line.number)) return;
            if (
              [
                "HeaderMark",
                "EmphasisMark",
                "CodeMark",
                "CodeInfo",
                "QuoteMark",
              ].includes(node.name)
            ) {
              // The opening ATX marker owns its separator; indentation and
              // closing-marker whitespace remain untouched document text.
              const openingHeading =
                node.name === "HeaderMark" &&
                /^ATXHeading[1-6]$/.test(node.node.parent?.name ?? "") &&
                node.node.parent?.firstChild?.from === node.from;
              const separator =
                node.name === "QuoteMark"
                  ? /^[ \t]/.test(doc.sliceString(node.to, line.to))
                    ? 1
                    : 0
                  : openingHeading
                    ? (doc.sliceString(node.to, line.to).match(/^[ \t]+/)?.[0]
                        .length ?? 0)
                    : 0;
              ranges.push(
                Decoration.replace({}).range(node.from, node.to + separator),
              );
            }
            const classes: Record<string, string> = {
              StrongEmphasis: "cm-strong",
              Emphasis: "cm-emphasis",
              InlineCode: "cm-inline-code",
            };
            const className = classes[node.name];
            if (className)
              ranges.push(
                Decoration.mark({ class: className }).range(node.from, node.to),
              );
          },
        });
        for (const [number, depth] of quoteLines)
          ranges.push(
            Decoration.line({
              class: "cm-blockquote",
              attributes: { style: `--quote-depth: ${depth}` },
            }).range(doc.line(number).from),
          );
        for (const link of previewLinks(view.state)) {
          if (
            selection.some(
              (range) => range.from <= link.to && range.to >= link.from,
            )
          )
            continue;
          // Empty labels and multiline syntax stay editable as ordinary source.
          if (link.labelFrom === link.labelTo) continue;
          ranges.push(Decoration.replace({}).range(link.from, link.labelFrom));
          ranges.push(
            Decoration.mark({
              class: "cm-note-link",
              attributes: {
                "data-link-target": link.target,
                "data-link-external": String(link.external),
              },
            }).range(link.labelFrom, link.labelTo),
          );
          ranges.push(Decoration.replace({}).range(link.labelTo, link.to));
          const label = doc.sliceString(link.labelFrom, link.labelTo);
          const escapes = link.external ? /\\(.)/g : /\\([\\[\]])/g;
          for (const match of label.matchAll(escapes)) {
            const from = link.labelFrom + match.index;
            ranges.push(Decoration.replace({}).range(from, from + 1));
          }
        }
        return Decoration.set(ranges, true);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        compositionend(_event, view) {
          // CodeMirror finishes its composition handler before the queued refresh.
          queueMicrotask(() => {
            if (view.dom.isConnected)
              view.dispatch({
                effects: [refreshPreview.of(null), refreshRichPreview.of(null)],
              });
          });
        },
      },
    },
  );
}
