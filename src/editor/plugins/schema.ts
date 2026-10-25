import {
  completionContext,
  planCompletion,
  searchTypes,
  suggestProperties,
} from "../../schema";
import type { EditorPlugin } from "./types";
/** Providers own their scope; the editor does not need to know YAML syntax. */
export const schemaPlugin: EditorPlugin = {
  id: "granite.schema",
  completionSources: [
    {
      id: "granite.schema.yaml",
      complete(context) {
        const source = context.state.doc.toString();
        const scope = completionContext(source, context.pos, "frontmatter");
        if (!scope) return null;
        const candidates =
          scope.kind === "type"
            ? searchTypes(scope.prefix)
            : suggestProperties(scope.types, scope.existingKeys, scope.prefix);
        return {
          from: scope.from,
          to: scope.to,
          filter: false,
          options: candidates.map((candidate) => ({
            label: candidate.id,
            detail:
              "ranges" in candidate
                ? candidate.ranges.join(" · ")
                : candidate.label,
            info: candidate.description,
            type: scope.kind === "type" ? "class" : "property",
            apply(view) {
              if (view.composing || view.state.readOnly) return;
              const edit = planCompletion(
                view.state.doc.toString(),
                scope,
                candidate.id,
              );
              if (edit)
                view.dispatch({
                  changes: edit,
                  selection: { anchor: edit.from + edit.insert.length },
                  userEvent: "input.complete",
                });
            },
          })),
        };
      },
    },
  ],
};
