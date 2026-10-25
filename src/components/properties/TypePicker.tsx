import { searchTypes } from "../../schema";
import { SchemaPicker } from "./SchemaPicker";
export interface TypePickerProps {
  id?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}
export function TypePicker(props: TypePickerProps) {
  return (
    <SchemaPicker
      id={props.id ?? "new-property-type"}
      label="노트 유형"
      value={props.value}
      disabled={props.disabled}
      options={searchTypes(props.value)}
      onChange={props.onChange}
      onSelect={props.onSelect}
    />
  );
}
