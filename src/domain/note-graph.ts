import { readFrontmatter } from "./frontmatter";
import { parseWikiLinks } from "./links";
import type { Note } from "./notes";

export interface GraphNode {
  id: string;
  title: string;
  types: string[];
  missing: boolean;
}
export interface GraphEdge {
  source: string;
  target: string;
  /** null denotes an ordinary Markdown wikilink. */
  property: string | null;
}
export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function projectNoteGraph(
  notes: Pick<Note, "filename" | "title" | "body">[],
): NoteGraph {
  const parsed = notes.map((note) => ({
    note,
    metadata: readFrontmatter(note.body),
  }));
  const nodes: GraphNode[] = parsed.map(({ note, metadata }) => ({
    id: note.filename,
    title: note.title,
    types: metadata.types,
    missing: false,
  }));
  const byTitle = new Map(nodes.map((node) => [node.title, node]));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  function connect(source: string, title: string, property: string | null) {
    let target = byTitle.get(title);
    if (!target) {
      target = {
        id: `missing:${title}`,
        title,
        types: ["Thing"],
        missing: true,
      };
      byTitle.set(title, target);
      nodes.push(target);
    }
    const key = JSON.stringify([source, target.id, property]);
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ source, target: target.id, property });
    }
  }
  function properties(source: string, property: string, value: unknown) {
    if (typeof value === "string") {
      for (const link of parseWikiLinks(value))
        connect(source, link.title, property);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") properties(source, property, item);
      }
    }
  }
  for (const { note, metadata } of parsed) {
    for (const [key, value] of metadata.properties) {
      if (key !== "type" && key !== "@type")
        properties(note.filename, key, value);
    }
    for (const link of parseWikiLinks(metadata.markdown))
      connect(note.filename, link.title, null);
  }
  return { nodes, edges };
}
