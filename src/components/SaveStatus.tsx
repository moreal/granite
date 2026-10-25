import { Check, LoaderCircle } from "../icons";
import type { Entry } from "../storage/workspace";
export function SaveStatus(props: { status: Entry["status"] }) {
  return (
    <div class={"save-state " + props.status} role="status">
      {props.status === "saved" ? (
        <Check size={13} />
      ) : props.status === "saving" ? (
        <LoaderCircle size={13} class="spin" />
      ) : (
        <span class="unsaved-dot" />
      )}
      {
        {
          saved: "저장 완료",
          dirty: "미저장",
          saving: "저장 중…",
          error: "저장 실패",
          conflict: "외부 변경 충돌",
        }[props.status]
      }
    </div>
  );
}
