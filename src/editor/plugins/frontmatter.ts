import { EditorState, StateField, Transaction, Text } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  documentContext,
  selectionTouchesMetadata,
  synchronizeDocument,
} from "../document-context";

export function frontmatterPresentation() {
  const hiddenEnd = (state: EditorState) => {
    const { bodyStart } = documentContext(state.doc.toString());
    return selectionTouchesMetadata(state.selection, bodyStart) ? 0 : bodyStart;
  };
  const field = StateField.define({
    create: (state) => hiddenEnd(state),
    update: (end, transaction) => {
      // History transactions bypass filters. Reveal their legitimate metadata
      // edits here while keeping their original history changes intact.
      if (transaction.isUserEvent("undo") || transaction.isUserEvent("redo")) {
        const boundary = documentContext(
          transaction.startState.doc.toString(),
        ).metadataEnd;
        let touches = false;
        transaction.changes.iterChangedRanges((from) => {
          if (from < boundary) touches = true;
        });
        if (touches) return 0;
      }
      if (!transaction.docChanged && !transaction.selection) return end;
      return hiddenEnd(transaction.state);
    },
    provide: (field) =>
      EditorView.decorations.from(field, (end) =>
        end
          ? Decoration.set([
              Decoration.replace({ block: true, inclusive: false }).range(
                0,
                end,
              ),
            ])
          : Decoration.none,
      ),
  });
  return [
    field,
    EditorState.transactionFilter.of((transaction) => {
      const end = transaction.startState.field(field);
      if (
        !end ||
        !transaction.docChanged ||
        transaction.annotation(synchronizeDocument)
      )
        return transaction;
      let touched: number | undefined;
      transaction.changes.iterChangedRanges((from) => {
        if (from < end) touched = Math.min(touched ?? end, from);
      });
      if (touched === undefined) {
        // Opening a metadata-only file never rewrites it. The first prose input
        // supplies the missing line boundary instead of corrupting its last fence.
        if (
          end === transaction.startState.doc.length &&
          !transaction.startState.doc.toString().endsWith("\n") &&
          transaction.newDoc.length > end &&
          transaction.newDoc.sliceString(end, end + 1) !== "\n"
        ) {
          return [
            transaction,
            {
              changes: { from: end, insert: Text.of(["", ""]) },
              sequential: true,
            },
          ];
        }
        return transaction;
      }
      if (transaction.isUserEvent("undo") || transaction.isUserEvent("redo")) {
        return [
          transaction,
          {
            selection: { anchor: Math.min(touched, transaction.newDoc.length) },
            annotations: Transaction.addToHistory.of(false),
          },
        ];
      }
      // First destructive action reveals exact source; a subsequent action can edit it.
      return {
        selection: { anchor: touched },
        annotations: Transaction.addToHistory.of(false),
      };
    }),
  ];
}
