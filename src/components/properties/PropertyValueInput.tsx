import { createEffect, createMemo, createSignal, For, untrack } from "solid-js";
import {
  completePropertyNote,
  propertyNoteContext,
  propertyNoteTitles,
} from "./property-note-completion";
import type { PropertyNoteContext } from "./property-note-completion";

export interface PropertyValueInputProps {
  id?: string;
  label: string;
  value: string;
  titles: readonly string[];
  linkable: boolean;
  inputmode?: "text" | "decimal";
  disabled?: boolean;
  /** Changes whenever the document/source owning this draft becomes stale. */
  contextKey?: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onReady?: (input: HTMLInputElement) => void;
}

export function PropertyValueInput(props: PropertyValueInputProps) {
  const [menu, setMenu] = createSignal<{
    context: PropertyNoteContext;
    value: string;
    identity: string | undefined;
  } | null>(null);
  const [active, setActive] = createSignal(0);
  let input!: HTMLInputElement;
  let list: HTMLUListElement | undefined;
  let composing = false;
  createEffect(
    () => [props.contextKey, props.disabled, props.linkable],
    () => {
      setMenu(null);
      setActive(0);
    },
  );
  const id = () => props.id ?? "property-value";
  const scope = () => {
    const pending = menu();
    return pending &&
      !props.disabled &&
      props.linkable &&
      pending.value === props.value &&
      pending.identity === props.contextKey
      ? pending
      : null;
  };
  const options = createMemo(() =>
    scope() ? propertyNoteTitles(props.titles, scope()!.context.query) : [],
  );
  const sameCaret = () =>
    !!scope() &&
    input.selectionStart === scope()!.context.to &&
    input.selectionEnd === scope()!.context.to;
  const update = () => {
    const context =
      !composing && props.linkable && !props.disabled
        ? propertyNoteContext(
            input.value,
            input.selectionStart ?? 0,
            input.selectionEnd ?? 0,
          )
        : null;
    setMenu(
      context
        ? { context, value: input.value, identity: props.contextKey }
        : null,
    );
    setActive(0);
  };
  const choose = (title: string) => {
    const pending = scope();
    if (
      composing ||
      !pending ||
      !sameCaret() ||
      input.value !== pending.value ||
      !options().includes(title)
    ) {
      setMenu(null);
      return;
    }
    const edit = completePropertyNote(input.value, pending.context, title);
    setMenu(null);
    input.value = edit.value;
    props.onChange(edit.value);
    input.focus();
    input.setSelectionRange(edit.caret, edit.caret);
  };
  return (
    <div class="property-value-input">
      <label for={id()}>{props.label}</label>
      <input
        ref={(element) => {
          input = element;
          untrack(() => props.onReady?.(element));
        }}
        id={id()}
        role={props.linkable ? "combobox" : undefined}
        aria-label={props.label}
        autocomplete="off"
        inputmode={props.inputmode ?? "text"}
        value={props.value}
        disabled={props.disabled}
        aria-autocomplete={props.linkable ? "list" : undefined}
        aria-expanded={
          props.linkable
            ? scope() && options().length > 0
              ? "true"
              : "false"
            : undefined
        }
        aria-controls={
          scope() && options().length > 0 ? `${id()}-notes` : undefined
        }
        aria-activedescendant={
          scope() && options()[active()]
            ? `${id()}-note-${active()}`
            : undefined
        }
        aria-describedby={props.linkable ? `${id()}-help` : undefined}
        onInput={(event) => {
          props.onChange(event.currentTarget.value);
          update();
        }}
        onClick={update}
        onSelect={() => {
          if (!sameCaret()) setMenu(null);
        }}
        onBlur={() => setMenu(null)}
        onCompositionStart={() => {
          composing = true;
          setMenu(null);
        }}
        onCompositionEnd={() => {
          composing = false;
        }}
        onKeyDown={(event) => {
          if (
            composing ||
            event.isComposing ||
            event.keyCode === 229 ||
            props.disabled
          )
            return;
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "s"
          ) {
            setMenu(null);
            props.onCommit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (scope()) setMenu(null);
            else props.onCancel();
          } else if (
            scope() &&
            ["ArrowDown", "ArrowUp"].includes(event.key) &&
            !event.shiftKey
          ) {
            event.preventDefault();
            if (!sameCaret()) {
              setMenu(null);
              return;
            }
            const next = Math.max(
              0,
              Math.min(
                options().length - 1,
                active() + (event.key === "ArrowDown" ? 1 : -1),
              ),
            );
            setActive(next);
            const row = list?.children[next] as HTMLElement | undefined;
            if (list && row) {
              const viewport = list.getBoundingClientRect();
              const bounds = row.getBoundingClientRect();
              const top = viewport.top + list.clientTop;
              const bottom = top + list.clientHeight;
              // Scroll this popup only: keep the page and input focus still.
              if (bounds.top < top) list.scrollTop += bounds.top - top;
              else if (bounds.bottom > bottom)
                list.scrollTop += bounds.bottom - bottom;
            }
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (scope() && options()[active()]) choose(options()[active()]);
            else {
              setMenu(null);
              props.onCommit();
            }
          } else if (
            [
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "PageUp",
              "PageDown",
              "Tab",
            ].includes(event.key) ||
            (event.shiftKey && ["ArrowDown", "ArrowUp"].includes(event.key)) ||
            ((event.metaKey || event.ctrlKey) &&
              event.key.toLowerCase() === "a")
          ) {
            setMenu(null);
          }
        }}
      />
      {props.linkable && (
        <span id={`${id()}-help`} class="property-help">
          @ 또는 [[로 기존 노트를 연결하세요.
        </span>
      )}
      {scope() && options().length > 0 && (
        <ul
          ref={(element) => {
            list = element;
          }}
          id={`${id()}-notes`}
          class="schema-options property-note-options"
          role="listbox"
          aria-label="기존 노트"
        >
          <For each={options()} keyed={(title) => title}>
            {(title, index) => (
              <li
                id={`${id()}-note-${index()}`}
                role="option"
                aria-selected={active() === index() ? "true" : "false"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(title())}
              >
                {title()}
              </li>
            )}
          </For>
        </ul>
      )}
      {scope() && !options().length && (
        <p
          class="schema-options property-note-options property-help"
          role="status"
        >
          일치하는 노트가 없습니다. 값을 직접 입력할 수 있습니다.
        </p>
      )}
    </div>
  );
}
