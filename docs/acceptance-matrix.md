# Granite MVP 수용 검증표

기준: [MVP 스펙](superpowers/specs/2026-10-23-granite-mvp-design.md), [구현 계획 Task 2](superpowers/plans/2026-10-23-granite-mvp.md). 이 문서는 검증 계획이며 통과 보고서가 아니다. 실제 실행 명령·개수·실패·화면·미검증 항목은 별도 실행 기록에 남긴다.

검증 방식: **U** 단위 테스트, **A** 실제 저장 어댑터 경계 테스트, **E** Playwright UI 여정, **M** 실제 Chrome 수동 확인. E는 사용자 동작과 저장 결과를 함께 확인하고 매번 독립된 데모 저장소로 시작한다. 대기 시간 고정보다 화면 상태와 저장 완료를 기다린다.

| 기준                  | 사용자가 완료할 여정과 기대 결과                                                                                                                                                                | 위험 사례와 검증 방식                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 시작/저장         | 데모 표시를 확인해 샘플을 연다. 별도로 폴더를 선택하면 최상위 `.md`만 나타나고 편집이 그 폴더에 저장된다. 메타데이터 없는 기존 Markdown은 디코딩한 파일명을 제목으로 보여 주고 본문을 보존한다. | E: 데모 새로고침·별도 저장소 유지. A/M: 노트 탐색은 하위 폴더·비 Markdown 파일을 읽거나 변경하지 않음(명시적인 S13 이미지 첨부는 별도); 데모 파일이 실제 폴더에 생기지 않음. M: 선택 취소·권한 거부 후 다시 열기. E: 명시적 URL 제목 요청 외 노트 내용이 네트워크로 전송되지 않음.                                                                     |
| S02 노트              | 새 제목과 본문을 입력하고 저장 후 제목/본문으로 검색한다. 다른 노트에서 돌아와도 유지된다. 오늘·덤프 바로가기로 다시 연다.                                                                      | E/U: 빈 제목·중복 제목 거부, 기존 본문 불변, 최근 목록 갱신, 빈 검색 결과. E: 저장 직전 다른 노트로 이동해도 내용 유지.                                                                                                                                                                                                                                |
| S03 파일명            | `한글 / 질문?: 100% 🪨` 제목을 만들고 다시 열면 정확한 제목·본문이 나온다. 긴 제목도 동일하다.                                                                                                  | U/A/M: 파일이 최상위 단일 `.md`이며 경로 탈출 없음. 긴 제목 메타데이터 왕복. `A`/`a`, NFC/NFD, 예약명, 같은 해시를 만드는 테스트 대역, 이미 있는 대상 파일 모두 덮어쓰기 방지. 원래 파일 바이트도 확인.                                                                                                                                                |
| S04 편집              | 제목·강조·코드·링크가 있는 글에서 현재 부분을 편집하고 원문 보기로 전환한다.                                                                                                                    | E: 전환 전후 Markdown 보존, 표시된 링크 열기. E/U: 사용자 HTML·이벤트 핸들러·위험 URL 실행 차단. M: 실제 한글 IME 조합 중 `@`/`[[`와 Enter가 조합을 방해하지 않음. 합성 composition 이벤트는 보조 증거만 됨.                                                                                                                                           |
| S05 폐기 (2026-10-24) | 본문 선택 후 새 노트로 옮기기 버튼·대화상자가 없고 본문이 유지됨을 확인한다.                                                                                                                    | E: 기존 노트·링크 보존, 일반 생성과 백링크 탐색 유지. 과거 추출 실패 검증은 역사적 기록으로만 보존한다.                                                                                                                                                                                                                                                |
| S06 연결              | `[[`로 기존 노트를 검색해 방향키/Enter로 넣고 연다. 없는 제목은 링크를 넣은 뒤 열어 생성한다.                                                                                                   | U/E: Escape·마우스 선택, 결과 없음, `대괄호 [예시] \\ 경로` 제목 왕복. U/E: 인라인 코드·fenced code의 위키링크는 백링크나 탐색 링크가 되지 않음.                                                                                                                                                                                                       |
| S07 @ 메뉴            | `@`에서 오늘·어제·내일과 기존 노트를 삽입한다. 원문에 일반 `[[YYYY-MM-DD]]`/노트 링크가 남는다.                                                                                                 | U/E: 고정된 로컬 날짜·월말·연말·자정 전후·UTC와 다른 시간대. 실행 시점 날짜를 사용하고 다음 날 다시 열어도 삽입 링크 불변. 이메일 입력은 메뉴를 열지 않음. 한글 IME는 M으로 추가 확인.                                                                                                                                                                 |
| S08 외부 출처         | HTTP(S) URL을 붙여넣고 그대로 유지하거나 별칭을 붙인다. 선택 텍스트가 있으면 그 텍스트를 별칭으로 사용한다.                                                                                     | E: Escape·계속 입력 시 URL 유지. 허용 CORS 응답의 제목 성공, 오류/차단 시 URL과 수동 별칭 유지. 느린 응답 중 본문 수정·노트 전환·취소 후 오래된 응답이 글을 덮어쓰지 않음. 네트워크 대역으로 재현하고 실제 CORS 차단은 M 확인.                                                                                                                         |
| S09 발견              | 연결된 노트의 백링크 문맥을 보고 원본으로 돌아간다. 다시 발견으로 다른 노트를 열고 패널을 접어 쓴다.                                                                                            | E/U: 현재 노트 제외, 빈 저장소·한 노트에서 오류 없음, 문맥/링크 갱신, 자동 팝업 없음. 코드 예시를 백링크로 집계하지 않음.                                                                                                                                                                                                                              |
| S10 데이터 보호       | 입력 후 저장 상태를 확인하고 이동한다. 실패한 글은 새로고침·폴더 재연결 후 복구하고, 충돌 초안은 복사/다운로드로 꺼낼 수 있다.                                                                  | A/E: 지연된 `write`/`close` 완료 전 저장 완료 표시 금지. 권한 거부·쓰기 실패·할당량 실패 안내와 초안 보존. 외부 변경을 먼저 만든 뒤 저장하면 외부 파일 불변·편집 초안 유지. 디스크 내용 다시 읽기가 있다면 초안 폐기 전 명시적 확인. 같은 이름의 서로 다른 폴더 및 데모 사이에 초안 섞임 없음. 오래된 저장 응답이 새 편집을 저장 완료로 표시하지 않음. |
| S11 리뷰              | 샘플로 주 여정을 반복하고 [리뷰 가이드](review-guide.md)로 실제 파일까지 확인한다.                                                                                                              | 실행 담당자가 단위·E2E·빌드의 실제 결과와 재현 명령, 데스크톱/좁은 화면 캡처, 실패 trace를 기록. 네이티브 미실행은 명시. 이 표의 모든 행을 성공·실패·미검증 중 하나로 보고.                                                                                                                                                                            |
| S12 사용성            | 키보드만으로 시작·생성·검색·메뉴·대화상자를 쓰고 좁은 창에서도 저장 상태와 주요 동작을 찾는다.                                                                                                  | E/M: Tab 순서/포커스 표시, 메뉴 방향키/Enter/Escape, 대화상자 닫힌 뒤 포커스 복귀, 1440×900 및 760×900에서 작업 가능. M: 한국어 문구·가독성·여백·오류 안내, 긴 제목이 버튼/본문을 가리지 않음.                                                                                                                                                         |

