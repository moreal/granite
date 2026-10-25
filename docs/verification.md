# Granite MVP 검증 기록

## 2026-10-24 이미지·본문 표현 및 옮기기 제거

통합 검증: Node.js 24.18.0, Yarn 4.18.1 immutable 설치, 단위 71개·E2E 48개 통과, 타입 검사·빌드 통과. 이미지 저장/외부 변경·IndexedDB 영속성·붙여넣기 취소·KaTeX/Mermaid/코드 표현과 기존 여정을 포함한다. [본문 표현 보고서](rich-editor.md), [이미지 저장소](image-assets.md), [기능 제거](extraction-removal.md), [스펙](superpowers/specs/2026-10-24-rich-note-content.md)을 참조한다. OS 클립보드·네이티브 폴더 권한·실제 IME 검증을 추가로 주장하지 않는다.

2026-10-24 방향 변경: S05 옮기기는 폐기되었다. 아래 추출·옮기기 결과는 당시 기능의 역사적 증거이며 현재 기능 범위를 뜻하지 않는다. [제거 변경 기록](extraction-removal.md).

현재 설치·검증 절차는 [Yarn 전환 기록](yarn-migration.md)이 대체한다. 아래 npm 실행 결과는 당시 증거로 보존한다.

PR 자동 검증 추가(2026-10-24): [CI 구성·로컬 증거·호스팅 검증 한계](ci-verification.md).

최신 입력 집중 검증(2026-10-24): [주변 UI 흐림 결과](typing-chrome-implementation.md). 최종 단위 44개, 브라우저·디스크 41개(32.6초), 타입 검사·빌드 통과. 실제 Chrome DevTools에서 입력·Tab·마우스 이동·날짜 명령·재입력·reduced-motion과 중요한 상태의 opacity를 확인했고 독립 재검토 승인을 받았다.

이전 화면·링크 개선 검증(2026-10-24): [글쓰기 집중 화면 결과](writing-focus-implementation.md). 최종 단위 42개와 브라우저·디스크 33개 통과, 타입 검사·빌드 성공, 독립 재검토 승인. 링크별 편집 범위, 일반 클릭 편집/수정키 클릭 이동, 실제 본문 서체와 좁은 집중 화면을 추가 검증했다.

이전 추가 검증(2026-10-24): [Chrome DevTools 한글 검증](devtools-korean-verification.md). 한글 생성·수정·검색·링크·옮기기·재접속과 실제 OPFS 파일 핸들 저장을 확인했다. 새로 생성/추출한 노트의 마지막 열림 상태 누락을 수정했으며, 최신 전체 테스트는 단위 38개와 브라우저·디스크 28개가 통과했다. 아래 표는 최초 MVP 검증 기록이다. 실제 사용자 폴더 권한창과 macOS IME 조합은 여전히 직접 확인이 필요하다.

기준: [S01–S12 스펙](superpowers/specs/2026-10-23-granite-mvp-design.md), [수용 검증표](acceptance-matrix.md). 실행일은 2026-10-23이다. 독립 검토에서 발견한 복구 후보 전환/이전 초안 정리의 2차 수정을 포함해 자동 검증이 통과했다. Chrome 네이티브 권한창 등 아래 수동 항목은 미검증이다.

## 실행 결과

| 명령                | 실제 결과                                                    |
| ------------------- | ------------------------------------------------------------ |
| `npm test`          | 4개 파일, 38개 테스트 통과                                   |
| `npm run typecheck` | 앱과 E2E/설정/파일 handle helper 타입 검사 통과, 종료 코드 0 |
| `npm run build`     | 프로덕션 빌드 통과, 종료 코드 0                              |
| `npm run test:e2e`  | 26개 통과, 22.2초. 브라우저 19개 + 실제 디스크 어댑터 7개    |

macOS arm64, Node.js 26.12.0, Playwright가 설치한 Chromium 156.0.8078.4(revision 1248)로 검증했다. 최종 실행은 실행 파일 경로 환경변수 없이 일반 명령을 사용했다. 빌드는 약 796 kB(압축 전)의 JavaScript 청크에 크기 안내를 출력했지만 성공했다.

