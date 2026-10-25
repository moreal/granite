import type { NoteReference } from "../../schema/references";
import type { Extension } from "@codemirror/state";
import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import type { menuTrigger } from "../../domain/links";
export interface EditorServices {
  readImage?: (path: string) => Promise<Blob>;
  open: (title: string) => void;
}
export interface EditorCompletionProvider {
  readonly id: string;
  complete(context: {
    trigger: NonNullable<ReturnType<typeof menuTrigger>>;
    titles: readonly string[];
    context: CompletionContext;
  }): readonly Completion[];
}
export interface EditorFormatter {
  readonly id: string;
  readonly label: string;
  format(text: string, context: { signal: AbortSignal }): Promise<string>;
}
/** Bundled trusted application code; these capabilities are not a sandbox. */
export interface EditorPlugin {
  readonly id: string;
  readonly liveExtensions?: (services: EditorServices) => Extension;
  readonly completionSources?: readonly {
    readonly id: string;
    complete(
      context: CompletionContext,
      services?: { references: readonly NoteReference[] },
    ): CompletionResult | null;
  }[];
  readonly completions?: readonly EditorCompletionProvider[];
  readonly formatters?: readonly EditorFormatter[];
}
