import { readFrontmatter } from "./frontmatter";
export interface NotePreview {
  title: string;
  excerpt: string;
}
export type NotePreviewLookup = (title: string) => NotePreview | undefined;
/** Read-only projection; never parse user Markdown as HTML or fetch resources. */
export function notePreview(title: string, body: string): NotePreview {
  const metadata = readFrontmatter(body);
  const text = (metadata.present && !metadata.closed ? body : metadata.markdown)
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  return {
    title,
    excerpt:
      characters.slice(0, 240).join("") + (characters.length > 240 ? "…" : ""),
  };
}
