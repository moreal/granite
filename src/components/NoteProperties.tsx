import { createSignal, For } from "solid-js";
import {
  readFrontmatter,
  replaceFrontmatter,
  patchPropertyScalar,
  canEditPropertyScalar,
  propertyText,
} from "../domain/frontmatter";
import { planPropertyInsertion } from "../schema";
import { PropertyCreateForm } from "./properties/PropertyCreateForm";
import { PropertyPicker } from "./properties/PropertyPicker";
import { PropertyValueInput } from "./properties/PropertyValueInput";
import { PropertyRow } from "./properties/PropertyRow";
import { YamlEditor } from "./properties/YamlEditor";
export function NoteProperties(props: {
  body: string;
  documentKey?: string;
  titles?: readonly string[];
  onChange: (body: string) => void;
  locked: boolean;
}) {
  const metadata = () => readFrontmatter(props.body);
  const [key, setKey] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  let editor: HTMLTextAreaElement | undefined;
  let valueInput: HTMLInputElement | undefined;
  const [advanced, setAdvanced] = createSignal(false);
  const [draft, setDraft] = createSignal<{
    name: string;
    linkable: boolean;
    numeric: boolean;
    source: string;
    identity: string | undefined;
    existing: boolean;
  } | null>(null);
  const [draftValue, setDraftValue] = createSignal("");
  const begin = (name: string, existing = false) => {
    if (props.locked || !name.trim()) return;
    setError(null);
    const value = metadata().properties.get(name);
    setDraftValue(existing ? propertyText(value) : "");
    setDraft({
      name,
      linkable: !existing || typeof value === "string",
      numeric: existing && typeof value === "number",
      source: props.body,
      identity: props.documentKey,
      existing,
    });
    queueMicrotask(() => valueInput?.focus());
  };
  const commit = () => {
    const pending = draft();
    if (!pending || props.locked) return;
    if (
      pending.identity !== props.documentKey ||
      pending.source !== props.body
    ) {
      setError(
        "문서가 변경되었습니다. 입력한 값을 보관했어요. 취소 후 다시 편집해 주세요.",
      );
      return;
    }
    if (pending.existing) {
      const result = patchPropertyScalar(
        props.body,
        pending.name,
        draftValue(),
      );
      setError(result.error);
      if (result.body === undefined) return;
      props.onChange(result.body);
    } else {
      const result = planPropertyInsertion(
        props.body,
        pending.name,
        draftValue(),
        "frontmatter",
      );
      setError(result.error);
      if (!result.edit) return;
      const edit = result.edit;
      props.onChange(
        props.body.slice(0, edit.from) +
          edit.insert +
          props.body.slice(edit.to),
      );
    }
    setDraft(null);
    setKey("");
  };
  const valueField = () => (
    <div class="property-value-editor">
      <PropertyValueInput
        label={`${draft()?.name} 값`}
        value={draftValue()}
        titles={props.titles ?? []}
        linkable={
          !!draft()?.linkable &&
          draft()?.identity === props.documentKey &&
          draft()?.source === props.body
        }
        inputmode={draft()?.numeric ? "decimal" : "text"}
        contextKey={JSON.stringify([props.documentKey, props.body])}
        disabled={props.locked}
        onReady={(element) => {
          valueInput = element;
        }}
        onChange={setDraftValue}
        onCommit={commit}
        onCancel={() => {
          setDraft(null);
          setError(null);
        }}
      />
      <button type="button" disabled={props.locked} onClick={commit}>
        추가 / 적용
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(null);
          setError(null);
        }}
      >
        취소
      </button>
      <span class="property-help">확정 전에는 저장되지 않습니다.</span>
    </div>
  );
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
        {draft() &&
          (!draft()?.existing || !metadata().properties.has(draft()!.name)) &&
          valueField()}
        {error() && (
          <p class="property-warning" role="alert">
            {error()}
          </p>
        )}
        {metadata().present ? (
          <>
            <dl class="property-list">
              <For each={[...metadata().properties]} keyed={(item) => item[0]}>
                {(item) => (
                  <>
                    <PropertyRow
                      name={item()[0]}
                      value={item()[1]}
                      editor={
                        draft()?.existing && draft()?.name === item()[0]
                          ? valueField()
                          : undefined
                      }
                      editable={canEditPropertyScalar(props.body, item()[0])}
                      disabled={props.locked}
                      onEdit={() => begin(item()[0], true)}
                      onSource={() => {
                        setAdvanced(true);
                        queueMicrotask(() => editor?.focus());
                      }}
                    />
                  </>
                )}
              </For>
            </dl>
            <div class="property-create">
              <PropertyPicker
                value={key()}
                types={metadata().types}
                existingKeys={[...metadata().properties.keys()]}
                disabled={props.locked || !metadata().closed}
                onChange={setKey}
                onSelect={(name) => begin(name)}
              />
              <button
                type="button"
                disabled={props.locked || !key().trim() || !metadata().closed}
                onClick={() => begin(key())}
              >
                속성 넣기
              </button>
            </div>
            <details
              class="property-advanced"
              open={advanced()}
              onToggle={(event) => setAdvanced(event.currentTarget.open)}
            >
              <summary>YAML 원문 편집</summary>
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
                원문을 편집하면 자동 저장합니다. type은 Book, Person 같은
                이름이나 schema.org URL을 사용할 수 있습니다. 연결은 author:
                &quot;[[노트 제목]]&quot;처럼 입력하세요.
              </p>
            </details>
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
