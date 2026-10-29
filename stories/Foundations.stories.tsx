import { Settings, BookOpen } from "../src/icons";
import "./design-system.css";
export default { title: "Design System/Foundations" };
const colors = [
  "canvas",
  "surface",
  "sidebar",
  "text",
  "text-muted",
  "border",
  "control-border",
  "link",
  "danger",
  "warning",
  "hover",
  "selected",
  "primary",
  "primary-hover",
  "focus",
];
function Foundations(props: { group?: string }) {
  return (
    <main class="ds-showcase" data-testid="design-system">
      <h1>Granite의 기본값</h1>
      <p>
        테마 도구에서 밝게/어둡게를 선택하세요. 이 미리보기는 앱 설정을 저장하지
        않습니다.
      </p>
      {(!props.group || props.group === "colors") && (
        <section class="ds-section" aria-label="의미별 색상">
          <h2>의미별 색상</h2>
          <div class="ds-colors">
            {colors.map((role) => (
              <div class="ds-color">
                <span style={{ background: `var(--color-${role})` }} />
                <code>{role}</code>
              </div>
            ))}
          </div>
        </section>
      )}
      {(!props.group || props.group === "typography") && (
        <section class="ds-section" aria-label="글자 역할">
          <h2>글자 역할</h2>
          <p class="ds-title">한글로 쓰는 나의 노트</p>
          <p class="ds-reading">
            글을 읽고 생각을 이어 갑니다. 긴 한글 어절과 주소도 쓰기 영역을 넘지
            않게 자연스럽게 줄을 바꿉니다.
          </p>
          <p class="ds-ui">보조 정보와 작업 이름은 차분한 크기로 표시합니다.</p>
          <pre class="ds-code">{"type: Book\nauthor: '[[작가]]'"}</pre>
        </section>
      )}
      {(!props.group || props.group === "spacing") && (
        <section class="ds-section" aria-label="간격과 크기">
          <h2>간격과 크기</h2>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((step) => (
            <div class="ds-space">
              <code>space-{step}</code>
              <span style={{ width: `var(--space-${step})` }} />
            </div>
          ))}
          <p class="ui-field-help">
            기본 작업 40px · 편안한 작업/터치 행 44px · 최근 노트 행 32px · 본문
            19.2px/1.6 · 최대41em
          </p>
          <div class="ui-action-row">
            <BookOpen size={17} />
            <Settings size={18} />
            로컬 아이콘 · 같은 초점/모션 토큰
          </div>
        </section>
      )}
    </main>
  );
}

export const Tokens = { render: () => <Foundations /> };
export const Colors = { render: () => <Foundations group="colors" /> };
export const Typography = { render: () => <Foundations group="typography" /> };
export const Spacing = { render: () => <Foundations group="spacing" /> };
