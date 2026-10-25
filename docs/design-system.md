# Granite 디자인 수정 안내

디자인의 시작점은 Storybook의 **Design System → Foundations / Primitives**다. **Production → Components**에서는 같은 규칙을 쓰는 실제 속성 편집·설정·복구·툴바를 검토한다. 새로운 디자인 방향을 정하기 전에 현재 글쓰기 경험을 보존할 범위를 [S27](superpowers/specs/2026-10-26-design-system.md)과 함께 확인한다.

## 어디를 바꾸나요

| 변경                                        | 기준 파일                                                             | 영향                                      |
| ------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| 의미별 색·밝게/어둡게 상태                  | `src/design-system/tokens.css`                                        | 앱·Storybook·에디터 호환 별칭             |
| UI/본문/코드 서체, 글자·간격·크기·초점·모션 | 같은 파일                                                             | 역할을 소비하는 운영 컨트롤과 글쓰기 영역 |
| 작업 종류·크기·아이콘·행·인라인 표현        | `src/design-system/controls.css`, `Button.tsx`                        | 모든 운영 버튼과 네이티브 필드 규칙       |
| 필드 레이블/도움말·배지·안내·후보 목록      | `src/design-system/patterns.css`                                      | 직접 클래스를 적용한 운영 노드            |
| 화면 배치·읽기·그래프·팝업 위치·속성 행     | `src/styles.css`                                                      | 해당 기능의 배치                          |
| 예제 구성                                   | `stories/Foundations.stories.tsx`, `stories/DesignSystem.stories.tsx` | 운영 규칙을 그대로 보여 주는 검토 화면    |

`src/styles.css`는 안정된 앱/Storybook 진입점이며 토큰 → reset → 컨트롤 → 표현 규칙 → 기능 배치 순으로 불러온다. 같은 기능의 규칙을 파일 끝에서 다시 덮어쓰지 않는다. 토큰을 바꿀 때 기존 기능 CSS의 예외도 확인한다. 간격 토큰은 반복 리듬의 기준이며, 아이콘의7px 관계나 그래프9px 여백 같은 의도적인 세부 배치는 기능에 남긴다.

`--color-canvas`, `--color-text-muted`, `--color-danger`, `--color-warning`, `--color-primary-hover`처럼 **용도**로 이름을 고른다. 경고색을 코드 숫자색에 연결하지 않는다. `--paper`/`--text`/`--line` 등은 의미 토큰을 가리키는 에디터 호환 별칭이며 새 색의 원천이 아니다. `--syntax-*`는 구문 강조 전용이다. CodeMirror 생성 완성 목록은 이 별칭으로 꾸미는 어댑터이며 Button으로 교체하지 않는다.

테마는 기존 설정의 light/dark/system 해석기가 `html[data-theme]`에 결정한다. 별도 provider는 없다. `index.html`의 최소 초기 배경/글자색은 CSS 로드 전 첫 화면을 위한 bootstrap 값이다. canvas/text 기본값을 바꾸면 그 두 초기 값도 맞춘다. Storybook 테마 도구는 문서 속성만 바꾸며 저장된 앱 설정에 쓰지 않는다.

## 컨트롤 선택과 조합

`Button`은 네이티브 button 한 개를 렌더링한다. `variant`는 quiet(기본), secondary, primary, danger다. 크기는 default40px, comfortable44px, compact32px이며 `layout`은 action(기본), icon, list, inline이다. 아이콘만 있는 작업은 `layout="icon"`과 명확한 `aria-label`을 함께 쓴다. 목록은 `layout="list"`로 시작선을 정하고, 여러 줄 구성은 SidebarNoteRow/GraphItem 같은 기능이 정한다. 문장 안 연결은 `layout="inline"`으로 작업 버튼의 높이와 padding을 받지 않는다. 인라인 속성 링크는24px 행간을 유지한다.

Button의 기본 type은 button이다. 폼을 제출할 작업만 `type="submit"`을 명시한다. disabled·ref·ARIA·네이티브 이벤트는 그대로 전달한다. props를 구조 분해하거나 값을 복사해 반응성을 잃지 않는다. 모든 버튼에 pointer preventDefault를 넣지 않는다. 열린 속성 메뉴에서 Apply/Cancel/연결의 초점 유지 이벤트는 해당 기능이 소유한다.

input/select/textarea에는 `ui-input`/`ui-select`/`ui-textarea`를 직접 적용한다. 속성 필드의 차분한 배경/6px 곡률에는 `--subtle` 변형을 쓴다. 체크박스/라디오는 네이티브 크기를 유지하는 `ui-choice`다. `ui-field`는 레이블·컨트롤·도움말을 안정적으로 쌓고 `ui-action-row`는 작업을 묶는다. label의 for/id, 도움말의 id/aria-describedby와 오류의 aria-invalid는 호출자가 명시한다. PropertyValueInput의 기존 행 레이블은 `hideLabel`로 시각적으로만 감춘다.

YAML textarea와 완성 입력은 기존 네이티브 노드/ref/이벤트/값 소유권을 유지한다. 같은 YAML 원문을 다시 대입하지 않는 보호, 커서·undo·조합, 메뉴 키보드/스크롤, 초안/파싱/저장은 디자인 규칙으로 옮기지 않는다.

`ui-badge`는 짧은 상태, `ui-feedback--muted/--warning/--error`는 의미별 안내를 꾸민다. `ui-menu`/`ui-menu-option`은 후보의 표현만 담당한다. role/aria-selected/active descendant/열림 상태/키보드는 기존 기능의 책임이다. 표현 클래스가 새 live region을 만들지 않으며 저장/복구 메시지는 기존 선명한 조상 경계를 유지한다.

## 검토와 새 예제

Node24와 package.json의 정확한 Yarn 버전을 사용한다.

```sh
yarn storybook
VITE_BASE_PATH=/granite/ yarn build
yarn build:storybook
yarn test:components
yarn test:e2e
yarn test:visual
```

앱 빌드가 dist를 비우므로 Storybook 빌드를 뒤에 실행한다. 실제 운영 컨트롤을 import하는 story를 추가하고 기존 story id를 유지한다. 상호작용 play가 있다면 완료 후 `data-story-ready`를 기다린 뒤 브라우저가 키보드를 이어서 조작한다. fixture CSS에는 예제 배치만 두고 컨트롤을 다시 구현하지 않는다.

밝게/어둡게·320/390px·긴 한글·열린 메뉴·초점·disabled·오류와 reduced-motion을 확인한다. 실제 앱은 사이드바 때문에 같은 뷰포트의 Storybook보다 속성 영역이 좁으므로 둘을 확인한다. 이미지 출력은 `testInfo.outputPath`를 사용한다.

`tests/components/design-system.spec.ts`와 `tests/e2e/design-system.spec.ts`는 실제 속성/설정/툴바의 토큰 전파, 기본 네이티브 버튼의 전역 크기 부재, inline/list 격리와 네이티브 상호작용을 검사한다. S24–S26의 YAML/caret/undo/초안/메뉴 한 번 클릭 회귀를 유지한다. 새로운 변형은 기존 화면을 바꾸지 않는지 이 예제와 실제 소비 화면에서 함께 검사한다.

현재 경계: 풍부한 본문/CodeMirror/수식/다이어그램·한국어 줄바꿈·화면 그리드·팝업 위치는 기능 스타일에 남는다. 새 디자인 라이브러리, 토큰 외부 게시, 데이터 변환이나 동기화는 포함하지 않는다. 자동 Chromium/합성 데모 검증은 실제 사용자 폴더 권한창·OS IME·스크린리더 확인과 구분한다.
