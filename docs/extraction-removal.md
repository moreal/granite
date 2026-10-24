# 새 노트로 옮기기 제거

2026-10-24 사용자의 명시적 **방향 변경**. S05는 폐기 상태로 유지해 과거 수용 기준 번호를 재사용하지 않는다.

본문 선택에서 노트를 추출하는 버튼·대화상자·두 파일 저장 작업과 전용 스타일을 제거했다. 일반 새 노트 생성, 없는 링크의 노트 생성, 위키링크, 백링크와 선택에 따른 주변 UI 복원은 유지한다. 저장 데이터 마이그레이션·삭제는 없다. 새 데모의 안내만 변경하며 이미 저장된 데모는 사용자 글로 취급해 그대로 둔다.

변경 파일:

- `src/App.tsx`, `src/styles.css`, `src/storage/demo.ts`; `src/domain/extract.ts` 삭제.
- `tests/unit/core.test.ts`의 추출 전용 3개 테스트 제거. `tests/e2e/extraction-failure.spec.ts` 삭제. `tests/e2e/journeys.spec.ts`의 추출 흐름을 선택 후 본문 보존·일반 생성·백링크 검증으로 대체. 기존 일반 생성/편집/새로고침 S02 테스트 유지. `tests/e2e/typing-chrome.spec.ts`에서 사라진 footer 검사만 제거.
- `AGENTS.md`, `README.md`, `docs/acceptance-matrix.md`, `docs/review-guide.md`, MVP 및 writing-focus 스펙, `docs/verification.md`의 현재 범위 안내 갱신. 과거 검증 결과는 보존.

## 실행 증거와 남은 검증

Node.js 24.18.0, Yarn 4.18.1에서 실행했다.

- `yarn test tests/unit/core.test.ts`: 19개 통과.
- `yarn test`: 기존 4개 파일 41개 통과. 동시에 구현 중인 이미지 저장소의 `assets.test.ts` 3개는 `putImage` 미구현 시점에 실패했다.
- `yarn typecheck`: 같은 병렬 구현 중 `DirectoryStorage.putImage/readImage` 부재로 실패했다. 추출 제거 파일에서 오류는 보고되지 않았다.
- 전체 E2E 및 실제 데스크톱·좁은 창 렌더 검사는 통합 담당자가 수행한다. 새 선택 보존·백링크 E2E는 작성했지만 이 작업에서는 실행하지 않았다. 네이티브 폴더 선택·권한 UI는 검증하지 않았다.

통합 주의: 이미지 기능을 위해 App, styles 및 활성 범위 문서를 추가 수정할 수 있다. 저장소 이미지 구현 완료 후 전체 테스트·타입 검사를 다시 실행해야 한다. 충돌 해결이나 기존 데이터 변경은 수행하지 않았다.
