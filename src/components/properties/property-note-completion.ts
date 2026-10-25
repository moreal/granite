import { wikiLink } from "../../domain/links";

export interface PropertyNoteContext {
  from: number;
  to: number;
  query: string;
  closing: boolean;
}

/** Value fields are plain text: only a collapsed caret can open completion. */
export function propertyNoteContext(
  value: string,
  start: number,
  end: number,
): PropertyNoteContext | null {
  if (start !== end || start < 0 || start > value.length) return null;
  const before = value.slice(0, start);
  const wiki = /\[\[((?:\\.|[^\]\\\n])*)$/.exec(before);
  if (wiki) {
    let slashes = 0;
    for (let i = wiki.index - 1; i >= 0 && value[i] === "\\"; i--) slashes++;
    if (slashes % 2) return null;
    return {
      from: wiki.index,
      to: start,
      query: wiki[1],
      closing: value.slice(start, start + 2) === "]]",
    };
  }
  const command = /(?:^|\s)@([^\s@\[\]]*)$/.exec(before);
  return command
    ? {
        from: start - command[1].length - 1,
        to: start,
        query: command[1],
        closing: false,
      }
    : null;
}

export function propertyNoteTitles(titles: readonly string[], query: string) {
  const normalized = query
    .replace(/\\([\\[\]])/g, "$1")
    .normalize("NFKC")
    .toLocaleLowerCase();
  return [...new Set(titles)]
    .filter((title) =>
      title.normalize("NFKC").toLocaleLowerCase().includes(normalized),
    )
    .slice(0, 20);
}

export function completePropertyNote(
  value: string,
  context: PropertyNoteContext,
  title: string,
) {
  const link = wikiLink(title);
  return {
    value:
      value.slice(0, context.from) +
      link +
      value.slice(context.to + (context.closing ? 2 : 0)),
    caret: context.from + link.length,
  };
}
