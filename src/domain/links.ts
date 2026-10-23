import { markdownLanguage } from "@codemirror/lang-markdown";
import type { Note } from "./notes";
export interface WikiMatch {
  title: string;
  from: number;
  to: number;
}
export function wikiLink(title: string) {
  return "[[" + title.replace(/[\\[\]]/g, "\\$&") + "]]";
}
export function codeRanges(body: string) {
  const ranges: { from: number; to: number }[] = [];
  markdownLanguage.parser.parse(body).iterate({
    enter(node) {
      if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name)) {
        ranges.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  return ranges;
}
export function parseWikiLinks(body: string): WikiMatch[] {
  const excluded = codeRanges(body),
    result: WikiMatch[] = [];
  const re = /\[\[((?:\\.|[^\]\\\n])*)\]\]/g;
  let m;
  while ((m = re.exec(body))) {
    let slashes = 0;
    for (let i = m.index - 1; i >= 0 && body[i] === "\\"; i--) slashes++;
    if (slashes % 2) continue;
    if (!excluded.some((r) => m!.index >= r.from && m!.index < r.to) && m[1])
      result.push({
        title: m[1].replace(/\\([\\[\]])/g, "$1"),
        from: m.index,
        to: m.index + m[0].length,
      });
  }
  return result;
}
export function localDate(offset = 0, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function backlinks(
  notes: Pick<Note, "title" | "body" | "filename">[],
  title: string,
) {
  return notes.flatMap((note) =>
    parseWikiLinks(note.body)
      .filter((l) => l.title === title)
      .map((link) => ({
        ...note,
        context: note.body
          .slice(
            Math.max(0, note.body.lastIndexOf("\n", link.from) + 1),
            note.body.indexOf("\n", link.to) === -1
              ? note.body.length
              : note.body.indexOf("\n", link.to),
          )
          .slice(0, 180),
      })),
  );
}
export interface MenuTrigger {
  kind: "wiki" | "command";
  query: string;
  from: number;
  to: number;
}
export function menuTrigger(
  body: string,
  pos: number,
  composing: boolean,
): MenuTrigger | null {
  if (composing || codeRanges(body).some((r) => pos > r.from && pos <= r.to))
    return null;
  const before = body.slice(0, pos),
    wiki = /(?<!\\)\[\[((?:\\.|[^\]\\\n])*)$/.exec(before);
  if (wiki) return { kind: "wiki", query: wiki[1], from: wiki.index, to: pos };
  const command = /(?:^|\s)@([^\s@\[\]]*)$/.exec(before);
  return command
    ? {
        kind: "command",
        query: command[1],
        from: pos - command[1].length - 1,
        to: pos,
      }
    : null;
}
export function markdownLink(label: string, url: string) {
  return `[${label.replace(/[\\[\]]/g, "\\$&")}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
}
