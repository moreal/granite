import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "./solid-render";
import { PropertyNoteLink } from "../../src/components/properties/PropertyNoteLink";
afterEach(cleanup);
it("S28 changing preview content/context, disabling or unmounting closes native preview without a navigation side effect", () => {
  const onOpen = vi.fn();
  const preview = () => ({ title: "작가", excerpt: "기존 원문" });
  const view = render(PropertyNoteLink, {
    title: "작가",
    contextKey: "one",
    preview,
    onOpen,
  });
  const popup = screen.getByRole("tooltip") as HTMLElement;
  popup.style.setProperty("--delay-note-preview-close", "0ms");
  const show = (popup.showPopover = vi.fn()),
    hide = (popup.hidePopover = vi.fn());
  const button = screen.getByRole("button", { name: "작가 노트 열기" });
  fireEvent.focus(button);
  expect(show).toHaveBeenCalledTimes(1);
  expect(button.getAttribute("aria-describedby")).toBe(popup.id);
  view.rerender({
    title: "작가",
    contextKey: "one",
    preview: () => ({ title: "작가", excerpt: "새 원문" }),
    onOpen,
  });
  expect(hide).toHaveBeenCalledTimes(1);
  expect(button.hasAttribute("aria-describedby")).toBe(false);
  fireEvent.blur(button);
  fireEvent.focus(button);
  view.rerender({ title: "작가", contextKey: "two", preview, onOpen });
  expect(button.hasAttribute("aria-describedby")).toBe(false);
  fireEvent.blur(button);
  fireEvent.focus(button);
  view.rerender({
    title: "작가",
    contextKey: "two",
    preview,
    onOpen,
    disabled: true,
  });
  expect(button.hasAttribute("aria-describedby")).toBe(false);
  expect(hide).toHaveBeenCalledTimes(3);
  view.rerender({
    title: "작가",
    contextKey: "two",
    preview,
    onOpen,
    disabled: false,
  });
  fireEvent.blur(button);
  fireEvent.focus(button);
  view.unmount();
  expect(hide).toHaveBeenCalledTimes(4);
  expect(onOpen).not.toHaveBeenCalled();
});
it("S28 preview Escape keeps trigger focus contract, suppresses reopening and leaves the direct click callback singular", () => {
  const onOpen = vi.fn();
  render(PropertyNoteLink, {
    title: "없는 노트",
    preview: () => undefined,
    onOpen,
  });
  const popup = screen.getByRole("tooltip") as HTMLElement;
  popup.style.setProperty("--delay-note-preview-close", "0ms");
  popup.showPopover = vi.fn();
  popup.hidePopover = vi.fn();
  const button = screen.getByRole("button");
  fireEvent.focus(button);
  const ancestorEscape = vi.fn();
  document.body.addEventListener("keydown", ancestorEscape);
  fireEvent.keyDown(button, { key: "Escape" });
  expect(button.hasAttribute("aria-describedby")).toBe(false);
  expect(ancestorEscape).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onOpen).toHaveBeenCalledExactlyOnceWith("없는 노트");
  document.body.removeEventListener("keydown", ancestorEscape);
});

it("S28 converts minified seconds and authored milliseconds without collapsing hover intent", async () => {
  const { cssTimeMilliseconds } =
    await import("../../src/components/properties/PropertyNoteLink");
  expect(cssTimeMilliseconds(".2s")).toBe(200);
  expect(cssTimeMilliseconds(".12s")).toBe(120);
  expect(cssTimeMilliseconds("200ms")).toBe(200);
  expect(cssTimeMilliseconds(" 120ms ")).toBe(120);
  expect(cssTimeMilliseconds("invalid")).toBe(0);
});
