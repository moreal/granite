import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultSettings,
  initializeTheme,
  readSettings,
  saveSettings,
  SETTINGS_KEY,
} from "../../src/settings";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("S19 settings and theme", () => {
  it("uses safe defaults for malformed and unsupported settings", () => {
    for (const value of [
      "{",
      '{"version":2}',
      '{"version":1,"theme":"other","linkTemplates":[]}',
    ]) {
      localStorage.setItem(SETTINGS_KEY, value);
      expect(readSettings()).toEqual(defaultSettings());
    }
  });
  it("persists complete settings and surfaces storage failures", () => {
    const settings = {
      ...defaultSettings(),
      theme: "dark" as const,
      linkTemplates: [{ id: "a", name: "출처", template: "{{url}}" }],
    };
    saveSettings(settings);
    expect(readSettings()).toEqual(settings);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full");
    });
    expect(() => saveSettings(defaultSettings())).toThrow(
      "설정을 저장하지 못했습니다",
    );
    expect(readSettings()).toEqual(settings);
  });
  it("follows system changes only in system mode and responds to cross-tab storage", () => {
    let systemListener = () => {};
    const media = {
      matches: false,
      addEventListener: vi.fn((_name, listener) => {
        systemListener = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => media);
    const cleanup = initializeTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    media.matches = true;
    systemListener();
    expect(document.documentElement.dataset.theme).toBe("dark");
    saveSettings({ ...defaultSettings(), theme: "light" });
    systemListener();
    expect(document.documentElement.dataset.theme).toBe("light");
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...defaultSettings(), theme: "dark" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_KEY }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    cleanup();
    vi.unstubAllGlobals();
  });
});

it("S20 enables automatic formatting for old settings and preserves explicit false", () => {
  const old = {
    version: 1,
    theme: "dark",
    linkTemplates: [{ id: "a", name: "출처", template: "{{url}}" }],
  };
  expect(defaultSettings()).toHaveProperty("autoFormat", true);
  for (const autoFormat of [undefined, false, true]) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...old, autoFormat }));
    expect(readSettings()).toEqual({
      ...old,
      autoFormat: autoFormat !== false,
    });
  }
});
