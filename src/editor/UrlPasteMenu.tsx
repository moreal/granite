import { For } from "solid-js";
export interface PasteMenuState {
  url: string;
  mode: "choices" | "loading" | "failed";
  active: number;
}
export function UrlPasteMenu(props: {
  paste: PasteMenuState;
  templateNames?: string[];
  onMount: (element: HTMLDivElement) => void;
  onKey: (event: KeyboardEvent) => boolean;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      ref={props.onMount}
      class="paste-menu"
      role="group"
      aria-label="붙여넣은 링크"
      style="position:fixed;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto"
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          (event.target as HTMLElement).closest(".text-button")
        )
          return;
        if (props.onKey(event)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div class="eyebrow">{new URL(props.paste.url).hostname}</div>
      {props.paste.mode === "loading" ? (
        <p role="status">제목을 가져오는 중… 계속 써도 괜찮아요.</p>
      ) : (
        <>
          {props.paste.mode === "failed" && (
            <p role="status">
              제목을 가져오지 못했어요. CORS가 허용된 주소만 가져올 수 있습니다.
            </p>
          )}
          <span class="sr-only" role="status">
            {
              [
                "URL 그대로",
                "별칭 달기",
                "제목 가져오기",
                ...(props.templateNames ?? []),
              ][props.paste.active]
            }{" "}
            선택됨. 위아래 화살표로 이동하고 Enter로 적용합니다.
          </span>
          <div class="paste-actions">
            <For
              each={[
                "URL 그대로",
                "별칭 달기",
                "제목 가져오기",
                ...(props.templateNames ?? []),
              ]}
              keyed={false}
            >
              {(label, index) => (
                <button
                  data-active={props.paste.active === index ? "true" : "false"}
                  onFocus={() => props.onActive(index)}
                  onClick={() => props.onChoose(index)}
                >
                  {label()}
                </button>
              )}
            </For>
          </div>
        </>
      )}
      <button
        class="text-button"
        onClick={() => {
          props.onClose();
        }}
      >
        닫기 · Esc
      </button>
    </div>
  );
}
