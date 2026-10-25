import { Button } from "../../design-system/Button";
import { createSignal } from "solid-js";
import { TypePicker } from "./TypePicker";
export interface PropertyCreateFormProps {
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onCreate: (type: string) => void;
}
export function PropertyCreateForm(props: PropertyCreateFormProps) {
  const [type, setType] = createSignal("Thing");
  const value = () => props.value ?? type();
  const change = (next: string) =>
    props.onChange ? props.onChange(next) : setType(next);
  return (
    <div class="property-create">
      <TypePicker
        value={value()}
        disabled={props.disabled}
        onChange={change}
        onSelect={change}
      />
      <Button
        class="property-create-action"
        variant="secondary"
        type="button"
        disabled={
          props.disabled || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(value())
        }
        onClick={() => props.onCreate(value())}
      >
        속성 추가
      </Button>
    </div>
  );
}
