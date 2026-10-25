import type { NoteGraph } from "../domain/note-graph";
export function GraphItem(props: {
  node: NoteGraph["nodes"][number];
  incoming: boolean;
  property?: string | null;
  locked: boolean;
  onOpen: (title: string) => void;
}) {
  return (
    <button
      class="graph-node"
      disabled={props.locked}
      onClick={() => props.onOpen(props.node.title)}
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
    </button>
  );
}
