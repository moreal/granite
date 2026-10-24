import { validateLinkTemplate } from "./editor/link-templates";
export type ThemePreference = "light" | "dark" | "system";
export type LinkTemplate = { id: string; name: string; template: string };
export type AppSettings = {
  version: 1;
  theme: ThemePreference;
  linkTemplates: LinkTemplate[];
};
export const SETTINGS_KEY = "granite.settings.v1";
export const defaultSettings = (): AppSettings => ({
  version: 1,
  theme: "system",
  linkTemplates: [],
});
export function readSettings(): AppSettings {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return defaultSettings();
    const data = value as Partial<AppSettings>;
    if (
      data.version !== 1 ||
      !["light", "dark", "system"].includes(data.theme ?? "") ||
      !Array.isArray(data.linkTemplates)
    )
      return defaultSettings();
    const ids = new Set<string>();
    if (
      !data.linkTemplates.every(
        (t) =>
          t &&
          typeof t.id === "string" &&
          t.id.length > 0 &&
          !ids.has(t.id) &&
          (ids.add(t.id), true) &&
          typeof t.name === "string" &&
          t.name.trim().length > 0 &&
          t.name.length <= 80 &&
          typeof t.template === "string" &&
          !validateLinkTemplate(t.template),
      )
    )
      return defaultSettings();
    return {
      version: 1,
      theme: data.theme!,
      linkTemplates: data.linkTemplates,
    };
  } catch {
    return defaultSettings();
  }
}
export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    throw new Error(
      "설정을 저장하지 못했습니다. 브라우저 저장 공간과 권한을 확인해 주세요.",
    );
  }
  window.dispatchEvent(new Event("granite-settings-change"));
}
export function subscribeSettings(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("granite-settings-change", listener);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("granite-settings-change", listener);
  };
}
export function initializeTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const { theme } = readSettings();
    const resolved =
      theme === "system" ? (media.matches ? "dark" : "light") : theme;
    if (document.documentElement.dataset.theme !== resolved) {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#191a1c" : "#ffffff");
      window.dispatchEvent(new Event("granite-theme-change"));
    }
  };
  apply();
  const unsubscribe = subscribeSettings(apply);
  media.addEventListener("change", apply);
  return () => {
    unsubscribe();
    media.removeEventListener("change", apply);
  };
}
