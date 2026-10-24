import type { NoteGraph as Graph } from "../domain/note-graph";

export function NoteGraph({
  graph,
  current,
  onOpen,
  locked,
}: {
  graph: Graph;
  current: string;
  onOpen: (title: string) => void;
  locked: boolean;
}) {
  const currentNode = graph.nodes.find((node) => node.id === current);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = graph.edges.filter((edge) => edge.target === current);
  const outgoing = graph.edges.filter((edge) => edge.source === current);
  return (
    <details className="note-graph" key={current}>
      <summary>
        <span>노트 그래프</span>
        <span>{incoming.length + outgoing.length}</span>
      </summary>
      <section aria-label="노트 그래프">
        <p className="graph-current">
          {currentNode?.title}
          <span className="schema-type">{currentNode?.types.join(" · ")}</span>
        </p>
        {[
          { label: "들어오는 연결", edges: incoming, incoming: true },
          { label: "나가는 연결", edges: outgoing, incoming: false },
        ].map((group) => (
          <div key={group.label} className="graph-direction">
            <h3>
              {group.label} <span>{group.edges.length}</span>
            </h3>
            {group.edges.length ? (
              <ul>
                {group.edges.map((edge) => {
                  const node = byId.get(
                    group.incoming ? edge.source : edge.target,
                  )!;
                  return (
                    <li key={JSON.stringify(edge)}>
                      <button
                        className="graph-node"
                        disabled={locked}
                        onClick={() => onOpen(node.title)}
                      >
                        <span className="graph-edge-label">
                          {edge.property ?? "본문 링크"}
                        </span>
                        <span className="graph-node-title">
                          {group.incoming ? "← " : "→ "}
                          {node.title}
                        </span>
                        <small>
                          {node.missing
                            ? "없는 노트 · 만들기"
                            : node.types.join(" · ")}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="connection-empty">아직 연결이 없습니다.</p>
            )}
          </div>
        ))}
      </section>
    </details>
  );
}
