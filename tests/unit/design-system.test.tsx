import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "./solid-render";
import { Button } from "../../src/design-system/Button";
afterEach(cleanup);
it("S27 forwards reactive native disabled, ref, ARIA and pointer handlers without changing DOM", () => {
  const click = vi.fn(),
    down = vi.fn((event: MouseEvent) => event.preventDefault());
  let node: HTMLButtonElement | undefined;
  const view = render(Button, {
    children: "적용",
    disabled: false,
    "aria-expanded": "true" as const,
    ref: (element: HTMLButtonElement) => {
      node = element;
    },
    onClick: click,
    onMouseDown: down,
  });
  const button = screen.getByRole("button", { name: "적용" });
  expect(node).toBe(button);
  expect(button.getAttribute("type")).toBe("button");
  expect(button.getAttribute("aria-expanded")).toBe("true");
  fireEvent.mouseDown(button);
  expect(down).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  expect(click).toHaveBeenCalledTimes(1);
  view.rerender({
    children: "적용",
    disabled: true,
    "aria-expanded": "false" as const,
  });
  expect(screen.getByRole("button")).toBe(button);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(button.getAttribute("aria-expanded")).toBe("false");
});
it("S27 uses explicit native submit and keeps design-only props off the DOM", () => {
  render(Button, {
    children: "저장",
    type: "submit",
    variant: "primary",
    size: "comfortable",
    layout: "icon",
    "aria-label": "저장",
  });
  const button = screen.getByRole("button", { name: "저장" });
  expect(button.getAttribute("type")).toBe("submit");
  expect(button.hasAttribute("variant")).toBe(false);
  expect(button.hasAttribute("size")).toBe(false);
  expect(button.hasAttribute("layout")).toBe(false);
});
