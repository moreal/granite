import { createSignal, createEffect, onSettled, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
export function Dialog(props: {
  title: string;
  width?: "default" | "settings";
  focusKey?: unknown;
  onClose: () => void;
  children: JSX.Element;
}) {
  const panel = { current: null } as {
    current: HTMLDivElement | null;
  };
  onSettled(() =>
    untrack(() => {
      const previous = document.activeElement as HTMLElement;
      queueMicrotask(() =>
        panel.current
          ?.querySelector<HTMLElement>("input,button,textarea,select")
          ?.focus(),
      );
      return () => previous?.focus();
    }),
  );
  createEffect(
    () => props.focusKey,
    () =>
      untrack(() => {
        queueMicrotask(() =>
          panel.current
            ?.querySelector<HTMLElement>("input,button,textarea,select")
            ?.focus(),
        );
      }),
  );
  return (
    <div
      class="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class={`dialog dialog--${props.width ?? "default"}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        ref={(element) => (panel.current = element)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            props.onClose();
          }
          if (e.key === "Tab") {
            const els = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
            );
            if (!els?.length) return;
            const first = els[0],
              last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}
