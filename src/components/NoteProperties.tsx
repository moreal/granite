import { createSignal, createMemo, createEffect } from "solid-js";
import {
  readFrontmatter,
  replaceFrontmatter,
  patchPropertyScalar,
  propertyText,
} from "../domain/frontmatter";
import { planPropertyInsertion } from "../schema";
import { PropertyAdvice } from "./properties/PropertyAdvice";
import type { NoteReference } from "../schema/references";
import type { PropertyEditorMode } from "../settings";
import { PropertyForm } from "./properties/PropertyForm";
import { PropertyValueInput } from "./properties/PropertyValueInput";
import { YamlEditor } from "./properties/YamlEditor";
export function NoteProperties(props: {
  body: string;
  documentKey?: string;
  titles?: readonly string[];
  references?: readonly NoteReference[];
  mode?: PropertyEditorMode;
  source?: boolean;
  sourceEditing?: boolean;
  onSource?: () => void;
  onChange: (body: string) => void;
  locked: boolean;
}) {
  const metadata = createMemo(() => readFrontmatter(props.body));
  const [key, setKey] = createSignal("");
  const [initialType, setInitialType] = createSignal("Thing");
  const [error, setError] = createSignal<string | null>(null);
  let panel!: HTMLDetailsElement;
  const [draftBlocked, setDraftBlocked] = createSignal(false);
  const [yamlEditing, setYamlEditing] = createSignal<{
    identity: string | undefined;
  } | null>(null);
  let yamlContext: string | undefined;
  createEffect(
    () => JSON.stringify([props.documentKey, props.mode, props.source]),
    (context) => {
      if (context !== yamlContext) {
        yamlContext = context;
        setYamlEditing(null);
      }
    },
  );
  const warningVisible = () =>
    !!metadata().warning &&
    !(props.source
      ? props.sourceEditing
      : yamlEditing()?.identity === props.documentKey &&
        yamlEditing() !== null);
  let valueInput: HTMLInputElement | undefined;
  const [draft, setDraft] = createSignal<{
    name: string;
    linkable: boolean;
    numeric: boolean;
    source: string;
    identity: string | undefined;
    existing: boolean;
  } | null>(null);
  const [draftValue, setDraftValue] = createSignal("");
  const finish = () => {
    const pending = draft();
    setDraft(null);
    setError(null);
    setDraftBlocked(false);
    queueMicrotask(() => {
      if (
        !pending ||
        pending.identity !== props.documentKey ||
        props.source ||
        !panel.isConnected
      )
        return;
      if (props.mode === "yaml") {
        panel
          .querySelector<HTMLElement>("textarea, .property-content button")
          ?.focus();
        return;
      }
      const row = pending.existing
        ? [
            ...panel.querySelectorAll<HTMLButtonElement>(
              "button[data-property]",
            ),
          ].find((button) => button.dataset.property === pending.name)
        : undefined;
      (row ?? panel.querySelector<HTMLElement>("#new-property-key"))?.focus();
    });
  };
  const begin = (name: string, existing = false) => {
    if (props.locked || !name.trim()) return;
    if (draft()) {
      setDraftBlocked(true);
      queueMicrotask(() => valueInput?.focus());
      return;
    }
    if (metadata().present && !metadata().readable) return;
    setError(null);
    setDraftBlocked(false);
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
    finish();
    setKey("");
  };
  const valueField = () => (
    <div class="property-value-editor">
      <PropertyValueInput
        label={`${draft()?.name} 값`}
        value={draftValue()}
        titles={props.titles ?? []}
        references={props.references}
        property={draft()?.name}
        typeValue={
          (draft()?.name === "type" || draft()?.name === "@type") &&
          draft()?.identity === props.documentKey &&
          draft()?.source === props.body
        }
        linkable={
          !!draft()?.linkable &&
          draft()?.name !== "type" &&
          draft()?.name !== "@type" &&
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
        onCancel={finish}
      />
      <button type="button" disabled={props.locked} onClick={commit}>
        추가 / 적용
      </button>
      <button type="button" onClick={finish}>
        취소
      </button>
      <PropertyAdvice
        property={draft()?.name}
        value={draftValue()}
        references={props.references ?? []}
      />
      <span class="property-help">확정 전에는 저장되지 않습니다.</span>
    </div>
  );
  return (
    <details ref={(element) => (panel = element)} class="note-properties">
      <summary>
        <span>속성</span>
        {metadata().present && !metadata().warning && (
          <span class="schema-type">{metadata().types.join(" · ")}</span>
        )}
        {warningVisible() && (
          <span class="property-validation-cue">확인 필요</span>
        )}
      </summary>
      <div class="property-content">
        {warningVisible() &&
          !(props.mode === "yaml" && !props.source && !draft()) && (
            <p class="property-warning" role="status">
              {metadata().warning}
            </p>
          )}
        {!metadata().present &&
          initialType() !== "Thing" &&
          (props.source || props.mode === "yaml") && (
            <p class="property-help">
              입력한 유형은 보관되어 있습니다. 속성 폼에서 이어서 편집할 수
              있습니다.
            </p>
          )}
        {props.source ? (
          <>
            <PropertyAdvice
              body={props.body}
              references={props.references ?? []}
            />
            <p class="property-help">
              전체 원문에서 속성을 편집하고 있습니다.
              {draft() && " 입력 중인 폼 값은 보관되어 있습니다."}
            </p>
          </>
        ) : (
          <>
            {draftBlocked() && (
              <p class="property-help" role="status">
                입력 중인 값을 적용하거나 취소해 주세요.
              </p>
            )}
            {draft() && props.mode === "yaml" && (
              <p class="property-help" role="status">
                입력 중인 값을 적용하거나 취소하면 YAML 편집기로 전환합니다.
              </p>
            )}
            {props.mode === "yaml" && !draft() ? (
              metadata().present ? (
                <>
                  <YamlEditor
                    value={metadata().yaml}
                    references={props.references}
                    contextKey={props.documentKey}
                    disabled={props.locked}
                    invalid={warningVisible()}
                    describedBy={
                      warningVisible()
                        ? "property-yaml-warning property-yaml-help"
                        : "property-yaml-help"
                    }
                    onEdit={() =>
                      setYamlEditing({ identity: props.documentKey })
                    }
                    onValidate={() => setYamlEditing(null)}
                    onChange={(yaml) =>
                      props.onChange(replaceFrontmatter(props.body, yaml))
                    }
                  />
                  {warningVisible() && (
                    <p
                      id="property-yaml-warning"
                      class="property-warning"
                      role="status"
                    >
                      {metadata().warning} 문법을 고치면 속성과 연결에
                      반영됩니다.
                    </p>
                  )}
                  <p id="property-yaml-help" class="property-help">
                    이름: 값 · type: Book. 입력한 원문은 자동 저장합니다. @ 또는
                    [[로 기존 노트를 검색하세요.
                  </p>
                  <PropertyAdvice
                    body={props.body}
                    references={props.references ?? []}
                  />
                </>
              ) : (
                <button
                  type="button"
                  disabled={props.locked}
                  onClick={() =>
                    props.onChange(replaceFrontmatter(props.body, ""))
                  }
                >
                  속성 YAML 추가
                </button>
              )
            ) : (
              <>
                <PropertyForm
                  initialType={initialType()}
                  onInitialTypeChange={setInitialType}
                  body={props.body}
                  metadata={metadata()}
                  locked={props.locked}
                  propertyKey={key()}
                  error={error()}
                  draft={draft()}
                  references={props.references}
                  valueEditor={valueField}
                  onBegin={begin}
                  onPropertyKey={setKey}
                  onSource={props.onSource}
                  onChange={props.onChange}
                />
              </>
            )}
          </>
        )}
      </div>
    </details>
  );
}
