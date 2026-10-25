import { Dialog } from "../components/Dialog";
export interface FormatReview {
  label: string;
  message?: string;
  original?: string;
  output?: string;
}
export function FormatReviewDialog(props: {
  review: FormatReview;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog
      focusKey={props.review.output}
      title={props.review.label}
      onClose={props.onClose}
    >
      <p>변경 내용을 확인한 뒤 적용하세요. 적용 후 실행 취소할 수 있습니다.</p>
      {props.review.message && <p role="status">{props.review.message}</p>}
      {props.review.output !== undefined && (
        <div class="format-comparison">
          <label>
            원문
            <textarea
              aria-label="정리 전 원문"
              readonly
              value={props.review.original}
            />
          </label>
          <label>
            정리 결과
            <textarea
              aria-label="정리 결과"
              readonly
              value={props.review.output}
            />
          </label>
        </div>
      )}
      <div class="dialog-actions">
        <button onClick={props.onClose}>취소</button>
        {props.review.output !== undefined && (
          <button class="primary" onClick={props.onApply}>
            적용
          </button>
        )}
      </div>
    </Dialog>
  );
}
