# 이미지·수식·코드·다이어그램 편집

2026-10-24. [S13/S14 명세](superpowers/specs/2026-10-24-rich-note-content.md)에 따른 구현이다.

## 구현

- 이미지 붙여넣기는 URL 처리보다 먼저 실행한다. 여러 이미지를 순서대로 저장하고 모든 쓰기가 성공한 뒤 한 편집으로 상대 Markdown 링크를 넣는다. 선택한 글은 쓰기 실패 때 그대로 남는다. 앞쪽 편집은 대기 위치에 반영하고 선택 영역 변경·잠금·노트/저장소 변경·unmount는 오래된 삽입을 취소한다. 미참조 이미지의 자동 삭제는 없다.
- App은 실제 저장소를 캡처한 콜백과 저장소+파일명 식별자를 Editor에 전달한다. 저장 진행/실패 안내는 입력 중 흐려지는 UI 밖에 있다. 이미지 프리뷰는 디코딩 후 허용된 CAS 상대 경로만 읽고, 위젯 제거 시 object URL을 폐기한다. 뒤늦은 읽기 결과는 무시한다.
- CodeMirror language-data로 fenced code 언어를 지연 로드하고 키워드·문자열·숫자·주석 등을 구분한다. 알 수 없는 언어는 평문으로 유지한다.
- KaTeX는 로컬 CSS/폰트를 포함한다. 인라인과 블록 수식은 trust:false, 새 macros 객체, maxExpand:100, maxSize:20, htmlAndMathml 설정으로 렌더링한다. escape와 코드/링크/URL/통화 경계를 구분하고 숫자로 시작하는 일반 수식도 지원한다.
- Mermaid는 필요할 때 지연 로드한다. strict 보안·HTML label 비활성화·자동 시작 비활성화 상태에서 config/클릭/이미지/외부 URL/HTML/CSS URL 소스를 렌더링 전에 거부한다. 결과 SVG의 script·event handler·외부 참조·외부 CSS 리소스도 거부한다. 잘못된 수식/다이어그램은 원문과 오류 표시로 남고 클릭해 편집할 수 있다.
- 여러 줄 블록은 직접 StateField 장식을 사용한다. 선택이 구문에 닿으면 원문으로 돌아가고 원문 모드에서는 모든 장식을 제거한다. 한글 조합 편집 중 기존 장식을 위치 매핑만 하고 compositionend에 다시 만든다. 긴 문서도 전체 Markdown 구문 분석으로 코드 내부의 달러 문자를 수식으로 오인하지 않는다.

## 검증 증거

- `tests/unit/rich-preview.test.ts`: S14 코드/링크/URL/통화/escape/긴 문서 구분, 숫자 수식, Mermaid 소스 차단, SVG 외부 참조/스크립트 거부.
- `tests/unit/image-paste.test.tsx`: S13 저장 전 본문 유지, 대기 중 앞쪽 편집 위치 반영, 선택 영역 수정·잠금·노트 전환·unmount 취소, 여러 이미지 순서와 후속 실패 시 본문 보존.
- `tests/unit/image-preview.test.tsx`: S13 object URL 해제·파괴된 위젯의 늦은 읽기 무시, S14 조합 입력 중 위젯 유지.
- `tests/e2e/rich-content.spec.ts`: 합성 이미지 clipboard→실제 데모 IndexedDB 저장→새로고침 후 이미지, SVG 붙여넣기 오류, 실제 KaTeX/Mermaid/코드 렌더링, 수식 클릭 원문 편집, 원문 모드, 위험한 내용의 무네트워크 폴백, 좁은 창.
- 집중 UI 브라우저 검사 3개 통과(9.5초). 데스크톱 1440×900 및 좁은 창 760×900 화면을 실제 열어 확인했다. 수식·코드·다이어그램과 저장 상태가 보이고 가로 넘침은 없었다. [데스크톱](screenshots/rich-desktop.png), [좁은 창](screenshots/rich-narrow.png).

최종 통합 검사: `yarn install --immutable` 성공, 단위 8개 파일 71개 통과(2.14초), `yarn typecheck` 종료 0, `yarn build` 종료 0, Chromium·실제 디스크 어댑터 E2E 48개 통과(57.3초). 기존 lock 해상도는 모두 보존되었고 의존성 업그레이드는 없었다. 빌드는 500kB 초과 청크 안내를 출력했다(메인 약 795kB, 지연 로드되는 Mermaid ELK 약 1.46MB). 기존 4173/5173 개발 서버는 유지하고 `/private/tmp/granite-rich-preview-run` 사본의 포트 및 동일 출처 assertion만 4174로 변경했다. Node.js 24.18.0, Yarn 4.18.1과 immutable 설치를 사용했다.

## 수정 과정과 한계

초기 브라우저 검사에서 인라인 KaTeX 위젯 클릭 영역이 숨겨진 MathML의 작은 사각형으로 잡히는 문제를 발견하고 inline-block으로 수정했다. 임시 사본의 node_modules 심볼릭 링크는 Vite 폰트 허용 경로 문제를 만들어 실제 immutable 설치로 교체했다. 이 개발 환경 문제는 원본 제품 경로의 실패로 해석하지 않는다. 네트워크 검사에서 초기 about:blank와 비교하던 테스트 오류는 설정된 baseURL과 비교하도록 고쳤다.

OS 클립보드, 네이티브 폴더 선택/권한 UI와 실제 macOS IME는 이 자동 테스트로 검증하지 않았다. clipboard는 합성 이벤트이고 이미지 데모 영속성은 실제 브라우저 IndexedDB이다. 저장 어댑터의 실제 디스크 증거 및 한계는 별도 저장 검사 기록을 따른다. Mermaid는 안전을 위해 전체 문법/설정/인터랙션 호환성을 약속하지 않으며 지원하지 않는 입력은 원문으로 편집 가능하다.
