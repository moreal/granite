import type { NotePreviewLookup } from "../domain/note-preview";
import { GraphItem } from "./GraphItem";
import { createEffect, For } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { NoteGraph as Graph } from "../domain/note-graph";
export function NoteGraph(props: {
  preview?: NotePreviewLookup;
  graph: Graph;
  current: string;
  onOpen: (title: string) => void;
  locked: boolean;
}) {
  const currentNode = () =>
    props.graph.nodes.find((node) => node.id === props.current);
  const byId = () => new Map(props.graph.nodes.map((node) => [node.id, node]));
  const incoming = () =>
    props.graph.edges.filter((edge) => edge.target === props.current);
  const outgoing = () =>
    props.graph.edges.filter((edge) => edge.source === props.current);
  let details!: HTMLDetailsElement;
  createEffect(
    () => props.current,
    () => {
      details.open = false;
    },
  );
  return (
    <details ref={details} class="note-graph">
      <summary>
        <span>노트 그래프</span>
        <span>{incoming().length + outgoing().length}</span>
      </summary>
      <section aria-label="노트 그래프">
        <p class="graph-current">
          {currentNode()?.title}
          <span class="ui-badge ui-badge--compact schema-type">
            {currentNode()?.types.join(" · ")}
          </span>
        </p>
        <For
          each={[
            { label: "들어오는 연결", edges: incoming(), incoming: true },
            { label: "나가는 연결", edges: outgoing(), incoming: false },
          ]}
          keyed={(group) => group.label}
        >
          {(group) => (
            <div class="graph-direction">
              <h3>
                {group().label} <span>{group().edges.length}</span>
              </h3>
              {group().edges.length ? (
                <ul>
                  <For
                    each={group().edges}
                    keyed={(edge) => JSON.stringify(edge)}
                  >
                    {(edge) => (
                      <li>
                        <GraphItem
                          preview={props.preview}
                          contextKey={props.current}
                          node={byId().get(
                            group().incoming ? edge().source : edge().target,
                          )!}
                          incoming={group().incoming}
                          property={edge().property}
                          locked={props.locked}
                          onOpen={props.onOpen}
                        />
                      </li>
                    )}
                  </For>
                </ul>
              ) : (
                <p class="connection-empty">아직 연결이 없습니다.</p>
              )}
            </div>
          )}
        </For>
      </section>
    </details>
  );
}
