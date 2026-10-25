import {
  propertyCompletionScope,
  propertyCompletionOptions,
  planPropertyCompletion,
} from "../../schema/property-completions";
import type { EditorPlugin } from "./types";
/** Both source and property YAML use the same bounded context and exact patch planner. */
export const schemaPlugin: EditorPlugin = {
  id: "granite.schema",
  completionSources: [
    {
      id: "granite.schema.yaml",
      complete(context, services) {
        const source = context.state.doc.toString();
        const scope = propertyCompletionScope(
          source,
          context.pos,
          "frontmatter",
        );
        if (!scope) return null;
        const options = propertyCompletionOptions(
          scope,
          services?.references ?? [],
        );
        if (!options.length) return null;
        return {
          from: scope.context.from,
          to: scope.context.to,
          filter: false,
          options: options.map((option) => ({
            label: option.id,
            detail: option.detail,
            info: option.description,
            type: scope.kind === "note" ? "text" : "property",
            apply(view) {
              if (
                view.composing ||
                view.state.readOnly ||
                !view.state.selection.main.empty ||
                view.state.selection.main.head !== context.pos
              )
                return;
              const edit = planPropertyCompletion(
                view.state.doc.toString(),
                scope,
                option.id,
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
