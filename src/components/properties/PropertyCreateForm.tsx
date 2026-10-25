import { createSignal } from "solid-js";
import { TypePicker } from "./TypePicker";
export interface PropertyCreateFormProps {
  disabled?: boolean;
  onCreate: (type: string) => void;
}
export function PropertyCreateForm(props: PropertyCreateFormProps) {
  const [type, setType] = createSignal("Thing");
  return (
    <div class="property-create">
      <TypePicker
        value={type()}
        disabled={props.disabled}
        onChange={setType}
        onSelect={setType}
      />
      <button
        type="button"
        disabled={
          props.disabled || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(type())
        }
        onClick={() => props.onCreate(type())}
      >
        속성 추가
      </button>
    </div>
  );
}
