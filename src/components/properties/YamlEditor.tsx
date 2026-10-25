import { textareaChange } from "./yaml-text";
import { createSignal, For, untrack } from "solid-js";
import {
  completionContext,
  planCompletion,
  searchTypes,
  suggestProperties,
} from "../../schema";
import type { CompletionContext } from "../../schema";
export interface YamlEditorProps {
  id?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onReady?: (element: HTMLTextAreaElement) => void;
}
export function YamlEditor(props: YamlEditorProps) {
  const [scope, setScope] = createSignal<CompletionContext | null>(null);
  const [active, setActive] = createSignal(0);
  let textarea!: HTMLTextAreaElement;
  let composing = false;
  let completionCaret = -1;
  const sameCaret = () =>
    textarea.selectionStart === completionCaret &&
    textarea.selectionEnd === completionCaret;
  const id = () => props.id ?? "property-yaml";
  const options = () => {
    const context = scope();
    return !context
      ? []
      : context.kind === "type"
        ? searchTypes(context.prefix)
        : suggestProperties(
            context.types,
            context.existingKeys,
            context.prefix,
          );
  };
  const update = () => {
    completionCaret = textarea.selectionStart;
    setScope(
      composing || textarea.selectionEnd !== completionCaret
        ? null
        : completionContext(textarea.value, textarea.selectionStart),
    );
    setActive(0);
  };
  const choose = (name: string) => {
    if (props.disabled || composing || !sameCaret()) {
      setScope(null);
      return;
    }
    const context = scope();
    const edit = context && planCompletion(textarea.value, context, name);
    if (!edit) return;
    // Chromium native replacement preserves undo and the normal input path.
    // Other engines retain a safe text replacement fallback without an undo guarantee.
    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    const inserted = document.execCommand?.("insertText", false, edit.insert);
    if (!inserted) {
      textarea.setRangeText(edit.insert, edit.from, edit.to, "end");
      props.onChange(textareaChange(props.value, textarea.value));
    }
    setScope(null);
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
        value={props.value}
        disabled={props.disabled}
        aria-autocomplete="list"
        aria-controls={`${id()}-options`}
        aria-expanded={!!scope() && options().length > 0 ? "true" : "false"}
        aria-activedescendant={
          scope() && options()[active()]
            ? `${id()}-option-${active()}`
            : undefined
        }
        onInput={(e) => {
          props.onChange(textareaChange(props.value, e.target.value));
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
        onKeyDown={(e) => {
          if (composing || e.isComposing || props.disabled) return;
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(e.key)
          ) {
            setScope(null);
          } else if (e.key === "Escape") {
            setScope(null);
            e.preventDefault();
          } else if (e.ctrlKey && e.key === " ") {
            e.preventDefault();
            update();
          } else if (
            scope() &&
            options().length &&
            (e.key === "ArrowDown" || e.key === "ArrowUp")
          ) {
            e.preventDefault();
            setActive((value) =>
              Math.max(
                0,
                Math.min(
                  options().length - 1,
                  value + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          } else if (e.key === "Enter" && scope() && options()[active()]) {
            e.preventDefault();
            choose(options()[active()].id);
          }
        }}
      />
      {scope() && options().length > 0 && (
        <ul class="schema-options" role="listbox" id={`${id()}-options`}>
          <For each={options()} keyed={(option) => option.id}>
            {(option, index) => (
              <li
                role="option"
                id={`${id()}-option-${index()}`}
                aria-selected={active() === index() ? "true" : "false"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option().id)}
              >
                <strong>{option().id}</strong>
                <span>
                  {"ranges" in option()
                    ? (option() as { ranges: string[] }).ranges.join(" · ")
                    : ""}
                </span>
                <small>{option().description}</small>
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  );
}
