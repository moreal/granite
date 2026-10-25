import { textareaChange } from "./yaml-text";
import { createEffect, createMemo, createSignal, For, untrack } from "solid-js";
import {
  propertyCompletionScope,
  propertyCompletionOptions,
  planPropertyCompletion,
  type PropertyCompletionScope,
} from "../../schema/property-completions";
import type { NoteReference } from "../../schema/references";
export interface YamlEditorProps {
  id?: string;
  value: string;
  disabled?: boolean;
  contextKey?: string;
  references?: readonly NoteReference[];
  onChange: (value: string) => void;
  onReady?: (element: HTMLTextAreaElement) => void;
}
export function YamlEditor(props: YamlEditorProps) {
  const [scope, setScope] = createSignal<PropertyCompletionScope | null>(null);
  const [active, setActive] = createSignal(0);
  let textarea!: HTMLTextAreaElement, list: HTMLUListElement | undefined;
  let composing = false,
    caret = -1,
    identity: string | undefined;
  createEffect(
    () => [props.contextKey, props.disabled],
    () => {
      setScope(null);
    },
  );
  createEffect(
    () => props.value,
    (value) => {
      // Echoes of native edits must not write value again: input interceptors
      // can reset selection/undo even when the assigned text is identical.
      const normalized = value.replace(/\r\n/g, "\n");
      if (textarea.value !== normalized) textarea.value = normalized;
    },
  );
  const current = () =>
    !props.disabled &&
    scope()?.context.source === props.value.replace(/\r\n/g, "\n") &&
    identity === props.contextKey
      ? scope()
      : null;
  const allOptions = createMemo(() =>
    current()
      ? propertyCompletionOptions(current()!, props.references ?? [])
      : [],
  );
  const options = () => allOptions().slice(0, 20);
  const sameCaret = () =>
    textarea.selectionStart === caret && textarea.selectionEnd === caret;
  const id = () => props.id ?? "property-yaml";
  const update = () => {
    caret = textarea.selectionStart;
    identity = props.contextKey;
    setScope(
      composing || props.disabled || textarea.selectionEnd !== caret
        ? null
        : propertyCompletionScope(textarea.value, caret),
    );
    setActive(0);
  };
  const choose = (name: string) => {
    const pending = current();
    if (
      props.disabled ||
      composing ||
      !pending ||
      !sameCaret() ||
      !options().some((option) => option.id === name)
    ) {
      setScope(null);
      return;
    }
    const edit = planPropertyCompletion(textarea.value, pending, name);
    if (!edit) return;
    setScope(null);
    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    if (!document.execCommand?.("insertText", false, edit.insert)) {
      textarea.setRangeText(edit.insert, edit.from, edit.to, "end");
      props.onChange(textareaChange(props.value, textarea.value));
    }
    setScope(null);
  };
  const move = (direction: number) => {
    if (!sameCaret()) {
      setScope(null);
      return;
    }
    const next = Math.max(
      0,
      Math.min(options().length - 1, active() + direction),
    );
    setActive(next);
    const row = list?.children[next] as HTMLElement | undefined;
    if (list && row) {
      const a = list.getBoundingClientRect(),
        b = row.getBoundingClientRect();
      const top = a.top + list.clientTop,
        bottom = top + list.clientHeight;
      if (b.top < top) list.scrollTop += b.top - top;
      else if (b.bottom > bottom) list.scrollTop += b.bottom - bottom;
    }
  };
  return (
    <div class="yaml-editor">
      <label class="property-source-label" for={id()}>
        속성 YAML 원문
      </label>
      <textarea
        ref={(element) => {
          textarea = element;
          untrack(() => props.onReady?.(element));
        }}
        id={id()}
        aria-label="속성 YAML 원문"
        spellcheck={false}
        disabled={props.disabled}
        aria-autocomplete="list"
        aria-controls={`${id()}-options`}
        aria-expanded={!!current() && options().length > 0 ? "true" : "false"}
        aria-activedescendant={
          current() && options()[active()]
            ? `${id()}-option-${active()}`
            : undefined
        }
        onInput={(event) => {
          props.onChange(
            textareaChange(props.value, event.currentTarget.value),
          );
          update();
        }}
        onClick={update}
        onSelect={() => {
          if (!sameCaret()) setScope(null);
        }}
        onBlur={() => setScope(null)}
        onCompositionStart={() => {
          composing = true;
          setScope(null);
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
            setScope(null);
            return;
          }
          if (event.key === "Escape") {
            setScope(null);
            event.preventDefault();
          } else if (event.ctrlKey && event.key === " ") {
            event.preventDefault();
            update();
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
          )
            setScope(null);
          else if (
            current() &&
            options().length &&
            ["ArrowDown", "ArrowUp"].includes(event.key)
          ) {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
          } else if (
            event.key === "Enter" &&
            current() &&
            options()[active()]
          ) {
            event.preventDefault();
            choose(options()[active()].id);
          }
        }}
      />
      {current() && allOptions().length > 20 && (
        <p class="property-help" role="status">
          처음 20개를 표시합니다. 검색어를 더 입력해 주세요.
        </p>
      )}
      {current() && options().length > 0 && (
        <ul
          ref={(element) => {
            list = element;
          }}
          class="schema-options"
          role="listbox"
          id={`${id()}-options`}
        >
          <For each={options()} keyed={(option) => option.id}>
            {(option, index) => (
              <li
                role="option"
                id={`${id()}-option-${index()}`}
                aria-selected={active() === index() ? "true" : "false"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option().id)}
              >
                <strong>{option().id}</strong>
                <span>{option().detail}</span>
                <small>{option().description}</small>
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  );
}
