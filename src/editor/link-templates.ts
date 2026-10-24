import { safeWebUrl } from "./helpers";

export interface LinkTemplateValues {
  url: string;
  title: string;
  selection: string;
  hostname: string;
}
const placeholders = new Set(["url", "title", "selection", "hostname"]);
export function validateLinkTemplate(template: string): string | null {
  if (!template.trim()) return "템플릿을 입력하세요.";
  if (template.length > 4096) return "템플릿은 4096자 이내로 입력하세요.";
  let invalid = false;
  const remainder = template.replace(/\{\{([^{}]*)\}\}/g, (_, name: string) => {
    if (!placeholders.has(name)) invalid = true;
    return "";
  });
  if (invalid || /\{\{|\}\}/.test(remainder))
    return "{{url}}, {{title}}, {{selection}}, {{hostname}}만 사용할 수 있습니다.";
  if (!template.includes("{{url}}")) return "{{url}}을 포함해 주세요.";
  return null;
}
export function escapeMarkdownText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\\`*_{}\[\]()<>!#|~.+\-]/g, "\\$&");
}
export function renderLinkTemplate(
  template: string,
  values: LinkTemplateValues,
): string {
  const error = validateLinkTemplate(template);
  if (error) throw new Error(error);
  const url = safeWebUrl(values.url);
  if (!url) throw new Error("HTTP 또는 HTTPS 주소가 필요합니다.");
  const replacements: LinkTemplateValues = {
    url: values.url.replace(
      /[()<>\\]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    ),
    title: escapeMarkdownText(values.title),
    selection: escapeMarkdownText(values.selection),
    hostname: escapeMarkdownText(values.hostname),
  };
  return template.replace(
    /\{\{(url|title|selection|hostname)\}\}/g,
    (_, name: keyof LinkTemplateValues) => replacements[name],
  );
}
