import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { isFrontmatterFenceLine } from "./frontmatter";

/** A metadata boundary is syntax even when its YAML is invalid. Its contents
 * must never open Markdown code/HTML constructs that leak into the prose. */
export const frontmatterSyntax: NonNullable<
  Parameters<typeof markdown>[0]
>["extensions"] = {
  defineNodes: [{ name: "Frontmatter", block: true }],
  parseBlock: [
    {
      name: "Frontmatter",
      before: "HorizontalRule",
      parse(context, line) {
        if (context.lineStart !== 0 || !isFrontmatterFenceLine(line.text))
          return false;
        let end = line.text.length;
        while (context.nextLine()) {
          end = context.lineStart + line.text.length;
          if (isFrontmatterFenceLine(line.text)) {
            context.nextLine();
            break;
          }
        }
        context.addElement(context.elt("Frontmatter", 0, end));
        return true;
      },
    },
  ],
};
export const noteMarkdownLanguage = markdown({
  base: markdownLanguage,
  extensions: frontmatterSyntax,
}).language;
