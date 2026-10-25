import { createSignal } from "solid-js";
import { Button } from "../src/design-system/Button";
import { Plus, LoaderCircle, Settings } from "../src/icons";
import { SidebarNoteRow } from "../src/components/SidebarNoteRow";
import { PropertyRow } from "../src/components/properties/PropertyRow";
import { GraphItem } from "../src/components/GraphItem";
import { SchemaPicker } from "../src/components/properties/SchemaPicker";
import "./design-system.css";

export default { title: "Design System/Primitives" };
const long =
  "아주 긴 한글 제목과 공백 없는 주소가 좁은 화면에서도 자연스럽게 이어지는 기록";
function Controls(props: { group?: string }) {
  const [disabled, setDisabled] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);
  const [clicks, setClicks] = createSignal(0);
  const [submits, setSubmits] = createSignal(0);
  const [choice, setChoice] = createSignal("Per");
  const [feedback, setFeedback] = createSignal("");
  let native: HTMLButtonElement | undefined;
  return (
    <main class="ds-showcase" data-testid="design-system">
      <h1>기본 컨트롤</h1>
      <p>
        운영 화면과 같은 네이티브 버튼과 필드입니다. Tab으로 초점을 확인하고
        화면 폭과 테마를 바꿔 보세요.
      </p>
      {(!props.group || props.group === "buttons") && (
        <section aria-label="버튼 종류" class="ds-section">
          <h2>작업과 상태</h2>
          <div class="ui-action-row">
            <Button variant="primary" size="comfortable">
              주요 작업
            </Button>
            <Button variant="secondary">보조 작업</Button>
            <Button>조용한 작업</Button>
            <Button variant="danger">삭제</Button>
            <Button size="compact">작은 작업</Button>
            <Button layout="icon" aria-label="설정" title="설정">
              <Settings size={18} />
            </Button>
            <Button
              aria-pressed={pressed() ? "true" : "false"}
              onClick={() => setPressed(!pressed())}
            >
              선택 상태
            </Button>
            <Button variant="primary" disabled>
              사용할 수 없음
            </Button>
            <Button disabled>
              <LoaderCircle class="spin" size={16} />
              저장 중
            </Button>
          </div>
          <p class="ui-field-help">
            hover는 포인터 기기에서, 초점은 키보드로 확인합니다.
            reduced-motion에서는 회전과 전환을 멈춥니다.
          </p>
        </section>
      )}
      {(!props.group || props.group === "native") && (
        <section aria-label="네이티브 동작" class="ds-section">
          <h2>기본 동작과 전달</h2>
          <form
            class="ui-field"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmits(submits() + 1);
            }}
          >
            <label class="ui-field-label" for="ds-name">
              이름
            </label>
            <input class="ui-input" id="ds-name" placeholder="노트 이름" />
            <div class="ui-action-row">
              <Button
                ref={(element) => {
                  native = element;
                }}
                disabled={disabled()}
                aria-expanded={pressed() ? "true" : "false"}
                onClick={() => setClicks(clicks() + 1)}
              >
                기본 버튼
              </Button>
              <Button type="submit" variant="secondary">
                명시적 제출
              </Button>
              <Button onClick={() => setDisabled(!disabled())}>
                비활성화 전환
              </Button>
              <Button
                onClick={() => {
                  native?.focus();
                  setFeedback(native?.tagName ?? "");
                }}
              >
                ref로 초점
              </Button>
            </div>
            <output aria-label="클릭 횟수">{clicks()}</output>
            <output aria-label="제출 횟수">{submits()}</output>
            <output aria-label="ref 대상">{feedback()}</output>
          </form>
        </section>
      )}
      {(!props.group || props.group === "fields") && (
        <section aria-label="필드" class="ds-section">
          <h2>레이블과 안내</h2>
          <div class="ui-field">
            <label class="ui-field-label" for="ds-select">
              속성 편집 방식
            </label>
            <select class="ui-select" id="ds-select">
              <option>속성 폼</option>
              <option>YAML 편집기</option>
            </select>
            <label class="ui-field-label" for="ds-invalid">
              원문
            </label>
            <textarea
              class="ui-textarea"
              id="ds-invalid"
              rows={3}
              aria-invalid="true"
              aria-describedby="ds-error"
            >
              type: [
            </textarea>
            <p id="ds-error" class="ui-feedback ui-feedback--error">
              입력은 보관되어 있습니다. 닫는 괄호를 확인하세요.
            </p>
            <label class="ui-field-label" for="ds-disabled">
              비활성 필드
            </label>
            <input
              class="ui-input"
              id="ds-disabled"
              disabled
              value="보관된 값"
            />
          </div>
        </section>
      )}
      {(!props.group || props.group === "navigation") && (
        <section aria-label="행과 인라인 링크" class="ds-section">
          <h2>행과 본문 링크</h2>
          <SidebarNoteRow
            title="짧은 노트"
            active={true}
            disabled={false}
            onOpen={() => setFeedback("짧은 노트")}
          />
          <SidebarNoteRow
            title={long}
            active={false}
            disabled={false}
            onOpen={() => setFeedback(long)}
          />
          <SidebarNoteRow
            title="잠긴 노트"
            active={false}
            disabled={true}
            onOpen={() => {}}
          />
          <GraphItem
            node={{
              title: long,
              id: "long.md",
              types: ["Book"],
              missing: false,
            }}
            incoming={false}
            property="author"
            locked={false}
            onOpen={setFeedback}
          />
          <dl class="property-list">
            <PropertyRow
              name="author"
              value={`이 글은 [[작가]]와 ${long}`}
              editable={true}
              onEdit={() => setFeedback("편집")}
              onOpen={setFeedback}
            />
          </dl>
          <p>
            본문의{" "}
            <Button layout="inline" onClick={() => setFeedback("연결 노트")}>
              연결 노트
            </Button>
            는 문장의 줄 높이를 유지합니다.
          </p>
        </section>
      )}
      {(!props.group || props.group === "suggestions") && (
        <section aria-label="후보 목록" class="ds-section">
          <h2>후보 목록</h2>
          <SchemaPicker
            id="ds-picker"
            label="유형 검색"
            value={choice()}
            onChange={setChoice}
            onSelect={setChoice}
            options={
              choice() === "없음"
                ? []
                : [
                    { id: "Person", description: long },
                    { id: "Organization", description: "조직의 기록" },
                  ]
            }
          />
          <p class="ui-field-help">
            입력 후 방향키로 후보를 선택합니다. ‘없음’을 입력하면 빈 목록을
            확인합니다.
          </p>
        </section>
      )}
      {(!props.group || props.group === "feedback") && (
        <section aria-label="피드백" class="ds-section">
          <h2>배지와 안내</h2>
          <div class="ui-action-row">
            <span class="ui-badge">DEMO</span>
            <span class="ui-badge ui-badge--compact">Book</span>
            <Button
              size="compact"
              onClick={() => setFeedback("다시 시도했습니다.")}
            >
              <Plus size={14} />
              추가
            </Button>
          </div>
          <p class="ui-feedback ui-feedback--muted">
            입력 중인 내용은 이 화면에 보관됩니다.
          </p>
          <p class="ui-feedback ui-feedback--warning">
            권장 유형과 다릅니다. 계속 저장할 수 있습니다.
          </p>
          <p class="ui-feedback ui-feedback--error">
            저장하지 못했습니다. 다시 시도해 주세요.
          </p>
        </section>
      )}
      {(props.group === "navigation" || props.group === "feedback") && (
        <output aria-label="상호작용 결과">{feedback()}</output>
      )}
    </main>
  );
}
export const NativeControls = { render: () => <Controls /> };

export const Buttons = { render: () => <Controls group="buttons" /> };
export const NativeBehavior = { render: () => <Controls group="native" /> };
export const Fields = { render: () => <Controls group="fields" /> };
export const Navigation = { render: () => <Controls group="navigation" /> };
export const Suggestions = { render: () => <Controls group="suggestions" /> };
export const Feedback = { render: () => <Controls group="feedback" /> };