## 실제 파일 검증의 경계

네이티브 폴더 선택과 권한은 사람의 Chrome 확인을 남긴다. Chrome의 File System Access는 사용자 동작과 권한이 필요하고, 권한이 세션 간 항상 유지되지는 않는다. [Chrome 공식 문서](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)

Playwright `filechooser.setFiles()`는 연결된 파일 입력 요소를 설정하는 API다. 이것을 `showDirectoryPicker()`와 읽기/쓰기 권한 승인 검증으로 간주하지 않는다. [Playwright 공식 문서](https://playwright.dev/docs/api/class-filechooser)

자동 검증은 다음 수준을 구분해 보고한다.

1. **데모 E2E:** UI 주 여정과 브라우저 저장 성공/실패. 실제 사용자 폴더 접근 증거가 아니다.
2. **어댑터 경계 통합:** 운영 코드의 폴더 어댑터를 임시 디렉터리와 연결한다. Node 파일 I/O로 뒷받침한 최소 handle 대역은 `getFile`, 최상위 순회, `getFileHandle`, `createWritable`의 write/close를 구현하고 실제 파일 바이트를 별도로 검사한다. 이를 네이티브 브라우저 handle이라고 부르지 않는다. 메모리 대역만 쓴 경우에는 실제 디스크 smoke test라고 보고하지 않는다.
3. **네이티브 수동:** 설치된 데스크톱 Chrome에서 사용자가 실제 폴더를 고르고 권한을 승인/거부한다. 아래 기록이 있어야 이 부분을 검증했다고 보고한다. OPFS를 사용한 결과 역시 사용자 선택 폴더 검증과 구분한다.

## 네이티브 Chrome 수동 확인표

작업 전 폐기 가능한 폴더 A/B를 만들고 각각 `기존.md`, `보존.txt`, `하위/숨은.md`를 둔다. 가능하면 A/B의 마지막 폴더 이름을 같게 한다. 기존 파일의 원문 복사본을 남긴다. 실제 개인 노트 대신 이 표본을 쓴다.

- [ ] Chrome 버전·OS·앱 주소·실행 시각·코드 버전을 기록한다. HTTPS 또는 로컬 개발 주소에서 연다.
- [ ] 폴더 열기 버튼을 직접 누르고 선택 취소한다. 앱이 계속 사용 가능하다. 다시 열어 A를 선택하고 필요한 읽기/쓰기 권한을 승인한다.
- [ ] `기존.md`가 나타나고 `하위/숨은.md`는 나타나지 않는다. 열기만 한 기존 파일과 `보존.txt`는 변경되지 않는다.
- [ ] 특수문자 제목과 긴 제목을 만들고 본문에 고유 문장을 쓴다. 저장 완료 후 Finder/텍스트 편집기에서 최상위 `.md`의 파일명·본문을 확인한다. 하위 폴더는 생기지 않는다.
- [ ] 앱에서 읽은 노트를 외부 편집기로 수정한 뒤 앱에서 수정한다. 외부 내용은 그대로이고 충돌 안내와 앱 초안이 남는다. 재연결/새로고침 후 복구 내용을 확인한다.
- [ ] Chrome의 사이트 권한 UI에서 파일 접근을 철회한 뒤 편집한다. 실패 안내·초안이 유지되고, 재연결과 권한 승인 후 다시 저장할 수 있다. UI가 권한 철회를 지원하지 않는 환경이면 그 사실을 기록하고 자동 실패 주입 결과와 구분한다.
- [ ] 같은 이름의 B를 연다. A의 초안이 B에 붙지 않는다. A를 다시 골랐을 때 A의 초안 복구가 가능하다.
- [ ] 데모로 돌아가 샘플을 편집한다. A/B에 데모 노트가 생기지 않는다.

각 항목에 실제 결과와 필요한 파일 차이/화면을 남긴다. 재현하지 못한 권한 UI·실제 IME·파일 충돌은 통과 대신 **미검증**으로 기록한다.

## 추가 본문 표현

기준: [본문 표현 스펙](superpowers/specs/2026-10-24-rich-note-content.md).

| 기준       | 여정                                                                        | 위험 사례와 검증 방식                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S13 이미지 | 붙여넣기·저장·새로고침 후 같은 이미지가 표시되고 원문에 상대 경로가 남는다. | U/A: 원본 해시, 중복 제거, 손상/외부 수정/쓰기 실패/안전한 경로. E: 데모 IndexedDB 재열기, 대기 중 입력·전환·실패. M: 실제 OS 이미지 클립보드와 폴더 권한. |
| S14 표현   | 코드 하이라이팅, 인라인/블록 수식, Mermaid를 보고 클릭해 원문을 고친다.     | U/E: escape·코드·통화·잘못된 문법·unsafe 콘텐츠, 원문 모드와 선택 경계, 좁은 화면, 위젯/비동기 수명.                                                       |

## 예제와 배포

[예제·배포 스펙](superpowers/specs/2026-10-24-demo-pages-security.md)을 따른다. S15는 새/기존 데모 예제, 수정 보존·충돌·동시 열기·실패 재시도를 확인한다. S16은 `/granite/` 프로덕션 경로의 자산·폰트·Mermaid, zizmor/actionlint 및 PR의 읽기 전용 빌드와 main 전용 배포를 확인한다. 실제 공개 배포 성공은 main 머지 후 실행으로 구분한다.

## 타입과 시각적 회귀

S17: frontmatter 원문·알 수 없는 속성 보존, 오류/alias/tag/크기 제한, 제목과 파일명 불변, 미저장 변경과 속성별 들어오는/나가는 연결, 없는 노트 탐색을 검증한다. S18: 결정적인 합성 데이터로 Playwright 시각 캡처와 Chromatic archive를 생성하고, 토큰 설정 뒤 실제 게시를 별도로 검증한다. [스펙](superpowers/specs/2026-10-25-typed-notes-visual-review.md).

## 설정과 테마

[설정·붙여넣기 스펙](superpowers/specs/2026-10-25-settings-link-paste-theme.md): S08은 커서 메뉴·키보드/IME·템플릿·시간/크기 제한·오래된 제목 응답 취소를 포함한다. S19는 라이트/다크/시스템·첫 화면·설정 취소/저장/탭 동기화·유효성 오류·코드/수식/Mermaid와 좁은 화면을 검증한다.

## 편집기 플러그인과 문서 정리

S20 — [설계](superpowers/specs/2026-10-25-editor-plugins-design.md), [API와 범위](editor-plugins.md). `tests/unit/editor-plugins.test.ts`는 중복 ID 거절과 추가 명령/포매터 등록, `tests/unit/formatting.test.tsx`는 취소·오래된 결과·잠금·합성 IME·undo·오류·무변경·시간 제한·원문/의미 보호·reference 링크를 검증한다. `tests/unit/hongdown-wasm.test.ts`는 실제 고정 WASM API를, `tests/e2e/formatting.spec.ts`는 실제 worker의 미리보기/취소/적용/undo와 라이트/다크 1440/390 화면을 검증한다. `tests/visual/formatting.spec.ts`는 `/granite/` production worker/WASM 요청이 동일 출처 내부 경로에 머무는 것을 확인한다. 네이티브 IME나 폴더 권한창 증거가 아니다.

S20 자동 문서 정리 — [승인 기준](superpowers/specs/2026-10-25-auto-formatting.md). `tests/unit/formatting.test.tsx`는 1500ms debounce, 지연 결과 무효화, 선택/조합/완성/붙여넣기 대기, 재개, undo 억제, 외부 동기화·설정 켜기 비실행, 실패 시 편집 전달과 포커스 보존을 검증한다. `tests/unit/settings.test.ts`는 기존 설정 기본 활성화와 명시적 false 보존, `tests/e2e/auto-formatting.spec.ts`는 실제 기본 활성화 WASM·저장·재열기·undo/redo 및 설정 적용/취소/탭 동기화를 검증한다.

## 스키마 편집과 작은 운영 컴포넌트

S21 — [승인 기준](superpowers/specs/2026-10-25-solid-schema-storybook.md). `tests/unit/schema-catalog.test.ts`는 오프라인 타입·상속·여러 유형 합집합·이미 있는 키 제외와 YAML 범위/정확한 패치를 검증한다. `tests/unit/schema-editing.test.ts`는 `3DModel`·사용자 정의 타입과 플러그인 등록·범위/읽기 전용 보호, `tests/unit/property-controls.test.tsx`는 키보드·합성 IME·오류 거절·CRLF·값 포커스·커서/선택 범위 변경 뒤 후보 무효화를 검증한다. `tests/e2e/schema-editing.spec.ts`는 실제 패널 생성·author/about 삽입·그래프 즉시 갱신, 패널/원문/드러난 라이브 영역의 자동완성·Escape·undo, Home/Left/범위 선택 후 후보 닫힘을 검증한다.

S22 — 같은 브라우저 파일의 320/390px 라이트·다크 검증은 운영 속성 생성 컨트롤의 포커스와 열린 후보를 컴포넌트 크기로 캡처한다. Storybook의 독립 fixture 상태 검증과 전체 앱 검증은 별도 증거로 기록한다. 실제 폴더 권한창·OS 네이티브 IME를 이 검사로 검증했다고 주장하지 않는다.

S23 — [속성 값 노트 연결 기준](superpowers/specs/2026-10-25-save-properties.md#s23-속성-값에서-기존-노트-연결). `tests/unit/property-note-completion.test.ts`는 트리거·이메일·제목 검색·escape·앞뒤 텍스트·닫는 구분자와20개 표시 제한을, `tests/unit/property-value-input.test.tsx`와 `property-controls.test.tsx`는 운영 입력의 Enter/Escape 단계·마우스 초점·동일 DOM·합성 조합·CmdS 문자 그대로 확정·오래된 후보 거절·숫자/불리언/null 보존을 검증한다. `tests/e2e/property-note-links.spec.ts`는 author/about 선택·저장·재열기·그래프, 실제 키 입력·범위·문서 전환과 좁은 라이트/다크 레이아웃을 검증한다. Storybook의 PropertyValueMenu/NoResults/LongKorean은 독립 운영 컴포넌트의320px 상태이며 `tests/components/components.spec.ts`가 준비 완료 후 작은 캡처를 남긴다. 실제 사용자 폴더 picker/권한창·OS IME는 미검증이다.

S24 — [속성 편집 방식과 유형 안내 기준](superpowers/specs/2026-10-25-property-editor-modes.md). `property-recommendations.test.ts`는 범위 대안·상속·URL·여러 유형·미지정/사용자 정의 유형·불일치 순서를 검사한다. `yaml-note-completion.test.ts`와 `schema-editing.test.ts`는 YAML/전체 원문의 scalar/직접 목록·이스케이프·CRLF·정확한 교체와 제외 범위를 검사한다. `property-modes.spec.ts`는 실제 키 입력·선택·undo/redo·저장/재열기·그래프·유형 변경 반영, 설정 유지, 오류/오래된 초안/다른 탭 설정과 전체 원문 전환을 검사한다. 기존 S21/S23 회귀는 한 번에 한 편집기 계약에 맞춰 같은 저장/연결 동작을 유지한다. PropertiesDisplay/Type/Value/New/Yaml/Warning Storybook은 실제 운영 컴포넌트이며 준비 완료 후 컴포넌트 검사에서40px 입력/버튼·읽기/편집 텍스트 정렬, 도움말 아래 배치, 열린 메뉴 상태의 취소 클릭과 새 초안 label 표시를 확인한다.320px/960px 라이트·다크 작은 캡처를 생성한다. 합성 데모/이벤트 증거로, 실제 사용자 폴더 권한창·OS IME 검증과 구분한다.

S24d 입력 안정성 회귀: `tests/components/yaml-caret.spec.ts`는 Storybook play 완료 뒤 실제 Chromium 키보드로 첫 줄 `type: Book`을 입력하고 매 글자의 DOM 동일성·초점·커서·입력창 위치를 확인한다. `property-controls.test.tsx`는 같은 원문의 재대입 방지·CRLF·경고 전환·선택 범위·다른 문서 반영, `property-modes.spec.ts`는 같은 운영 앱 입력과 선택 교체·native undo/redo·저장/재열기를 확인한다. 오류는 숨기지 않고 YAML 입력 아래에 표시한다.

## S25 차분한 속성 편집

기준: [S25](superpowers/specs/2026-10-25-property-editor-ux.md), 기존 S01/S04/S10/S12/S21/S22/S24.

| 기준   | 사용자 기대                                                                                                                        | 회귀 근거                                                                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S25a/b | YAML/전체 원문 입력·조합·대기 중 문법 경고를 감추고 떠남/저장 후 차분하게 표시한다. 접혀도 `확인 필요`로 발견하며 고치면 사라진다. | U `property-controls` 경고/재열기/textarea 동일 값 대입 방지; E `property-modes` source 입력/저장/정확한 invalid autosave/reload; C `yaml-caret`, `property-ux` post-play native 키보드/합성 조합/idle/접힘/설명 연결 |
| S25c   | 지원하는 YAML 노트 검색이 비면 결과 없음; 유형 검색은 사용자 정의 유형 안내                                                        | U `property-controls`, `property-value-input`; C `property-ux` 실제 결과 없음                                                                                                                                         |
| S25d   | 다른/같은 속성 요청은 현재 초안·오류를 유지하며 적용/취소로 안내                                                                   | U `property-controls` 거부된 숫자/기존·신규·동일 행 요청/잘못된 원문; C `property-ux` mouse/keyboard 요청                                                                                                             |
| S25e   | 초기 유형/새 속성 후보가 방향키에 따라 목록 안에서 보이고 적용/취소 뒤 의미 있는 초점 유지                                         | U `property-controls`; C `property-ux` 17회 왕복, 문서 스크롤/입력 초점, 기존/새 속성 확정·취소                                                                                                                       |
| S25f   | 읽지 못한 YAML에서는 불가능한 폼 추가를 숨기고 기존 전체 원문 수정을 제공. 보관한 초안은 취소 가능                                 | U `property-controls` invalid map/읽을 수 있는 type 안내 구분; C `properties-invalid-form`; E 기존 `property-modes` 전체 원문 왕복                                                                                    |

## S26 읽는 속성에서 연결 노트 열기

기준: [S26](superpowers/specs/2026-10-25-property-link-navigation.md), 기존 S01/S04/S06/S10/S17/S23/S24/S25.

| 기준   | 기대 동작                                                                                                                                                                                      | 검증                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S26a/b | 문자열·직접 목록의 위키링크를 일반 클릭/Enter로 열고 편집은 분리한다. 여러·이스케이프 링크와 주변 텍스트를 유지하며 없는 대상은 생성 확인, HTML/URL 모양 제목은 안전한 로컬 텍스트로 처리한다. | E [property-navigation](../tests/e2e/property-navigation.spec.ts) 실제 클릭/Enter·저장/재열기/연결·목록·미완성 링크·없는 대상·안전한 표시; C [components](../tests/components/components.spec.ts) 실제 대상 화면·돌아오기·편집 초점 복원·중첩 조작 없음                                                                                                                                                     |
| S26c   | 어떤 폼 초안이든 이동 전에 적용/취소로 안내하고 값·오류·입력 초점을 보존한다. 열린 유형 후보가 포인터 클릭을 방해하지 않으며 적용/취소는 한 번 클릭으로 실행한다.                              | E [property-navigation](../tests/e2e/property-navigation.spec.ts) 거부된 숫자·Per 유형 초안·실제 포인터/Enter 이동 보류·320/390px 열린 후보의 적용/취소·문자 그대로 확정/저장/재열기; C [components](../tests/components/components.spec.ts) PropertiesType 준비 완료 후 native Enter·초점 보존; C [property-ux](../tests/components/property-ux.spec.ts) 크기 변경 전 열린 후보의 실제 클릭·편집 초점 복원 |
| S26d   | 실제 앱320/390/960px와 운영 컴포넌트320/960px 라이트·다크에서 읽을 수 있는 링크 너비·첫 줄 정렬·별도 편집·초안 안내를 확인한다.                                                                | E [property-navigation](../tests/e2e/property-navigation.spec.ts) 상대 너비·넘침·작은 캡처; C [components](../tests/components/components.spec.ts) 첫 텍스트 줄 위치·작은 캡처; 직접 화면 검토와 증거는 [검증 기록](verification.md#2026-10-25-읽는-속성에서-연결-노트-열기-s26)                                                                                                                            |

C는 `tests/components`의 빌드된 실제 운영 Storybook 검사를 뜻한다. 데모/합성 이벤트/Chromium 근거이며 실제 폴더 picker/권한·OS IME·스크린리더 세션 검증은 아니다.

## S27 바꾸기 쉬운 디자인 체계

기준: [S27](superpowers/specs/2026-10-26-design-system.md), 기존 S01/S04/S10/S12/S19/S22/S24–S26.

| 기준     | 기대 동작                                                                                    | 검증                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S27a/b/e | 의미 토큰과 네이티브 운영 계약의 변경이 실제 속성 입력/적용·설정/툴바에 전파됨               | U [design-system](../tests/unit/design-system.test.tsx) ref/disabled/ARIA/이벤트/type; C [design-system](../tests/components/design-system.spec.ts) 실제 속성·설정 토큰 덮어쓰기/inline24px·행32px/전역 native 크기 없음; E [design-system](../tests/e2e/design-system.spec.ts) 실제 앱 속성/툴바/대화상자·초안·DOM/좁은 창 |
| S27c     | YAML 원문/커서/undo/조합·초안·열린 메뉴의 한 번 클릭 작업 유지                               | 기존 U property-controls, C yaml-caret/property-ux/components, E property-navigation/property-modes/property-note-links/editor-identity                                                                                                                                                                                     |
| S27d     | 같은 운영 규칙의 기초·변형·상태를320px와 두 테마에서 검토, Storybook 테마는 설정에 쓰지 않음 | C design-system 기본/명시 제출·disabled·초점/ref·ARIA·테마 비저장·대비/넘침·작은 캡처, 기존 Production 운영 story; [수정 안내](design-system.md)                                                                                                                                                                            |

기존 저장/복구·안전한 HTML·테마/포인터/reduced-motion 검사는 유지한다. 실제 picker/권한·OS IME·스크린리더 확인은 별도 수동 범위다.

## S28 속성 노트 링크 미리보기와 직접 이동

기준: [S28](superpowers/specs/2026-10-26-note-link-preview.md), S01/S04/S06/S10/S12/S25/S26/S27.

| 기준   | 기대 동작                                                                                                                                                  | 검증                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S28a   | 첫 클릭/Enter/터치로 기존 노트 직접 열기, 미확정 초안/없는 대상 확인 보호                                                                                  | E [note-link-preview](../tests/e2e/note-link-preview.spec.ts), 기존 property-navigation; C [note-link-preview](../tests/components/note-link-preview.spec.ts) story 목적지의 실제 내용·추가 열기 없음 |
| S28b/c | hover/focus 읽기 전용·위/아래 카드의 좁은 연결 영역에서 시간과 무관한 hover 유지·영역 밖120ms 해제·Escape 초점 유지·안전한 로컬 제한 내용·오래된 팝업 정리 | U [note-preview](../tests/unit/note-preview.test.ts), [property-note-link](../tests/unit/property-note-link.test.tsx), [note-preview-bridge](../tests/unit/note-preview-bridge.test.ts) 내용/context 변경·언마운트·Escape/직접 callback; E/C note-link-preview          |
| S28d   | 관련 속성/preview에서 끝나는 운영 story, 좁은 창/두 테마에서 viewport 안 배치와 native 링크 geometry 유지                                                  | C note-link-preview320/960px·라이트/다크 작은 캡처, 기존 components/S26 정렬·초안 후보 한 번 클릭; V 운영 PropertiesLinks/preview/missing                                                             |

본문 편집기의 일반 클릭/수정자 이동 규칙은 그대로다. 미리보기는 저장소를 읽거나 생성/저장하지 않으며 HTML/네트워크를 실행하지 않는다. 실제 picker/권한·OS IME·스크린리더 확인은 합성 Chromium 증거와 구분한다.

## S29 연결 미리보기와 간결한 입력

기준: [S29](superpowers/specs/2026-10-26-writing-ux.md). S28의 속성 전용 범위, S24 읽는 속성40px, S20 수동 정리 검토 유지 요구를 명시적으로 확장/대체한다.

| 기준 | 기대 동작 | 검증 |
| --- | --- | --- |
| S29a | 같은 로컬 미리보기를 속성·본문·그래프에서 쓰고 본문 Tab은 선택/문법을 바꾸지 않으며 DOM 링크 Enter만 이동한다. 일반 클릭 편집·수정키 이동 유지. | E [writing-ux](../tests/e2e/writing-ux.spec.ts) 실제 Tab·CM 문서/선택·저장 바이트·Escape/Enter, 본문 hover/일반·수정키 클릭, 그래프 hover/직접 이동; E/C 기존 S28 지연·기하학적 연결·평문·수명·터치 회귀 |
| S29b | 작은 읽는 속성 행과 요청할 때만 여는 이름→값 행. 첫 속성도 값 확정 전 저장하지 않고 사용자 type을 강제하지 않는다. 초안/오류 보호. | U [property-controls](../tests/unit/property-controls.test.tsx) CRLF 정확한 패치·새type 왕복·미확정 초안·오류·Add 보호; E [writing-ux](../tests/e2e/writing-ux.spec.ts), [schema-editing](../tests/e2e/schema-editing.spec.ts), [property-modes](../tests/e2e/property-modes.spec.ts); C 실제 Create/PropertiesType/PropertiesNew |
| S29c | 수동 Format UI/story 제거, 자동 idle/CmdS·설정·undo·실패/복구 유지. | U [formatting](../tests/unit/formatting.test.tsx), E [auto-formatting](../tests/e2e/auto-formatting.spec.ts), [formatting](../tests/e2e/formatting.spec.ts); 제거된 story 대신 실제 자동 worker production 경로 유지 |
| S29d |320/390px 포함 왼쪽 세로 분류, 읽을 수 있는 라디오 행, 기존 임시설정·적용/취소 유지. | E [writing-ux](../tests/e2e/writing-ux.spec.ts) 분류/내용 상대위치·라디오 행/레이블 높이; E [settings](../tests/e2e/settings.spec.ts), C 실제 Settings; 독립 작은 라이트/다크 검토 |
