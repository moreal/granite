import { expect, it } from "vitest";
import {
  renderLinkTemplate,
  validateLinkTemplate,
} from "../../src/editor/link-templates";

it("S08/S19 validates literal placeholders and requires a URL", () => {
  expect(validateLinkTemplate("[{{title}}]({{url}})")).toBeNull();
  for (const template of [
    "",
    "{{title}}",
    "{{url}} {{evil}}",
    "{{url}} {{title",
    "{{url}} title}}",
    "{{url}}" + "x".repeat(4096),
  ])
    expect(validateLinkTemplate(template)).not.toBeNull();
});
it("S08/S19 renders a single literal substitution with escaped text and destination", () => {
  expect(
    renderLinkTemplate("[{{title}}]({{url}}) {{selection}} {{hostname}}", {
      url: "https://example.com/a(b)",
      title: "[x] *bold* {{url}}",
      selection: "",
      hostname: "example.com",
    }),
  ).toBe(
    "[\\[x\\] \\*bold\\* \\{\\{url\\}\\}](https://example.com/a%28b%29)  example\\.com",
  );
  expect(() =>
    renderLinkTemplate("{{url}}", {
      url: "javascript:alert(1)",
      title: "",
      selection: "",
      hostname: "",
    }),
  ).toThrow();
});
it("S08 escapes list punctuation in substituted remote text", () => {
  expect(
    renderLinkTemplate("{{title}}\n{{url}}", {
      url: "https://example.com",
      title: "1. + item -",
      selection: "",
      hostname: "",
    }),
  ).toBe("1\\. \\+ item \\-\nhttps://example.com");
});
