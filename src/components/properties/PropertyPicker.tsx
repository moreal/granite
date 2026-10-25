import { suggestProperties } from "../../schema";
import { SchemaPicker } from "./SchemaPicker";
export interface PropertyPickerProps {
  id?: string;
  value: string;
  types: readonly string[];
  existingKeys: readonly string[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}
export function PropertyPicker(props: PropertyPickerProps) {
  return (
    <SchemaPicker
      id={props.id ?? "new-property-key"}
      label="속성 이름 검색"
      value={props.value}
      disabled={props.disabled}
      options={suggestProperties(
        props.types,
        props.existingKeys,
        props.value,
      ).map((property) => ({
        ...property,
        detail: property.ranges.join(" · "),
      }))}
      onChange={props.onChange}
      onSelect={props.onSelect}
    />
  );
}
