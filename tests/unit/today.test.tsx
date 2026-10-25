import { afterEach, expect, it, vi } from "vitest";
import { TodayShortcut } from "../../src/components/TodayShortcut";
import { act, cleanup, fireEvent, render, screen } from "./solid-render";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("S02 displays month/day and follows midnight while the app stays open", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 25, 23, 59, 59));
  render(TodayShortcut, { disabled: false, onOpen: () => {} });
  expect(screen.getByRole("button").textContent).toContain("10월 25일");
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByRole("button").getAttribute("aria-label")).toContain(
    "2026-10-26",
  );
  expect(screen.getByRole("button").textContent).toContain("10월 26일");
});
it("S02 refreshes on focus/visibility and resolves the date when clicked", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 25));
  const open = vi.fn();
  render(TodayShortcut, { disabled: false, onOpen: open });
  vi.setSystemTime(new Date(2026, 10, 1));
  fireEvent.click(screen.getByRole("button"));
  expect(open).toHaveBeenCalledWith("2026-11-01");
  fireEvent(window, new Event("focus"));
  expect(screen.getByRole("button").textContent).toContain("11월 1일");
  vi.setSystemTime(new Date(2026, 10, 2));
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("button").textContent).toContain("11월 2일");
});