## 재현 명령

```sh
yarn install --immutable
yarn playwright install chromium
yarn test
yarn typecheck
yarn build
yarn test:e2e
yarn test:report
```

E2E는 `http://127.0.0.1:4173`에서 실행한다. 이미 실행 중인 Granite가 없으면 개발 서버를 직접 시작한다. UI 여정은 매 테스트마다 독립된 브라우저 저장소로 시작하며, 두 탭 검증만 같은 브라우저 컨텍스트를 공유한다. 임시 디스크 표본은 테스트가 만든 뒤 정리한다.

## 자동 검증 범위

| 범위               | 확인하는 동작                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 데모 UI            | 시작·생성·편집·저장·새로고침·제목/본문 검색·중복/빈 제목 거부                                                                                         |
| 옮기기             | 선택 내용 이동·원래 위치 링크·백링크 복귀, 대상 실패/원본 실패 시 데이터 보존과 사본 안내                                                             |
| 편집과 연결        | 위키링크 키보드 선택/취소·없는 노트 생성, 날짜 메뉴·이메일 예외, 원문/라이브 프리뷰, 코드의 가짜 연결 제외, 사용자 HTML 비실행, 여러 줄 Markdown 링크 |
| URL                | 그대로/별칭/선택 텍스트 별칭·Escape·계속 입력, 제목 성공/실패/지연·취소 뒤 응답 무시                                                                  |
| 복구               | 저장 실패 후 이동·새로고침, 외부 변경 충돌·초안 다운로드·명시적 다시 읽기, 두 탭의 저장/초안 충돌                                                     |
| 레이아웃/키보드    | 집중 모드·연결 패널·다시 발견, 대화상자 포커스와 Escape, 1440×900 및 760×900 화면                                                                     |
| 실제 디스크 어댑터 | 최상위 목록·일반 Markdown 보존·인코딩/긴 제목·중복 거부·외부 충돌·createWritable/write/close 실패·close 완료 대기                                     |

파일 smoke test는 운영 `DirectoryStorage`를 Node 파일 I/O로 뒷받침한 최소 handle 대역에 연결한다. 디스크의 파일명과 원문 바이트를 별도로 확인한다. 메모리 저장만으로 성공을 주장하지 않으며, 실제 Chrome handle이나 권한 UI를 대체했다고 주장하지 않는다.

URL 제목 응답은 재현 가능한 네트워크 대역으로 성공·실패·지연을 만든다. 붙여넣기는 실제 편집기의 paste 처리에 ClipboardEvent를 전달한다. 운영체제 클립보드와 실제 외부 사이트 CORS 정책을 이 자동 결과로 검증하지 않는다.

## 수동 확인이 남는 항목

- 설치된 데스크톱 Chrome에서 실제 폴더 선택·선택 취소·권한 승인/거부·권한 철회·재연결.
- 같은 마지막 이름을 가진 서로 다른 실제 폴더의 초안 분리와 재연결 뒤 복구.
- 실제 한글 IME 조합 중 메뉴/Enter가 입력을 가로채지 않는지.
- 실제 외부 사이트의 CORS 성공/차단과 운영체제 클립보드 붙여넣기.
- 읽기 편한 정도와 글쓰기 흐름에 대한 사용자 판단. 화면 캡처는 모든 접근성 검증을 대신하지 않는다.

