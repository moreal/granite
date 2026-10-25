import { Button } from "../design-system/Button";
import { TriangleAlert, Download } from "../icons";
import type { Entry } from "../storage/workspace";
export function RecoveryPanel(props: {
  status: Entry["status"];
  error: string;
  busy: boolean;
  onRetry: () => void;
  onDownload: () => void;
  onReload: () => void;
}) {
  return (
    <div class="save-error" role="alert">
      <TriangleAlert size={17} />
      <div>
        <strong>
          {props.status === "conflict"
            ? "원본과 초안이 달라졌습니다."
            : "저장을 마치지 못했습니다."}
        </strong>
        <p>{props.error} 편집한 내용은 이 브라우저에 보관합니다.</p>
        <div class="ui-action-row recovery-actions">
          <Button
            onClick={props.onRetry}
            disabled={props.busy || props.status === "conflict"}
          >
            다시 저장
          </Button>
          <Button onClick={props.onDownload}>
            <Download size={14} />
            초안 다운로드
          </Button>
          <Button onClick={props.onReload}>디스크 내용 다시 읽기</Button>
        </div>
      </div>
    </div>
  );
}
