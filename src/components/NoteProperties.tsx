import { createSignal, For } from "solid-js";
import { readFrontmatter, replaceFrontmatter } from "../domain/frontmatter";
import { planPropertyInsertion } from "../schema";
import { PropertyCreateForm } from "./properties/PropertyCreateForm";
import { PropertyPicker } from "./properties/PropertyPicker";
import { PropertyRow } from "./properties/PropertyRow";
import { YamlEditor } from "./properties/YamlEditor";
export function NoteProperties(props: {
  body: string;
  onChange: (body: string) => void;
  locked: boolean;
}) {
  const metadata = () => readFrontmatter(props.body);
  const [key, setKey] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  let editor: HTMLTextAreaElement | undefined;
  const insert = (name: string) => {
    if (props.locked) return;
    const current = metadata();
    const result = planPropertyInsertion(props.body, name, "", "frontmatter");
    setError(result.error);
    if (!result.edit) return;
    const edit = result.edit;
    props.onChange(
      props.body.slice(0, edit.from) + edit.insert + props.body.slice(edit.to),
    );
    setKey("");
    // Place the caret inside the inserted quoted empty value, after DOM updates.
    queueMicrotask(() => {
      editor?.focus();
      const cursor = (
        props.body.slice(current.from, edit.from) +
        edit.insert.slice(0, edit.insert.lastIndexOf('"'))
      ).replace(/\r\n/g, "\n").length;
      editor?.setSelectionRange(cursor, cursor);
    });
  };
  return (
    <details class="note-properties">
      <summary>
        <span>속성</span>
        {metadata().present && (
          <span class="schema-type">{metadata().types.join(" · ")}</span>
        )}
      </summary>
      <div class="property-content">
        {metadata().warning && (
          <p class="property-warning" role="alert">
            {metadata().warning}
          </p>
        )}
        {metadata().present ? (
          <>
            <dl class="property-list">
              <For each={[...metadata().properties]} keyed={(item) => item[0]}>
                {(item) => <PropertyRow name={item()[0]} value={item()[1]} />}
              </For>
            </dl>
            <div class="property-create">
              <PropertyPicker
                value={key()}
                types={metadata().types}
                existingKeys={[...metadata().properties.keys()]}
                disabled={props.locked || !metadata().closed}
                onChange={setKey}
                onSelect={insert}
              />
              <button
                type="button"
                disabled={props.locked || !key().trim() || !metadata().closed}
                onClick={() => insert(key())}
              >
                속성 넣기
              </button>
            </div>
            {error() && (
              <p class="property-warning" role="alert">
                {error()}
              </p>
            )}
            <YamlEditor
              value={metadata().yaml}
              disabled={props.locked}
              onReady={(element) => {
                editor = element;
              }}
              onChange={(yaml) => {
                setError(null);
                props.onChange(replaceFrontmatter(props.body, yaml));
              }}
            />
            <p class="property-help">
              원문을 편집하면 자동 저장합니다. type은 Book, Person 같은 이름이나
              schema.org URL을 사용할 수 있습니다. 연결은 author: &quot;[[노트
              제목]]&quot;처럼 입력하세요.
            </p>
            {!metadata().closed && (
              <p class="property-help">
                본문의 원문 보기에서 속성 마지막에 ---를 추가해 주세요.
              </p>
            )}
          </>
        ) : (
          <>
            <p class="property-help">
              이 노트에 유형과 속성을 붙일 수 있습니다. 본문 맨 앞에 YAML로
              저장됩니다.
            </p>
            <PropertyCreateForm
              disabled={props.locked}
              onCreate={(type) =>
                props.onChange(replaceFrontmatter(props.body, `type: ${type}`))
              }
            />
          </>
        )}
      </div>
    </details>
  );
}
