export interface Note {
  title: string;
  body: string;
  filename: string;
  baseline: string;
  updated: number;
  metadata: boolean;
}
export const fold = (s: string) =>
  s.normalize("NFC").toLocaleLowerCase("en-US");
function hash(s: string) {
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (const c of s) {
    a = Math.imul(a ^ c.codePointAt(0)!, 0x01000193);
    b = Math.imul(b ^ c.codePointAt(0)!, 0x85ebca6b);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
export function filenameFor(title: string) {
  const encoded = encodeURIComponent(title).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  if (encoded.length > 180) return `granite-${hash(title)}.md`;
  return (
    (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(encoded)
      ? "%5F"
      : "") +
    encoded +
    ".md"
  );
}
export function assertAvailable(
  title: string,
  notes: Pick<Note, "title" | "filename">[],
  filenames: string[] = notes.map((n) => n.filename),
) {
  if (!title.trim()) throw Error("제목을 입력해 주세요.");
  if (/[\u0000-\u001f\u007f]/.test(title))
    throw Error("제목에 줄바꿈이나 제어 문자를 쓸 수 없습니다.");
  const filename = filenameFor(title);
  if (
    notes.some((n) => fold(n.title) === fold(title)) ||
    filenames.some((f) => fold(f) === fold(filename))
  )
    throw Error(
      "같은 제목 또는 파일명이 이미 있습니다. 다른 제목을 입력해 주세요.",
    );
  return filename;
}
const prefix = "<!-- granite-title: ";
export function encodeNote(title: string, body: string) {
  return `${prefix}${JSON.stringify(title).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")} -->\n${body}`;
}
export function decodeNote(
  filename: string,
  raw: string,
  updated = Date.now(),
): Note {
  let title = filename.slice(0, -3),
    body = raw,
    metadata = false;
  try {
    title = decodeURIComponent(title);
  } catch {
    /* ordinary non-encoded filename */
  }
  if (raw.startsWith(prefix)) {
    const end = raw.indexOf(" -->\n");
    if (end >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(prefix.length, end));
        if (typeof parsed === "string") {
          title = parsed;
          body = raw.slice(end + 5);
          metadata = true;
        }
      } catch {
        /* preserve malformed metadata as ordinary Markdown */
      }
    }
  }
  return { title, body, filename, baseline: raw, updated, metadata };
}
export function serializeNote(note: Note, body: string) {
  return note.metadata ? encodeNote(note.title, body) : body;
}
