import type { JSX } from "@solidjs/web";
import { propertyText } from "../../domain/frontmatter";
export interface PropertyRowProps {
  editor?: JSX.Element;
  name: string;
  value: unknown;
  editable?: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onSource?: () => void;
}
export function PropertyRow(props: PropertyRowProps) {
  return (
    <div class="property-row">
      <dt>{props.name}</dt>
      <dd>
        {props.editor ??
          (props.onEdit ? (
            <button
              type="button"
              disabled={props.disabled}
              class="property-value-button"
              onClick={() =>
                props.editable ? props.onEdit?.() : props.onSource?.()
              }
              aria-label={`${props.name} ${props.editable ? "값 편집" : "원문 편집"}`}
            >
              {propertyText(props.value)}
            </button>
          ) : (
            propertyText(props.value)
          ))}
      </dd>
    </div>
  );
}
