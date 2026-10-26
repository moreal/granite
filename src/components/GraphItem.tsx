import { NoteLinkPreview } from "./NoteLinkPreview";
import type { NotePreviewLookup } from "../domain/note-preview";
import type { NoteGraph } from "../domain/note-graph";
export function GraphItem(props: {
  node: NoteGraph["nodes"][number];
  incoming: boolean;
  property?: string | null;
  locked: boolean;
  preview?: NotePreviewLookup;
  contextKey?: string;
  onOpen: (title: string) => void;
}) {
  return (
    <NoteLinkPreview
      title={props.node.title}
      preview={props.preview}
      contextKey={props.contextKey}
      layout="list"
      class="graph-node"
      disabled={props.locked}
      onOpen={props.onOpen}
    >
      <span class="graph-edge-label">{props.property ?? "본문 링크"}</span>
      <span class="graph-node-title">
        {props.incoming ? "← " : "→ "}
        {props.node.title}
      </span>
      <small>
        {props.node.missing
          ? "없는 노트 · 만들기"
          : props.node.types.join(" · ")}
      </small>
    </NoteLinkPreview>
  );
}
