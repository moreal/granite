# 실제 컴포넌트 검토 (S22)

Storybook은 운영 Solid 2 컴포넌트를 직접 렌더링한다. 관리 화면의 React와 앱 실행부를 구분하며, React 호환 계층으로 운영 UI를 감싸지 않는다. 버전은 `storybook`10.6.3, `storybook-solidjs-vite`10.7.4, Solid2.0.0-rc.18, Vite 플러그인3.0.0-next.51로 고정한다.

Node24와 package.json의 Yarn4.18.1을 사용한다.

```sh
yarn install --immutable
yarn storybook
```

개발 탐색기는 `http://localhost:6006`에서 열 수 있다. 빌드와 자동 확대 검사는 다음 순서다. 앱 빌드는 dist를 비우므로 Storybook 빌드를 뒤에 실행한다.

```sh
VITE_BASE_PATH=/granite/ yarn build
yarn build:storybook
yarn playwright install chromium
yarn test:components
yarn test:visual
```

`test:components`는4176에서 빌드된 `/granite/storybook/`을 열고, 기존 앱 시각 검사는4175를 사용한다. 각각 전용 서버를 시작하며 다른 개발 서버를 덮어쓰지 않는다. `dist/storybook/index.html`과 iframe의 상대 자산 경로는 Pages 하위 경로에서도 동작한다. 공개 주소는 [컴포넌트 탐색기](https://moreal.github.io/granite/storybook/)다. 로컬 빌드 성공과 실제 원격 게시 확인은 별도의 증거다.

Production story는 TodayShortcut, 유형/속성 검색과 생성/행, YAML 편집, 저장/충돌복구, 그래프 항목, 편집 도구, 설정 스위치, 링크 양식 오류, URL 메뉴, 정리 검토를 운영 props와 합성 데이터로 렌더링한다. Type story의 Play 버튼은 실제 키보드 선택을 실행한다. 자동 검사는 좁은320px, 긴 한글, 비활성화/오류/열림/포커스와 라이트/다크를 포함한 캡처를 만든다. 선택 결과, 날짜 변경, YAML ISBN 입력과 설정 스위치 변경을 확인한다.

팝업은 실제 absolute 배치를 유지한다. 캡처 범위는 컴포넌트와 팝업의 합집합에 포커스 여백을 더한다. `component-report/index.html`은 확대 PNG를 포함하고 `component-results/`는 원본 캡처와 실패 trace를 보관한다. `yarn playwright show-report component-report`로 보고서를 열 수 있다. 네 가지 대표 캡처는 `docs/screenshots/storybook-*.png`다.

기존 Playwright 시각 검토 프로젝트는 앱·운영 Storybook iframe과 Design System의 작은 예제를 함께 아카이브한다. 컴포넌트 화면은 높이를 실제 컴포넌트·팝업에 맞춰 줄여 검토한다. 서로 다른 프로젝트가 필요한 native Storybook 업로드와 Playwright 업로드를 한 토큰에 섞지 않는다. 로컬 캡처만으로 원격 업로드가 성공했다고 주장하지 않는다.

Tests CI는 빌드·컴포넌트 검사를 실행하고 보고서/trace/탐색기 빌드를14일 보관한다. Pages CI는 앱 뒤에 Storybook을 빌드하고 전체 dist와 명시적으로 허용한 대응 소스 압축을 게시한다. Schema.org 원본 JSON-LD·생성기·파생 JSON·출처·CC BY-SA3.0 전문과 아이콘 고지는 압축에 포함된다.

합성 상태 검사이며 사용자 폴더 picker/권한창, 실제 OS IME 또는 네이티브 클립보드를 검증한 것이 아니다.

S25에는 실제 NoteProperties의 `PropertiesYamlQuiet`, `PropertiesYamlValidated`, `PropertiesYamlNoResults`, `PropertiesDraftPreserved`, `PropertiesInvalidForm`을 추가했다. 각각 입력 중 조용한 미완성 YAML, 떠난 뒤 검증 안내, 기존 노트 결과 없음, 거부된 숫자 초안 보존, 전체 원문 복구를 재현한다. `data-story-ready=true` 이후 native 키보드로 계속 입력하는 회귀와320/960px 라이트·다크 캡처는 `tests/components/property-ux.spec.ts`가 맡는다. 새 캡처는 모두 테스트 결과 폴더에 생성한다.

S27의 **Design System → Foundations / Primitives**는 운영 토큰/컨트롤의 색·글자·간격·변형·상태를 한곳에서 보여 준다. 상단 테마 도구는 앱 설정을 저장하지 않는다. 수정 위치·선택 기준·네이티브 동작 경계·검사 추가법은 [디자인 수정 안내](design-system.md)를 따른다.

S28의 PropertiesLinks는 운영 속성 링크와 읽기 전용 미리보기에서 준비를 끝낸다. 링크를 누르면 예제 노트의 실제 합성 내용으로 바로 이동하며, 추가 열기/돌아가기 단계나 작업 결과 문구를 표시하지 않는다. story 재설정으로 출발 상태를 다시 볼 수 있다. PropertyLinkPreview/Empty/Missing/Long은 같은 운영 링크의 내용·빈/없는 대상·긴 한글을 작게 검토한다. 미리보기는 기존 메모리의 일반 텍스트만 사용하고 클릭/Enter/터치의 운영 이동 경로는 바꾸지 않는다.

S29 연결 미리보기: Production → Components → GraphPreview는 실제 GraphItem의 로컬 노트 미리보기에서 준비를 마치며 클릭/Enter는 곧바로 예제 노트 내용을 연다. GraphLong은 긴 없는 대상의 미리보기, GraphDisabled는 잠긴 상태다. Create는 별도 유형 생성 폼 대신 실제 새 속성 이름→값 초안을 보여 준다. Components/Format 수동 정리 예제는 폐기했다.
