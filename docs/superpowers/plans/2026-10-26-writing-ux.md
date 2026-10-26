# S29 구현 계획

1. 기존 S28 제어기를 공유하여 속성·CodeMirror 렌더링 내부 링크·GraphItem에 연결한다. 본문 DOM 초점은 선택을 바꾸지 않고 Enter만 명시적으로 이동한다.
2. PropertyForm을 요청할 때만 여는 인라인 이름/값 행으로 바꾸고 기존 draft/commit 보호를 유지한다. 작은32px 속성 리듬을 적용한다.
3. 수동 formatter 진입·review UI·story/역사적 수동 테스트를 정리하고 자동 정리의 의미 있는 회귀를 유지한다.
4. 설정을 왼쪽 세로 분류와 오른쪽 내용으로 배치한다.
5. S29 집중 RED/GREEN, 관련 전체 unit/E2E/component/visual·타입·Pages 앱→Storybook 빌드를 실행한다. 실제 좁은 라이트/다크 화면을 검토하고 독립 리뷰 뒤 root가 main commit/push한다.
