import { isInNotePreviewBridge } from "./properties/note-preview-bridge";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { Button } from "../design-system/Button";
import type { JSX } from "@solidjs/web";
import { onSettled } from "solid-js";
import type { NotePreview, NotePreviewLookup } from "../domain/note-preview";
/** CSS optimization can express duration tokens as seconds or milliseconds. */
export function cssTimeMilliseconds(time: string): number {
  const text = time.trim();
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return 0;
  if (text.endsWith("ms")) return Math.max(0, value);
  if (text.endsWith("s")) return Math.max(0, value * 1000);
  return 0;
}
let nextPreviewId = 0;
let dismissActive: (() => void) | undefined;
/** Inline navigation stays native. This component owns only a read-only preview. */
export function NoteLinkPreview(props: {
  anchor?: HTMLElement;
  children?: JSX.Element;
  class?: string;
  layout?: "inline" | "list";
  title: string;
  disabled?: boolean;
  contextKey?: string;
  preview?: NotePreviewLookup;
  onOpen: (title: string) => void;
}) {
  const id = `note-link-preview-${++nextPreviewId}`;
  const [open, setOpen] = createSignal(false);
  const [shown, setShown] = createSignal<NotePreview | undefined>();
  let trigger!: HTMLElement, popup!: HTMLSpanElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false,
    popupHovered = false,
    focused = false,
    pointerFocus = false,
    dismissed = false;
  let fingerprint = "";
  let pointer: { x: number; y: number } | undefined;
  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const hide = () => {
    clearTimer();
    if (open() && popup?.hidePopover) popup.hidePopover();
    setOpen(false);
    document.removeEventListener("keydown", escape, true);
    document.removeEventListener("scroll", scroll, true);
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("pointermove", trackPointer, true);
    pointer = undefined;
    window.removeEventListener("resize", hide);
    if (dismissActive === hide) dismissActive = undefined;
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dismissed = true;
    hide();
  };
  const scroll = (event: Event) => {
    if (!popup.contains(event.target as Node)) hide();
  };
  const outside = (event: PointerEvent) => {
    if (
      event.pointerType === "touch" ||
      (!trigger.contains(event.target as Node) &&
        !popup.contains(event.target as Node))
    )
      hide();
  };
  const inBridge = () =>
    !!pointer &&
    open() &&
    isInNotePreviewBridge(
      pointer,
      trigger.getBoundingClientRect(),
      popup.getBoundingClientRect(),
    );
  const trackPointer = (event: PointerEvent) => {
    if (!["mouse", "pen"].includes(event.pointerType)) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (hovered || popupHovered || focused || inBridge()) clearTimer();
    else if (timer === undefined)
      timer = setTimeout(hide, delay("--delay-note-preview-close"));
  };
  const delay = (name: string) =>
    cssTimeMilliseconds(getComputedStyle(popup).getPropertyValue(name));
  const position = () => {
    const anchor = trigger.getBoundingClientRect(),
      card = popup.getBoundingClientRect();
    const style = getComputedStyle(popup);
    const gutter = parseFloat(style.getPropertyValue("--space-3")),
      gap = parseFloat(style.getPropertyValue("--space-2"));
    const left = Math.max(
      gutter,
      Math.min(anchor.left, innerWidth - card.width - gutter),
    );
    const below = anchor.bottom + gap;
    const top =
      below + card.height <= innerHeight - gutter
        ? below
        : Math.max(gutter, anchor.top - card.height - gap);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };
  const show = () => {
    clearTimer();
    if (
      dismissed ||
      props.disabled ||
      !props.preview ||
      !trigger.isConnected ||
      !popup.showPopover
    )
      return;
    dismissActive?.();
    const value = props.preview(props.title);
    fingerprint = JSON.stringify([props.contextKey, props.title, value]);
    setShown(value);
    popup.showPopover();
    position();
    setOpen(true);
    dismissActive = hide;
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("pointermove", trackPointer, true);
    window.addEventListener("resize", hide);
    // Reactive text can settle after the native top-layer surface becomes visible.
    queueMicrotask(() => {
      if (popup.isConnected && open()) position();
    });
  };
  const leave = () => {
    clearTimer();
    if (open() && !hovered && !popupHovered && !focused && !inBridge())
      timer = setTimeout(hide, delay("--delay-note-preview-close"));
  };
  createEffect(
    () => [
      props.disabled,
      props.contextKey,
      props.title,
      open() ? JSON.stringify(props.preview?.(props.title)) : "",
    ],
    () =>
      untrack(() => {
        if (
          open() &&
          (props.disabled ||
            fingerprint !==
              JSON.stringify([
                props.contextKey,
                props.title,
                props.preview?.(props.title),
              ]))
        )
          hide();
      }),
  );
  createEffect(
    () => [open(), props.disabled] as const,
    ([isOpen, disabled]) => {
      if (!props.anchor) return;
      if (isOpen) props.anchor.setAttribute("aria-describedby", id);
      else props.anchor.removeAttribute("aria-describedby");
      if (disabled) untrack(hide);
    },
  );
  onCleanup(hide);
  const events = {
    onPointerDown: (event: PointerEvent) => {
      pointerFocus = true;
      if (event.pointerType === "touch") {
        dismissed = true;
        hide();
      }
    },
    onPointerUp: () => {
      pointerFocus = false;
    },
    onPointerCancel: () => {
      pointerFocus = false;
    },
    onPointerEnter: (event: PointerEvent) => {
      if (
        !["mouse", "pen"].includes(event.pointerType) ||
        !matchMedia("(hover: hover)").matches
      )
        return;
      hovered = true;
      dismissed = false;
      clearTimer();
      if (!open()) timer = setTimeout(show, delay("--delay-note-preview-open"));
    },
    onPointerLeave: (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      hovered = false;
      pointerFocus = false;
      leave();
    },
    onFocus: () => {
      focused = true;
      if (!pointerFocus) {
        dismissed = false;
        show();
      }
    },
    onBlur: () => {
      focused = false;
      leave();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (
        !props.anchor ||
        event.key !== "Enter" ||
        event.isComposing ||
        props.disabled
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      dismissed = true;
      hide();
      props.onOpen(props.title);
    },
    onClick: () => {
      dismissed = true;
      hide();
      if (!props.anchor) props.onOpen(props.title);
    },
  };
  onSettled(() => {
    if (!props.anchor) return;
    trigger = props.anchor;
    const listeners = Object.entries(events).map(([name, handler]) => {
      const type = name.slice(2).toLowerCase();
      const listener = handler as EventListener;
      trigger.addEventListener(type, listener);
      return () => trigger.removeEventListener(type, listener);
    });
    return () => listeners.forEach((remove) => remove());
  });

  return (
    <span class="property-note-anchor">
      {!props.anchor && (
        <Button
          ref={(element) => {
            trigger = element;
          }}
          layout={props.layout ?? "inline"}
          class={props.class ?? "property-note-link"}
          disabled={props.disabled}
          aria-label={`${props.title} 노트 열기`}
          aria-describedby={open() ? id : undefined}
          onMouseDown={(event) => {
            if (props.layout !== "list") event.preventDefault();
          }}
          onPointerDown={events.onPointerDown}
          onPointerUp={events.onPointerUp}
          onPointerCancel={events.onPointerCancel}
          onPointerEnter={events.onPointerEnter}
          onPointerLeave={events.onPointerLeave}
          onFocus={events.onFocus}
          onBlur={events.onBlur}
          onClick={events.onClick}
        >
          {props.children ?? props.title}
        </Button>
      )}
      <span
        ref={(element) => {
          popup = element;
        }}
        id={id}
        popover="manual"
        role="tooltip"
        class="note-link-preview"
        onPointerEnter={() => {
          popupHovered = true;
          clearTimer();
        }}
        onPointerLeave={(event) => {
          pointer = { x: event.clientX, y: event.clientY };
          popupHovered = false;
          leave();
        }}
      >
        <strong class="note-link-preview-title">{props.title}</strong>
        <span class="note-link-preview-excerpt">
          {shown()
            ? shown()!.excerpt || "아직 내용이 없는 노트입니다."
            : "아직 없는 노트입니다. 클릭하면 만들기를 확인합니다."}
        </span>
      </span>
    </span>
  );
}
