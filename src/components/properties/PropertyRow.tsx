import { Button } from "../../design-system/Button";
import type { JSX } from "@solidjs/web";
import { createMemo } from "solid-js";
import { propertyText } from "../../domain/frontmatter";
import { parseWikiLinks } from "../../domain/links";
export interface PropertyRowProps {
  editor?: JSX.Element;
  name: string;
  value: unknown;
  editable?: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onSource?: () => void;
  onOpen?: (title: string) => void;
}
export function PropertyRow(props: PropertyRowProps) {
  const values = createMemo(() =>
    Array.isArray(props.value) ? props.value : [props.value],
  );
  const linked = createMemo(
    () =>
      !!props.onOpen &&
      props.name !== "type" &&
      props.name !== "@type" &&
      values().some(
        (value) => typeof value === "string" && parseWikiLinks(value).length,
      ),
  );
  const edit = () => (props.editable ? props.onEdit?.() : props.onSource?.());
  const display = (value: unknown): JSX.Element => {
    if (typeof value !== "string") return propertyText(value);
    const pieces: JSX.Element[] = [];
    let from = 0;
    for (const link of parseWikiLinks(value)) {
      pieces.push(value.slice(from, link.from));
      pieces.push(
        <Button
          type="button"
          layout="inline"
          class="property-note-link"
          disabled={props.disabled}
          aria-label={`${link.title} 노트 열기`}
          // Keep an open input menu from moving this target during the click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onOpen?.(link.title)}
        >
          {link.title}
        </Button>,
      );
      from = link.to;
    }
    pieces.push(value.slice(from));
    return pieces;
  };
  return (
    <div class="property-row">
      <dt>{props.name}</dt>
      <dd>
        {props.editor ??
          (linked() ? (
            <div class="property-linked-value">
              <span class="property-value-text">
                {values().flatMap((value, index) => [
                  index ? ", " : "",
                  display(value),
                ])}
              </span>
              {props.onEdit && (
                <Button
                  type="button"
                  class="property-edit-button"
                  disabled={props.disabled}
                  data-property={props.name}
                  onClick={edit}
                  aria-label={`${props.name} ${props.editable ? "값 편집" : "원문 편집"}`}
                >
                  {props.editable ? "편집" : "원문 편집"}
                </Button>
              )}
            </div>
          ) : props.onEdit ? (
            <Button
              type="button"
              disabled={props.disabled}
              layout="list"
              class="property-value-button"
              data-property={props.name}
              onClick={edit}
              aria-label={`${props.name} ${props.editable ? "값 편집" : "원문 편집"}`}
            >
              {propertyText(props.value)}
            </Button>
          ) : (
            propertyText(props.value)
          ))}
      </dd>
    </div>
  );
}
