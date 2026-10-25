import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "quiet" | "secondary" | "primary" | "danger";
  size?: "default" | "comfortable" | "compact";
  layout?: "action" | "icon" | "list" | "inline";
};

/** Native button contract. Features retain focus, completion and draft ownership. */
export function Button(props: ButtonProps) {
  const native = omit(props, "variant", "size", "layout", "class", "type");
  return (
    <button
      {...native}
      type={props.type ?? "button"}
      class={`ui-button ui-button--${props.variant ?? "quiet"} ui-button--${props.size ?? "default"} ui-button--${props.layout ?? "action"}${props.class ? ` ${props.class}` : ""}`}
    />
  );
}
