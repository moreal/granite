# S21–S22 속성 편집·작은 화면 검증·Solid 2

2026-10-25 도그푸딩과 사용자 지시. 모든 구현·리뷰·검증은 Sol6.1에게 위임한다. main 직접 commit/push 합의를 유지한다.

## 분류와 목표

- S02 오늘 숫자는 현재 일자이지만 의미/자정 갱신 명세가 부족하다. 일자로 오해되지 않는 월·일 표시와 날짜 변경 갱신을 추가한다.
- S17 속성 추가의 불편과 레이블/선택 상자 겹침은 명세 보완과 사용성 결함이다. S21로 유형별 속성 추천/검색과 YAML 자동완성을 명시한다.
- React→Solid.js 2는 사용자 승인한 방향 변경이다. prerelease를 실제 사용하고 호환 버전을 정확히 고정한다. 기존 CodeMirror·저장·복구 계약을 유지한다.
- S22 작은 실제 컴포넌트를 Storybook에서 독립 렌더링하고 각 상태를 캡처해 육안 검증한다. 큰 전체 화면 캡처만으로 검증하지 않는다.

## S02 날짜

오늘 바로가기는 로컬 달력 날짜를 명확한 월·일 문자열로 표시하고 접근 가능한 전체 날짜를 제공한다. 날짜는 앱을 켜 둔 채 자정을 지나거나 다시 탭으로 돌아왔을 때 갱신한다. 클릭은 실행 시점의 로컬 YYYY-MM-DD 노트를 연다. 테스트 시계가 25일이면25가 나오는 것은 정상이며 고정값이 아니다.

## S21 Schema.org 속성

공식 vocabulary의 버전/출처/라이선스를 기록한 오프라인 카탈로그를 포함한다. 현재 유형과 상위 유형의 속성을 합쳐 검색·추천하며 여러 유형이면 합집합, 이미 정의한 속성은 중복 추가하지 않는다. 예: Book의 author/isbn, Person의 birthDate, Article의 headline/about, 공통name/description/url. 이름과 설명·기대 값 유형을 표시한다. 사용자 정의/알 수 없는 타입·속성은 계속 허용한다.

속성 패널에 유형 선택/속성 검색/속성 추가를 작은 컴포넌트로 제공한다. 키보드 방향키/Enter/Escape, 클릭, 포커스, 좁은폭, 긴이름, 빈검색, 오류, disabled 상태를 지원한다. YAML 값은 문자열/위키링크로 원문 편집 가능하다. 이름선택으로 YAML에 키를 추가할 때 기존 주석/순서/공백/줄바꿈/unknown키를 재직렬화하지 않는다. 잘못된 YAML은 안전한 원문복구로 남기며 자동추측해 덮어쓰지 않는다.

자동완성은 속성 YAML 편집 영역과 전체원문 모드의 frontmatter YAML 모두에서 작동한다. 최상위 키 위치에서 유형기반 속성 후보, type/@type 값 위치에서 유형 후보를 제공한다. 문자열·주석·코드/본문·중첩값 내부에 최상위키를 잘못 삽입하지 않는다. 이미쓴 콜론/부분입력 범위를 중복시키지 않는다. 유형 값 완성은 일반·따옴표 scalar와 schema.org URL을 지원한다. 배열형 여러 유형과 임의 외부 IRI는 수동 편집을 유지하며, 이미 저장된 배열 유형은 속성 추천의 합집합에 반영한다. 조합중 선택확정이 입력을 가로채지 않는다. rawYAML 변경은 그래프에 즉시 반영되고 저장/undo/복구는 기존 경로를 따른다.

## S22 Solid 2와 컴포넌트 검증

앱 실행부는 실제 Solid2를 사용한다. React 호환shim이나 React로 렌더링한 UI를 Solid전환으로 부르지 않는다. Storybook의 관리UI 내부 React 의존성은 앱의 React사용과 구분한다. Yarn4pnpm/Node24 유지, package버전 검증 후 고정한다. CodeMirror 인스턴스·비동기취소·cleanup을 Solid수명주기로 옮기되 기존158단위/76E2E의 의미를 버리지 않는다.

App의 화면을 Sidebar/TodayShortcut/NoteHeader/EditorToolbar/SaveStatus/RecoveryPanel 등으로, 속성패널을 TypePicker/PropertyPicker/PropertyRow/YamlEditor/PropertyCreateForm 등으로 분리한다. 설정/그래프/메뉴·대화상자도 개별관심사 단위로 렌더링한다. 눈에 보이지 않는 워크스페이스·편집기제어 코드는 별도 controller로 둘 수 있다. 단순 줄수만을 위한 분할 대신 화면의 책임과 테스트 경계를 따른다.

Storybook은 운영컴포넌트 자체를 사용하고 synthetic props/fixtures만 사용한다. 핵심 controls,propertycreation/combobox/row,YAMLeditor,todayshortcut,save/recovery,graphitem,settings/menu를 작은폭에서 isolated story로 제공한다. 라이트/다크,포커스/열림/오류/disabled/긴한글 상태와 실제 keyboard상호작용을 재현한다. 컴포넌트별 확대 캡처를 직접 검토하고 label/control중첩·잘림·넘침·focusring을 검사한다. CI에서 Storybook빌드 및 해당캡처검증을 실행하고 보고서/trace를 보관한다. 기존 Chromatic appvisual을 유지하며 Storybook컴포넌트도 검증 가능한 별도 경로로 제공한다.

## 보존/검증

원문/CRLF/주석·위키·CAS첨부·수식·Mermaid·홍다운자동정리·IME보호·저장충돌/복구·기존설정과 데모를 유지한다. 열기만으로 데이터를 변환하지 않는다. 실제권한/네이티브IME 미검증을 숨기지 않는다. 단위/타입/빌드/전체E2E/Storybook빌드·컴포넌트검사/시각검사, 독립리뷰 후 mainpush 및 exactheadActions/Pages/Chromatic업로드를 확인한다.
