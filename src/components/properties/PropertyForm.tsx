import { For } from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  canEditPropertyScalar,
  replaceFrontmatter,
  type Frontmatter,
} from "../../domain/frontmatter";
import type { NoteReference } from "../../schema/references";
import { PropertyRow } from "./PropertyRow";
import { PropertyPicker } from "./PropertyPicker";
import { PropertyCreateForm } from "./PropertyCreateForm";
import { PropertyAdvice } from "./PropertyAdvice";
export function PropertyForm(props: {
  body: string;
  initialType: string;
  onInitialTypeChange: (type: string) => void;
  metadata: Frontmatter;
  locked: boolean;
  propertyKey: string;
  error: string | null;
  draft: { name: string; existing: boolean } | null;
  references?: readonly NoteReference[];
  valueEditor: () => JSX.Element;
  onBegin: (name: string, existing?: boolean) => void;
  onPropertyKey: (key: string) => void;
  onSource?: () => void;
  onOpen?: (title: string) => void;
  onChange: (body: string) => void;
}) {
  return (
    <>
      {" "}
      {props.draft &&
        (!props.draft?.existing ||
          !props.metadata.properties.has(props.draft!.name)) &&
        props.valueEditor()}
      {props.error && (
        <p class="property-warning" role="alert">
          {props.error}
        </p>
      )}
      {props.metadata.present && !props.metadata.readable ? (
        <>
          <p class="property-help">
            속성을 읽을 수 없어 폼 편집을 잠시 멈췄습니다. 입력한 원문은
            보관됩니다.
          </p>
          <button type="button" onClick={props.onSource}>
            전체 원문에서 속성 수정
          </button>
        </>
      ) : props.metadata.present ? (
        <>
          <dl class="property-list">
            <For
              each={[...props.metadata.properties]}
              keyed={(item) => item[0]}
            >
              {(item) => (
                <>
                  <PropertyRow
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
          <div class="property-create">
            <PropertyPicker
              value={props.propertyKey}
              types={props.metadata.types}
              existingKeys={[...props.metadata.properties.keys()]}
              disabled={props.locked || !props.metadata.closed}
              onChange={props.onPropertyKey}
              onSelect={(name) => props.onBegin(name)}
            />
            <button
              type="button"
              disabled={
                props.locked ||
                !props.propertyKey.trim() ||
                !props.metadata.closed
              }
              onClick={() => props.onBegin(props.propertyKey)}
            >
              속성 넣기
            </button>
          </div>
          <PropertyAdvice
            body={props.body}
            references={props.references ?? []}
          />
          {(props.metadata.warning ||
            [...props.metadata.properties.keys()].some(
              (name) => !canEditPropertyScalar(props.body, name),
            )) && (
            <button type="button" onClick={props.onSource}>
              전체 원문에서 복잡한 속성 편집
            </button>
          )}
          {!props.metadata.closed && (
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
            value={props.initialType}
            onChange={props.onInitialTypeChange}
            disabled={props.locked}
            onCreate={(type) =>
              props.onChange(replaceFrontmatter(props.body, `type: ${type}`))
            }
          />
        </>
      )}
    </>
  );
}
