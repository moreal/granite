import { BookOpen } from "../icons";
export function SidebarNoteRow(props: {
  title: string;
  active: boolean;
  disabled: boolean;
  excerpt?: string;
  onOpen: () => void;
}) {
  return (
    <button
      class={props.active ? "note-item active" : "note-item"}
      onClick={props.onOpen}
      disabled={props.disabled}
    >
      <span class="note-title">
        <BookOpen size={15} />
        <span>{props.title}</span>
      </span>
      {props.excerpt !== undefined && (
        <span class="note-excerpt">
          {props.excerpt || "아직 비어 있는 노트"}
        </span>
      )}
    </button>
  );
}
