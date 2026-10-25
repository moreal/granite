import { isInNotePreviewBridge } from "./note-preview-bridge";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { Button } from "../../design-system/Button";
import type { NotePreview, NotePreviewLookup } from "../../domain/note-preview";
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
export function PropertyNoteLink(props: {
  title: string;
  disabled?: boolean;
  contextKey?: string;
  preview?: NotePreviewLookup;
  onOpen: (title: string) => void;
}) {
  const id = `note-link-preview-${++nextPreviewId}`;
  const [open, setOpen] = createSignal(false);
  const [shown, setShown] = createSignal<NotePreview | undefined>();
  let trigger!: HTMLButtonElement, popup!: HTMLSpanElement;
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
    () => {
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
    },
  );
  onCleanup(hide);
  return (
    <span class="property-note-anchor">
      <Button
        ref={(element) => {
          trigger = element;
        }}
        layout="inline"
        class="property-note-link"
        disabled={props.disabled}
        aria-label={`${props.title} 노트 열기`}
        aria-describedby={open() ? id : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          pointerFocus = true;
          if (event.pointerType === "touch") {
            dismissed = true;
            hide();
          }
        }}
        onPointerUp={() => {
          pointerFocus = false;
        }}
        onPointerCancel={() => {
          pointerFocus = false;
        }}
        onPointerEnter={(event) => {
          if (
            !["mouse", "pen"].includes(event.pointerType) ||
            !matchMedia("(hover: hover)").matches
          )
            return;
          hovered = true;
          dismissed = false;
          clearTimer();
          if (!open())
            timer = setTimeout(show, delay("--delay-note-preview-open"));
        }}
        onPointerLeave={(event) => {
          pointer = { x: event.clientX, y: event.clientY };
          hovered = false;
          pointerFocus = false;
          leave();
        }}
        onFocus={() => {
          focused = true;
          if (!pointerFocus) {
            dismissed = false;
            show();
          }
        }}
        onBlur={() => {
          focused = false;
          leave();
        }}
        onClick={() => {
          dismissed = true;
          hide();
          props.onOpen(props.title);
        }}
      >
        {props.title}
      </Button>
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
