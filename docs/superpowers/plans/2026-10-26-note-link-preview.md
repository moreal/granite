# S28 구현 계획

기준: [S28](../specs/2026-10-26-note-link-preview.md), 기존 S01/S04/S06/S10/S12/S25/S26/S27. 현재 main에서 root의 리뷰·통합 전까지 구현한다.

1. 운영 openTitle/초안 보호와 Storybook 합성 목적지/결과의 차이를 확인하고 작은 현재 화면을 기록한다. hover 미리보기와 첫 클릭 직접 이동 회귀를 먼저 실패시킨다.
2. 기존 frontmatter 파서를 쓰는 제한된 일반 텍스트 preview 투영과 메모리 전용 조회를 만든다. App→NoteHeader→NoteProperties→PropertyForm→PropertyRow로 전달한다. 저장/편집기/완성 상태기를 바꾸지 않는다.
3. 네이티브 inline Button 위의 작은 PropertyNoteLink를 구현한다. 제목/내용만 있는 비모달 top-layer popover, hover intent/키보드 초점, hover 유지/Escape/해제/정리를 소유한다. 포인터 클릭의 초점 유지와 직접 guarded onOpen을 보존한다. 배치/색/간격은 기존 토큰을 쓴다.
4. Storybook의 가짜 중간 조작/작업 결과를 정리하고 실제 합성 노트 내용의 직접 이동과 작은 미리보기/빈·없는·긴 내용 예제를 제공한다. PropertiesLinks play는 관련 속성/미리보기에서 끝낸다.
5. 집중 단위/앱/운영 story 회귀, 타입 검사, Pages 앱→Storybook 빌드를 순서대로 실행한다. 관련 전체 컴포넌트와 시각 검사를 하고320/390px·두 테마 실제 화면을 열어 확인한다. root의 독립 코드/화면 리뷰에 대응하고 실행 기록/한계를 남긴다.
