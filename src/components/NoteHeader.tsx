import { SaveStatus } from "./SaveStatus";
import { NoteProperties } from "./NoteProperties";
import type { Entry } from "../storage/workspace";
export function NoteHeader(props: {
  entry: Entry;
  documentKey?: string;
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
