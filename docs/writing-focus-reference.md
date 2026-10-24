# CMS 참고와 Granite 개선 근거

2026-10-24, 소스 기준 확인. 참고 저장소의 현재 기본 브랜치 커밋은 `bce1def86351f6c57f73991c2eb6d1d54feefb25`이다. 운영 CMS 화면을 로그인해서 검사한 것은 아니다.

## 확인된 CMS 동작

- **링크 맥락:** 커서·선택이 링크 전체 구문과 교차할 때만 원문을 드러낸다. 양끝 경계도 포함한다. 같은 줄의 다른 위치는 해당하지 않는다. 평소에는 편집 가능한 레이블 텍스트만 남기고 `[`, `](URL)`을 감춘다. 일반 클릭은 텍스트 위치로 이동하며 별도 링크 이동 버튼이 아니다. [판정](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/livePreview.ts#L102-L106), [장식](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/livePreview.ts#L201-L219)
- **입력 중 주변 정보 약화:** 본문 입력 시 헤더·메타데이터가 흐려지고 마우스를 움직이면 돌아온다. 타이머나 문단별 흐림은 아니다. [동작](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/Editor.tsx#L74-L101), [스타일](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/admin.css#L662-L685)
- **한 열의 본문:** 발행 미리보기는 처음에는 닫혀 있다. 메타데이터를 접고 본문을 가운데 고정 폭으로 배치한다. [기본값](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/publishedPreview.ts#L11), [편집기](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/EditorCodeMirror.tsx#L67-L83)
- **가벼운 개요:** 제목이 여러 개면 현재 커서 구간을 표시한다. 넓은 화면에서는 제목, 좁아지면 막대 형태이며 hover/키보드 focus로 확장된다. [개요](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/Outline.tsx#L15-L29), [반응형](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/admin.css#L805-L865)
- **조합 입력 배려:** 조합 중에는 기존 장식을 매핑해 유지한다. Alt+Enter는 macOS 한자 변환과 겹치지 않게 바인딩하지 않는다. [조합 처리](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/livePreview.ts#L248-L256), [키 바인딩](https://github.com/moreal/blog.moreal.dev/blob/bce1def86351f6c57f73991c2eb6d1d54feefb25/src/admin/ui/EditorCodeMirror.tsx#L27-L44)

타자기식 커서 중앙 고정, 사용자 서체 설정 메뉴, 링크 hover 편집 팝업은 조사한 소스에서 확인되지 않았다.

## Granite quick review

범위: React + CodeMirror 6, 기존 plain CSS의 편집기·시작 화면·좌우 패널. 소스와 기존 데스크톱/좁은 창 캡처를 조사했다.

| 항목 | 확인 근거 | 결과 |
| --- | --- | --- |
| Typography | 제목/본문/폭 CSS와 캡처 | 대형 명조 제목과 과도한 위계 단순화 |
| Surfaces | 크림·초록 배경, 패널/카드 | 무채색과 평면 구조로 정리 |
| Animations | CSS와 reduced-motion | 새로운 애니메이션 추가 안 함; 실시간 느린 재생 검토는 범위 밖 |
| Icons | 집중/연결 패널 토글 | 실제 표시 상태에 맞는 이름·아이콘 필요 |
| Performance | 장식 업데이트 조건 | 프로파일링은 미실시; 새 라이브러리 도입 안 함 |

| 수준 | 위치 | 변경 전 | 변경 후 | 이유 |
| --- | --- | --- | --- | --- |
| Medium | Editor preview | 줄 단위로 모든 링크 원문 노출 | 링크 구문별 선택 교차 판정 | 무관한 주소가 글쓰기를 방해하지 않음 |
| Medium | 집중 모드/연결 버튼 | 집중 중 패널 열기가 화면에 반영 안 됨 | 실제 표시 상태와 제어 일치 | 동작과 피드백 일치 |
| Medium · 취향 반영 | 제목/장식 문구 | 명조 대형 제목, 식물·응원 문구 | 고딕 제목과 필요한 상태만 | 사용자의 글을 우선 |
| Medium · 취향 반영 | 색/카드 | 크림·초록의 장식적 화면 | 무채색, 구분선, 절제된 링크 색 | 더 간결한 시각 체계 |
| Medium | 본문 폭/행간 | 모드마다 다른 인상과 넓은 폭 | 17px/약1.8/최대700px | 한국어 본문 읽기와 입력 안정성 |

기본부터 집중 모드를 켜는 안은 첫 탐색을 숨기므로 채택하지 않았다. 백링크·재발견 제거는 제품 목적과 충돌하므로 채택하지 않았다. 현재 본문은 앞선 보완으로 이미 16px이므로 과거의 12–13px 상태를 현재 문제로 주장하지 않았다.

구현 기준: [간결한 글쓰기 스펙](superpowers/specs/2026-10-24-writing-focus.md). CMS의 자동 흐림·개요 전체를 이번 범위에 새로 추가하지 않는다.
