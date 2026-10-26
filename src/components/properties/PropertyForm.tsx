import type { NotePreviewLookup } from "../../domain/note-preview";
import { Button } from "../../design-system/Button";
import { For, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  canEditPropertyScalar,
  type Frontmatter,
} from "../../domain/frontmatter";
import type { NoteReference } from "../../schema/references";
import { PropertyRow } from "./PropertyRow";
import { PropertyPicker } from "./PropertyPicker";
import { PropertyAdvice } from "./PropertyAdvice";
export function PropertyForm(props: {
  body: string;
  metadata: Frontmatter;
  locked: boolean;
  propertyKey: string;
  error: string | null;
  draft: { name: string; existing: boolean } | null;
  preview?: NotePreviewLookup;
  contextKey?: string;
  references?: readonly NoteReference[];
  valueEditor: () => JSX.Element;
  onBegin: (name: string, existing?: boolean) => void;
  onPropertyKey: (key: string) => void;
  onSource?: () => void;
  onOpen?: (title: string) => void;
}) {
  const [adding, setAdding] = createSignal(false);
  const begin = (name: string) => {
    if (!name.trim()) return;
    props.onBegin(name);
    setAdding(false);
  };
  const add = () => {
    if (props.draft) {
      props.onBegin(props.draft.name, props.draft.existing);
      return;
    }
    setAdding(true);
    queueMicrotask(() => document.getElementById("new-property-key")?.focus());
  };
  return (
    <>
      {props.error && (
        <p
          class="ui-feedback ui-feedback--warning property-warning"
          role="alert"
        >
          {props.error}
        </p>
      )}
      {props.metadata.present && !props.metadata.readable ? (
        <>
          {props.draft && props.valueEditor()}
          <p class="ui-field-help property-help">
            속성을 읽을 수 없어 폼 편집을 잠시 멈췄습니다. 입력한 원문은
            보관됩니다.
          </p>
          <Button type="button" onClick={props.onSource}>
            전체 원문에서 속성 수정
          </Button>
        </>
      ) : (
        <>
          <dl class="property-list">
            <For
              each={[...props.metadata.properties]}
              keyed={(item) => item[0]}
            >
              {(item) => (
                <>
                  <PropertyRow
                    preview={props.preview}
                    contextKey={props.contextKey}
                    name={item()[0]}
                    value={item()[1]}
                    editor={
                      props.draft?.existing && props.draft?.name === item()[0]
                        ? props.valueEditor()
                        : undefined
                    }
                    editable={canEditPropertyScalar(props.body, item()[0])}
                    disabled={props.locked}
                    onEdit={() => props.onBegin(item()[0], true)}
                    onSource={props.onSource}
                    onOpen={props.onOpen}
                  />
                </>
              )}
            </For>
          </dl>
          {props.draft &&
            (!props.draft.existing ||
              !props.metadata.properties.has(props.draft.name)) && (
              <div class="property-new-row">{props.valueEditor()}</div>
            )}
          {adding() && !props.draft && (
            <div class="property-create property-create--inline">
              <PropertyPicker
                value={props.propertyKey}
                types={props.metadata.types}
                existingKeys={[...props.metadata.properties.keys()]}
                disabled={props.locked}
                onChange={props.onPropertyKey}
                onSelect={begin}
                advanceOnTab
              />
              <Button
                size="compact"
                type="button"
                onClick={() => {
                  setAdding(false);
                  queueMicrotask(() =>
                    document.getElementById("add-property")?.focus(),
                  );
                }}
              >
                취소
              </Button>
            </div>
          )}
          {!adding() && (
            <Button
              id="add-property"
              aria-label="속성 추가"
              size="compact"
              class="property-add"
              type="button"
              disabled={
                props.locked ||
                (props.metadata.present && !props.metadata.closed)
              }
              onClick={add}
            >
              속성 추가
            </Button>
          )}
          <PropertyAdvice
            body={props.body}
            references={props.references ?? []}
          />
          {(props.metadata.warning ||
            [...props.metadata.properties.keys()].some(
              (name) => !canEditPropertyScalar(props.body, name),
            )) && (
            <Button type="button" onClick={props.onSource}>
              전체 원문에서 복잡한 속성 편집
            </Button>
          )}
          {props.metadata.present && !props.metadata.closed && (
            <p class="ui-field-help property-help">
              본문의 원문 보기에서 속성 마지막에 ---를 추가해 주세요.
            </p>
          )}
        </>
      )}
    </>
  );
}
