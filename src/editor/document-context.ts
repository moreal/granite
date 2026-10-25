import { Annotation, type EditorSelection } from "@codemirror/state";
import { readFrontmatter } from "../domain/frontmatter";

/** Host-owned property/external/recovery synchronization, never inferred from userEvent. */
export const synchronizeDocument = Annotation.define<boolean>();
export function documentContext(text: string) {
  const frontmatter = readFrontmatter(text);
  const metadataEnd = frontmatter.present ? frontmatter.bodyStart : 0;
  const bodyStart =
    frontmatter.closed && !frontmatter.warning ? metadataEnd : 0;
  return { frontmatter, metadataEnd, bodyStart };
}
export function selectionTouchesMetadata(
  selection: EditorSelection,
  end: number,
) {
  return selection.ranges.some((range) => range.from < end);
}
