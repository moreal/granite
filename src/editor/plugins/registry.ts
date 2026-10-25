import type { CompletionContext } from "@codemirror/autocomplete";
import { menuTrigger } from "../../domain/links";
import { documentContext } from "../document-context";
import type { EditorPlugin } from "./types";
export function resolveEditorPlugins(plugins: readonly EditorPlugin[]) {
  const ids = new Set<string>();
  for (const plugin of plugins) {
    for (const id of [
      plugin.id,
      ...(plugin.completionSources ?? []).map((p) => p.id),
      ...(plugin.completions ?? []).map((p) => p.id),
      ...(plugin.formatters ?? []).map((p) => p.id),
    ]) {
      if (!id.trim() || ids.has(id))
        throw new Error(`Duplicate or empty editor registration ID: ${id}`);
      ids.add(id);
    }
  }
  return plugins;
}
export function pluginCompletions(
  getPlugins: () => readonly EditorPlugin[],
  getTitles: () => readonly string[],
) {
  return (context: CompletionContext) => {
    if (context.view?.composing || context.state.readOnly) return null;
    for (const plugin of getPlugins()) {
      for (const source of plugin.completionSources ?? []) {
        const result = source.complete(context);
        if (result) return result;
      }
    }
    const text = context.state.doc.toString();
    const { metadataEnd } = documentContext(text);
    if (context.pos < metadataEnd) return null;
    const trigger = menuTrigger(text, context.pos, !!context.view?.composing);
    if (!trigger || trigger.from < metadataEnd) return null;
    const options = getPlugins().flatMap((plugin) =>
      (plugin.completions ?? []).flatMap((provider) => [
        ...provider.complete({ trigger, titles: getTitles(), context }),
      ]),
    );
    return { from: trigger.from, to: trigger.to, options, filter: false };
  };
}