[리뷰 가이드](review-guide.md)와 [네이티브 Chrome 확인표](acceptance-matrix.md#네이티브-chrome-수동-확인표)에서 절차를 제공한다. 수행하지 않은 항목은 미검증으로 남긴다.

## 증거 파일

`playwright-report/index.html`에 테스트 결과·첨부 화면·trace가 생성된다. `test-results/`는 다음 실행에서 교체되므로 필요한 증거는 별도로 보관한다. HTML 보고서는 `yarn test:report`, trace는 `yarn playwright show-trace <trace.zip 경로>`로 연다.

다음 화면은 최종 테스트에서 캡처한 뒤 실행 결과 폴더 밖에 보존했고 실제로 열어 확인했다. 데스크톱은 1440×900, 좁은 창은 760×900이다. 주요 글쓰기 영역·저장 상태·버튼이 보이고 가로 넘침이 없었다. 좁은 화면에서는 연결 패널이 본문 아래로 이어진다.

- [시작 화면](screenshots/welcome.png)
- [데스크톱](screenshots/desktop.png)
- [좁은 창](screenshots/narrow.png)

이슈 재현과 수정 후 확인 내역은 [Task 2 보고서](task-2-report.md)에 기록한다.

## 2026-10-25 편집기 플러그인 / 문서 정리 (S04/S17/S20)

고정 Hongdown 0.5.3 실제 Node WASM과 Chromium worker를 사용한다. 원문/결과 검토, 취소, 적용과 단일 undo, 리비전/키/잠금/조합 이벤트 무효화, 유효 CRLF frontmatter 보존과 오류 거절, 위키/이미지/수식/Mermaid 보호를 검증한다. `/granite/` production build에서 worker 및 2.49 MB WASM의 같은 출처 요청을 확인한다. 화면 증거는 `docs/screenshots/formatting-{light,dark}-{1440,390}.png` 및 `editor-plugins-*`다. 전체 실행 결과는 `.superpowers/hongdown/task-2-report.md` 작업 보고에 기록한다. 테스트 저장소는 데모이며, 실제 사용자 폴더 picker/권한 또는 OS 네이티브 IME는 검증하지 않았다.

## 2026-10-25 기본 자동 문서 정리 (S20)

[승인 기준](superpowers/specs/2026-10-25-auto-formatting.md)에 따라 기본 활성화, 설정 → 글쓰기의 비활성화, 입력 후 1500ms 대기, 선택·조합·메뉴 대기, 오래된 결과 취소, undo 억제와 수동 정리 공존을 추가했다. 최종 단위 158개, 기존·자동 정리 브라우저 74개, 프로덕션 `/granite/` 시각 검증 9개, 타입 검사와 빌드가 통과했다. 라이트/다크 1440/390 설정 화면을 `docs/screenshots/auto-format-*.png`에 보존했다. 합성 IME·데모 저장과 디스크 어댑터 검증이며 실제 폴더 권한창·네이티브 IME 검증은 아니다. 추가한 실제 worker 요청 실패·정상 저장·재열기 회귀를 포함한 자동 정리 3개도 별도로 통과했다(전체 브라우저 검사 항목은 75개). 상세 실행 기록은 `.superpowers/auto-format/report.md`에 있다.

## 2026-10-25 스키마 편집 (S21/S22)

[승인 기준](superpowers/specs/2026-10-25-solid-schema-storybook.md)에 따라 오프라인 카탈로그의 유형·속성 검색, 여러 유형의 추천 합집합, 중복 키 제외, 정확한 문자열 패치와 빈 값 포커스를 추가했다. YAML 패널과 전체 원문/드러난 라이브 frontmatter는 동일한 범위 계획을 사용한다. 댓글·중첩 값·본문에 키를 넣지 않으며 잘못된 YAML은 그대로 편집 가능하다. 후보를 연 뒤 커서 이동·범위 선택 시 오래된 후보를 적용하지 않는다.

단위 202개, 앱/E2E 타입 검사, production 및 `/granite/` 빌드가 통과했다. 새 schema 브라우저 8개와 기존 애니메이션 2개의 집중 검사, 최종 전체 브라우저 87개와 프로덕션 시각 검사 9개가 통과했다. 첫 전체 실행의 기존 애니메이션 한 프레임 표본 실패(기대 `opacity > 0.3`, 실제 `0.3`)는 같은 소스의 집중 재검사에서 재현되지 않았으며 최종 전체 실행 결과는 `.superpowers/solid-schema/task3-report.md`에 기록한다.

`docs/screenshots/property-{create,open}-{320,390}-{light,dark}.png`는 실제 운영 컨트롤의 확대 캡처다. 생성 폼의 포커스와 열린 목록 전체를 직접 검토했고 레이블/컨트롤 겹침과 문서 가로 넘침이 없었다. Storybook 독립 fixture 검증은 별도 기록이다. 데모와 합성 composition 이벤트를 사용했으며, 실제 사용자 폴더 picker/권한창·OS IME 또는 Chromium 이외 엔진의 textarea undo를 검증했다고 주장하지 않는다.

## 2026-10-25 독립 컴포넌트 검토 (S22)

실제 운영 Solid2 컴포넌트의 Storybook23개와 Chromium 검사23개가 통과했다.320px에서 라이트/다크·열림·포커스·오류·disabled·긴 한글29개를 컴포넌트와 absolute 팝업의 전체 범위로 캡처하고 직접 검토했다. 레이블/컨트롤 겹침과 가로 넘침을 자동 검사하며 날짜 경계·유형 선택·ISBN 완성·편집모드·설정 스위치의 실제 상호작용을 확인했다. 대표 증거는 `screenshots/storybook-{create-open,property-open,recovery-dark,format}-320.png`다.

[재현 안내](storybook.md): `VITE_BASE_PATH=/granite/ yarn build` 뒤 `yarn build:storybook`을 실행하고 `yarn test:components`, `yarn test:visual`을 실행한다. 개발 탐색기는 `yarn storybook`의6006포트, 배포 경로는 `/granite/storybook/`이다. Storybook iframe6개의 Chromatic Playwright 아카이브 검사가 별도로 통과했으며 기존 앱 프로젝트와 같은 업로드에 합친다. CI는 보고서·trace·빌드된 탐색기를 보관한다. 대응 소스 압축을 추출해 immutable 설치와 앱/Storybook 빌드도 확인했다. 원격 Pages/Chromatic 게시는 commit/push 뒤 exact-head Actions로 별도 확인한다.

최종 통합에서 기존 opacity 전환 검사가 `transitionrun` 이전에 animation 객체의 존재만 확인해 시작값0.3을 읽는 타이밍 경쟁을 재현했다. 테스트만 paused/currentTime60 조건까지 기다리도록 수정했으며120ms·중간 opacity·중단/역전·reduced-motion 기준은 유지했다. 두 모드 각5회10개와 최종 전체87개가 통과했다. 운영 애니메이션은 바꾸지 않았다.

같은 최종 빌드의 통합 시각 검사15개(앱9+Storybook iframe6)가9.4초에 통과했고 하나의 기존 Chromatic Playwright 아카이브에 기록됐다. 로컬 Pages 경로 `/granite/storybook/` 관리 화면과 실제 Property iframe도 열어 combobox 렌더링과 pageerror0개를 확인했다. 최종 소스 제공물은136개 허용 입력과310개 배포 파일의 SHA-256를 대조했으며, 추출본 immutable 설치와 앱/Storybook 재빌드가 통과했다.


## 2026-10-25 저장 시 정리와 직접 속성 값 편집 (S20/S21)

[승인 기준](superpowers/specs/2026-10-25-save-properties.md)에 따라 Cmd/Ctrl+S는 설정이 켜져 있으면 확인창 없이 안전한 정리를 기다린 뒤 workspace flush를 호출한다. 내부 수동 미리보기 API와 안전성 단위 검증은 유지하고 상단 수동 버튼은 제거했다. 선택·조합·완성/붙여넣기 메뉴·오래된 문서 결과는 보호하며 실패는 원문 저장을 막지 않는다.

속성 선택은 저장되지 않은 값 초안을 열고 Enter/적용으로 확정, Escape/취소로 버린다. 기존 단일 값은 YAML AST의 값 토큰만 바꾸며 주석·CRLF·알 수 없는 키·본문을 보존한다. 숫자/불리언/null 입력을 검증하고 배열·맵·여러 줄 값은 접힌 YAML 보조 편집기로 연결한다. 문서 또는 원문이 바뀐 초안은 오류와 값을 보관하며 덮어쓰지 않는다. 실제 CtrlS 속성 초안 확정과 그래프 갱신은 브라우저 회귀로 확인한다. 폴더 선택기와 실제 권한 흐름 검증과는 별도다.
