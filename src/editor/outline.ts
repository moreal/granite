import type { EditorState } from "@codemirror/state";
import { documentContext } from "./document-context";
export interface WritingHeading {
  from: number;
  to: number;
  level: number;
  text: string;
}
function label(raw: string) {
  return raw
    .replace(/!?\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[((?:\\.|[^\]\\])*)\]\]/g, "$1")
    .replace(
      /\\([\\`*_{}\[\]()#+.!~>\-])|[*_`~]/g,
      (_match, escaped: string | undefined) => escaped ?? "",
    )
    .replace(/\s+/g, " ")
    .trim();
}
/** Scan only block heading/fence boundaries, independently of CM's viewport parser. */
export function writingHeadings(state: EditorState): WritingHeading[] {
  const headings: WritingHeading[] = [];
  const { metadataEnd } = documentContext(state.doc.toString());
  let fence: { marker: string; size: number } | undefined;
  let paragraph: { from: number; to: number; lines: string[] } | undefined;
  for (let number = 1; number <= state.doc.lines; number++) {
    const line = state.doc.line(number);
    if (line.from < metadataEnd) continue;
    if (fence) {
      const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(line.text);
      if (
        closing &&
        closing[1][0] === fence.marker &&
        closing[1].length >= fence.size
      )
        fence = undefined;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
    if (opening && (opening[1][0] !== "`" || !opening[2].includes("`"))) {
      fence = { marker: opening[1][0], size: opening[1].length };
      paragraph = undefined;
      continue;
    }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line.text);
    if (atx) {
      if (atx[1].length <= 3) {
        const text = label((atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, ""));
        if (text)
          headings.push({
            from: line.from,
            to: line.to,
            level: atx[1].length,
            text,
          });
      }
      paragraph = undefined;
      continue;
    }
    const setext = /^ {0,3}(=+|-+)[ \t]*$/.exec(line.text);
    if (setext && paragraph) {
      const text = label(paragraph.lines.join(" "));
      if (text)
        headings.push({
          from: paragraph.from,
          to: paragraph.to,
          level: setext[1][0] === "=" ? 1 : 2,
          text,
        });
      paragraph = undefined;
      continue;
    }
    if (
      !line.text.trim() ||
      /^(?: {4}|\t)|^ {0,3}(?:[>|<]|[-*+][ \t]|\d+[.)][ \t])/.test(line.text)
    )
      paragraph = undefined;
    else if (paragraph) paragraph.lines.push(line.text);
    else paragraph = { from: line.from, to: line.to, lines: [line.text] };
  }
  return headings;
}
