import type { NotePreviewLookup } from "../domain/note-preview";
import { SaveStatus } from "./SaveStatus";
import { NoteProperties } from "./NoteProperties";
import type { PropertyEditorMode } from "../settings";
import type { NoteReference } from "../schema/references";
import type { Entry } from "../storage/workspace";
export function NoteHeader(props: {
  entry: Entry;
  documentKey?: string;
  titles?: readonly string[];
  preview?: NotePreviewLookup;
  references?: readonly NoteReference[];
  propertyMode?: PropertyEditorMode;
  source?: boolean;
  sourceEditing?: boolean;
  onSource?: () => void;
  onOpen?: (title: string) => void;
  locked: boolean;
  wordCount: number;
  onBody: (body: string) => void;
}) {
  return (
    <div class="note-header">
      <div class="note-kicker">
        <SaveStatus status={props.entry.status} />
      </div>
      <h1>{props.entry.note.title}</h1>
      <NoteProperties
        titles={props.titles}
        preview={props.preview}
        references={props.references}
        mode={props.propertyMode}
        source={props.source}
        sourceEditing={props.sourceEditing}
        onSource={props.onSource}
        onOpen={props.onOpen}
        documentKey={props.documentKey}
        body={props.entry.body}
        locked={props.locked}
        onChange={props.onBody}
      />
      <div class="note-meta">
        <span>
          {new Intl.DateTimeFormat("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(props.entry.note.updated)}
        </span>
        <span>·</span>
        <span>{props.wordCount}단어</span>
      </div>
    </div>
  );
}
