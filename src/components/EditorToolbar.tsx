import { Button } from "../design-system/Button";
import { Code2, PanelRightClose, PanelRightOpen } from "../icons";
export function EditorToolbar(props: {
  hasNote: boolean;
  demo: boolean;
  source: boolean;
  connections: boolean;
  focus: boolean;
  onSource: () => void;
  onConnections: () => void;
}) {
  return (
    <div class="top-actions">
      {props.demo && <span class="ui-badge demo-tag">DEMO</span>}
      <Button
        class={"mode-button" + (props.source ? " selected" : "")}
        onClick={props.onSource}
        aria-pressed={props.source ? "true" : "false"}
      >
        <Code2 size={15} />
        {props.source ? "라이브 프리뷰" : "원문 보기"}
      </Button>
      <Button
        layout="icon"
        class="icon-button"
        onClick={props.onConnections}
        aria-expanded={props.connections && !props.focus ? "true" : "false"}
        aria-label={
          props.connections && !props.focus
            ? "연결 패널 접기"
            : "연결 패널 열기"
        }
        title={
          props.connections && !props.focus
            ? "연결 패널 접기"
            : "연결 패널 열기"
        }
      >
        {props.connections && !props.focus ? (
          <PanelRightClose size={18} />
        ) : (
          <PanelRightOpen size={18} />
        )}
      </Button>
    </div>
  );
}
