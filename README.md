# Granite

데스크톱 Chrome에서 로컬 폴더의 Markdown을 읽고 쓰는 개인 지식 노트입니다. 데일리와 덤프에 조각을 모으고, 선택한 문장을 새 노트로 옮기며 생각을 연결합니다. 화면에서는 디렉터리를 정리할 필요 없이 노트에 집중합니다.

## 실행

Node.js 22.12 이상과 npm이 필요하며 Node.js 24 이상을 권장합니다. 검증 환경은 Node.js 26.12.0입니다.

```sh
npm ci
npm run dev -- --port 4173 --strictPort
```

로컬 주소 [http://127.0.0.1:4173](http://127.0.0.1:4173)를 데스크톱 Chrome에서 엽니다. **데모 둘러보기**로 시작하면 샘플 노트가 열립니다. **내 폴더 열기**를 선택하면 Chrome 선택창에서 직접 폴더를 고르고 읽기/쓰기 권한을 승인합니다.

## 먼저 써 보기

1. 데모의 **덤프**에 한 문장을 쓰고 **저장 완료**를 확인합니다.
2. 문장을 선택해 **새 노트로 옮기기**를 누르고 제목을 붙입니다. 새 노트가 열리고 원래 자리에는 링크가 남습니다.
3. **연결된 생각**의 백링크로 원본에 돌아옵니다. `[[`로 노트를 연결하고 `@`로 날짜와 기존 노트를 찾습니다.
4. URL을 붙여넣고 그대로 두거나 별칭을 붙입니다. **원문 보기**와 **라이브 프리뷰**를 오가며 Markdown을 확인합니다.

더 자세한 [한국어 리뷰 투어](docs/review-guide.md)와 [S01–S12 수용 검증표](docs/acceptance-matrix.md)가 있습니다. 실제 폴더를 처음 검증할 때는 폐기 가능한 새 폴더를 사용합니다.

## 저장과 범위

- 사용자 노트는 서버에 올리지 않습니다. 검색과 백링크는 기기에서 계산합니다. 데모는 실제 폴더와 분리된 브라우저 저장소를 사용합니다.
- 선택한 폴더 최상위의 `.md`만 읽고 씁니다. 하위 디렉터리는 탐색하지 않습니다. 특수문자 제목은 인코딩된 파일명, 긴 제목은 해시 파일명으로 저장하며 제목은 Markdown 메타데이터에 보존합니다. 일반 기존 Markdown의 본문은 무단 변환하지 않습니다.
- 자동 저장의 미저장·저장 중·실패·충돌을 구분합니다. 실패한 초안은 저장소별로 이 브라우저에 보관합니다. 브라우저 데이터를 지우면 데모와 복구 초안도 지워질 수 있습니다.
- 외부 수정과 충돌하면 자동 덮어쓰기를 거부합니다. **초안 다운로드**로 편집 내용을 꺼낼 수 있습니다. **디스크 내용 다시 읽기**는 확인 후 현재 초안을 버립니다.
- 새 노트로 옮기기는 대상 저장 후 원본 저장을 순서대로 수행합니다. 두 파일이 하나의 원자 작업으로 저장되는 것은 아닙니다. 대상만 저장되면 사본 안내와 원문이 남습니다.
- 외부 URL의 **제목 가져오기**는 해당 주소로 직접 요청합니다. CORS가 허용되는 응답만 읽을 수 있으며 실패하면 URL과 수동 별칭을 유지합니다. 인증·우회 프록시·외부 대행 서비스는 사용하지 않습니다.
- MVP는 데스크톱 Chrome 대상입니다. 제목 변경·삭제, 모바일 폴더 편집, 동기화·협업·계정·첨부 관리·AI 추천은 후속 범위입니다.

## 검증

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:report
```

E2E는 로컬 개발 서버를 시작하거나 이미 실행 중인 4173 포트의 Granite 서버를 사용합니다. CI에서는 기존 서버를 재사용하지 않고 직접 시작합니다. 각 브라우저 테스트는 독립된 저장소로 실행됩니다. 실패 화면과 trace 및 HTML 보고서는 `test-results/`, `playwright-report/`에 생성됩니다.

실제 파일 smoke test는 운영 폴더 어댑터를 실제 임시 디스크 파일에 연결한 handle 대역으로 검사합니다. Chrome의 네이티브 폴더 선택창과 권한 승인은 별도의 수동 검증입니다. 자동 통과만으로 권한 UI를 확인했다고 주장하지 않습니다. [검증 결과와 한계](docs/verification.md)를 참고하세요.

이 변경을 GitHub에 반영하면 모든 PR에서 [Tests 워크플로](.github/workflows/tests.yml)가 Ubuntu와 Node.js 24로 단위·타입·빌드 검사 및 Chromium 브라우저·디스크 검사를 실행합니다. 두 작업은 독립 실행하므로 단위 검사 실패로 브라우저 증거 수집이 생략되지 않습니다. GitHub의 PR **Checks → Tests → 실행 요약 → Artifacts**에서 `playwright-chromium-<run_id>-<run_attempt>`를 내려받을 수 있습니다. 생성된 HTML 보고서와 성공·실패 trace는 14일 보관합니다. 압축을 푼 폴더에서 `npx playwright show-report playwright-report` 또는 `npx playwright show-trace test-results/<테스트>/trace.zip`으로 확인합니다. [CI 검증 기록과 한계](docs/ci-verification.md)를 참고하세요.

## 피드백과 구현 기준

[도그푸딩 양식](.github/ISSUE_TEMPLATE/dogfooding.yml)에 스펙 위반 / 스펙 부족 / 방향 변경을 구분해 기록합니다. 스펙 부족과 방향 변경은 스펙부터 수정합니다.

- [MVP 스펙](docs/superpowers/specs/2026-10-23-granite-mvp-design.md)
- [구현 계획](docs/superpowers/plans/2026-10-23-granite-mvp.md)
- [리뷰 가이드](docs/review-guide.md)

라이선스: [MIT](LICENSE).
