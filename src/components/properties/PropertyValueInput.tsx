import { createEffect, createMemo, createSignal, For, untrack } from "solid-js";
import {
  completePropertyNote,
  propertyNoteContext,
  propertyNoteTitles,
} from "./property-note-completion";
import { searchTypes, normalizeType } from "../../schema";
import {
  recommendNotes,
  noteTypeLabel,
  expectedTypes,
  type NoteReference,
} from "../../schema/references";
import type { PropertyNoteContext } from "./property-note-completion";

export interface PropertyValueInputProps {
  id?: string;
  label: string;
  value: string;
  titles: readonly string[];
  references?: readonly NoteReference[];
  property?: string;
  typeValue?: boolean;
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
    () => [props.contextKey, props.disabled, props.linkable, props.typeValue],
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
      (props.linkable || props.typeValue) &&
      pending.value === props.value &&
      pending.identity === props.contextKey
      ? pending
      : null;
  };
  const recommendations = createMemo(() =>
    recommendNotes(
      props.references ?? [],
      props.property ?? "",
      scope()?.context.query ?? "",
    ),
  );
  const details = createMemo(
    () =>
      new Map(
        recommendations().map((note) => [
          note.title,
          `${noteTypeLabel(note)} · ${note.compatibility === "mismatch" ? "권장 유형과 다름" : note.compatibility === "compatible" ? "권장 유형" : "유형 확인 필요"}`,
        ]),
      ),
  );
  const allOptions = createMemo(() =>
    !scope()
      ? []
      : props.typeValue
        ? searchTypes(normalizeType(props.value)).map((type) => type.id)
        : props.references
          ? recommendations().map((note) => note.title)
          : propertyNoteTitles(props.titles, scope()!.context.query),
  );
  const options = () => allOptions().slice(0, 20);
  const sameCaret = () =>
    !!scope() &&
    input.selectionStart === scope()!.context.to &&
    input.selectionEnd === scope()!.context.to;
  const update = () => {
    const context =
      !composing && !props.disabled && props.typeValue
        ? {
            from: 0,
            to: input.selectionStart ?? 0,
            query: input.value,
            closing: false,
          }
        : !composing && props.linkable && !props.disabled
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
    const edit = props.typeValue
      ? { value: title, caret: title.length }
      : completePropertyNote(input.value, pending.context, title);
    setMenu(null);
    input.focus();
    input.setSelectionRange(0, input.value.length);
    if (!document.execCommand?.("insertText", false, edit.value)) {
      input.value = edit.value;
      props.onChange(edit.value);
    }
    input.setSelectionRange(edit.caret, edit.caret);
    setMenu(null);
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
        role={props.linkable || props.typeValue ? "combobox" : undefined}
        aria-label={props.label}
        autocomplete="off"
        inputmode={props.inputmode ?? "text"}
        value={props.value}
        disabled={props.disabled}
        aria-autocomplete={
          props.linkable || props.typeValue ? "list" : undefined
        }
        aria-expanded={
          props.linkable || props.typeValue
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
        onFocus={() => {
          if (props.typeValue) update();
        }}
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
          {props.property &&
            expectedTypes(props.property).length > 0 &&
            ` 권장: ${expectedTypes(props.property).join(" 또는 ")}`}
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
          aria-label={props.typeValue ? "Schema.org 유형" : "기존 노트"}
        >
          <For each={options()} keyed={(title) => title}>
            {(title, index) => (
              <li
                id={`${id()}-note-${index()}`}
                role="option"
                aria-label={title()}
                aria-selected={active() === index() ? "true" : "false"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(title())}
              >
                <span>{title()}</span>
                {!props.typeValue && details().get(title()) && (
                  <small>{details().get(title())}</small>
                )}
              </li>
            )}
          </For>
        </ul>
      )}
      {scope() && allOptions().length > 20 && (
        <span class="property-help" role="status">
          처음 20개를 표시합니다. 검색어를 더 입력해 주세요.
        </span>
      )}
      {scope() && !options().length && (
        <p
          class="schema-options property-note-options property-help"
          role="status"
        >
          {props.typeValue
            ? "일치하는 유형이 없습니다. 사용자 정의 유형을 입력할 수 있습니다."
            : "일치하는 노트가 없습니다. 값을 직접 입력할 수 있습니다."}
        </p>
      )}
    </div>
  );
}
