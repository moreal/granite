import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import App from "../../src/App";
const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => data.set(k, v),
  removeItem: (k: string) => data.delete(k),
  clear: () => data.clear(),
  key: (i: number) => [...data.keys()][i] ?? null,
  get length() {
    return data.size;
  },
});
afterEach(cleanup);
it("opens a visibly separate demo and creates a searchable persistent note", async () => {
  localStorage.clear();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "데모 둘러보기" }));
  await screen.findByRole("button", { name: "새 노트" });
  expect(screen.getAllByText(/데모/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
  fireEvent.change(screen.getByLabelText("새 노트 제목"), {
    target: { value: "테스트 노트" },
  });
  fireEvent.click(screen.getByRole("button", { name: "만들기" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "테스트 노트" })).toBeTruthy(),
  );
  expect(localStorage.getItem("granite.demo.v1")).toContain("테스트 노트");
  fireEvent.change(screen.getByLabelText("노트 검색"), {
    target: { value: "테스트" },
  });
  expect(screen.getByRole("button", { name: /테스트 노트/ })).toBeTruthy();
});
