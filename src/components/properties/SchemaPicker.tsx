import { createSignal, For } from "solid-js";
export interface PickerOption {
  id: string;
  description: string;
  detail?: string;
}
export interface SchemaPickerProps {
  id: string;
  label: string;
  value: string;
  options: readonly PickerOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}
/** A text input always permits custom identifiers; suggestions are optional. */
export function SchemaPicker(props: SchemaPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  let composing = false;
  let list: HTMLUListElement | undefined;
  const revealActive = () =>
    queueMicrotask(() => {
      if (!open() || props.disabled || !list?.isConnected) return;
      const row = list.children[active()] as HTMLElement | undefined;
      if (!row) return;
      const viewport = list.getBoundingClientRect(),
        bounds = row.getBoundingClientRect();
      const top = viewport.top + list.clientTop,
        bottom = top + list.clientHeight;
      if (bounds.top < top) list.scrollTop += bounds.top - top;
      else if (bounds.bottom > bottom) list.scrollTop += bounds.bottom - bottom;
    });
  const choose = (value: string) => {
    if (!props.disabled && !composing) {
      props.onSelect(value);
      setOpen(false);
    }
  };
  return (
    <div class="schema-picker">
      <label for={props.id}>{props.label}</label>
      <input
        id={props.id}
        role="combobox"
        autocomplete="off"
        value={props.value}
        disabled={props.disabled}
        aria-autocomplete="list"
        aria-expanded={open() && !props.disabled ? "true" : "false"}
        aria-controls={`${props.id}-options`}
        aria-activedescendant={
          open() && props.options[active()]
            ? `${props.id}-option-${active()}`
            : undefined
        }
        onFocus={() => {
          setOpen(true);
          revealActive();
        }}
        onBlur={() => setOpen(false)}
        onCompositionStart={() => {
          composing = true;
        }}
        onCompositionEnd={() => {
          composing = false;
        }}
        onInput={(e) => {
          props.onChange(e.target.value);
          setActive(0);
          setOpen(true);
          revealActive();
        }}
        onKeyDown={(e) => {
          if (composing || e.isComposing || props.disabled) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            const next = Math.max(
              0,
              Math.min(
                props.options.length - 1,
                active() + (e.key === "ArrowDown" ? 1 : -1),
              ),
            );
            setActive(next);
            revealActive();
          } else if (e.key === "Enter" && open()) {
            e.preventDefault();
            choose(props.options[active()]?.id ?? props.value);
          }
        }}
      />
      {open() && !props.disabled && (
        <ul
          ref={(element) => (list = element)}
          id={`${props.id}-options`}
          role="listbox"
          class="schema-options"
        >
          <For each={props.options} keyed={(option) => option.id}>
            {(option, index) => (
              <li
                id={`${props.id}-option-${index()}`}
                role="option"
                aria-selected={active() === index() ? "true" : "false"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option().id)}
              >
                <strong>{option().id}</strong>
                <span>{option().detail}</span>
                <small>{option().description}</small>
              </li>
            )}
          </For>
          {!props.options.length && (
            <li class="property-help">
              일치하는 추천이 없습니다. 사용자 정의 이름을 입력할 수 있습니다.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
