# Granite

데스크톱 Chrome에서 로컬 폴더의 Markdown을 읽고 쓰는 개인 지식 노트입니다. 데일리와 덤프에 조각을 모으고, 노트를 쓰고 위키링크로 생각을 연결합니다. 화면에서는 디렉터리를 정리할 필요 없이 노트에 집중합니다.

## 실행

Node.js 24와 Yarn 4.18.1을 사용합니다. `package.json`이 Yarn 버전을 고정하고 `.yarnrc.yml`의 `nodeLinker: pnpm`이 `node_modules` 설치를 구성합니다. Corepack이 있는 Node.js 24에서는 `corepack enable` 후 아래 명령을 실행합니다. Corepack이 없는 환경의 공식 Yarn 직접 설치 방법과 검증 결과는 [Yarn 전환 기록](docs/yarn-migration.md)을 참고하세요.

```sh
yarn install --immutable
yarn dev --port 4173 --strictPort
```

로컬 주소 [http://127.0.0.1:4173](http://127.0.0.1:4173)를 데스크톱 Chrome에서 엽니다. **데모 둘러보기**로 시작하면 샘플 노트가 열립니다. **내 폴더 열기**를 선택하면 Chrome 선택창에서 직접 폴더를 고르고 읽기/쓰기 권한을 승인합니다.

## 먼저 써 보기

1. 데모의 **덤프**에 한 문장을 쓰고 **저장 완료**를 확인합니다.
2. **새 노트**로 생각에 제목을 붙이고 글을 씁니다. 덤프에 `[[새 노트 제목]]`을 적어 연결합니다.
3. **연결된 생각**의 백링크로 원본에 돌아옵니다. `[[`로 노트를 연결하고 `@`로 날짜와 기존 노트를 찾습니다.
4. URL을 붙여넣고 그대로 두거나 별칭을 붙입니다. **원문 보기**와 **라이브 프리뷰**를 오가며 Markdown을 확인합니다.

더 자세한 [한국어 리뷰 투어](docs/review-guide.md)와 [수용 검증표](docs/acceptance-matrix.md)가 있습니다. 실제 폴더를 처음 검증할 때는 폐기 가능한 새 폴더를 사용합니다.

## 편집 예제와 공개 데모

데모의 **직접 고쳐 보는 생각의 지도** 노트에서 네 가지 표현을 직접 편집해볼 수 있습니다. 기존 데모에도 한 번 추가하며 사용자 노트와 수정 내용은 보존합니다.

GitHub Pages는 `main` 변경을 [공개 앱](https://moreal.github.io/granite/)에 자동 배포하도록 구성합니다. 최초 배포 전까지 주소가 열리지 않을 수 있습니다. PR에서는 배포용 빌드와 zizmor 워크플로 보안 검사를 수행합니다. [배포 및 검사 안내](docs/pages-deployment.md)를 참고하세요. 공개 앱도 노트는 사용자의 기기에 저장하며, localhost와 Pages는 서로 다른 브라우저 저장소를 사용합니다.

## 저장과 범위

- 사용자 노트는 서버에 올리지 않습니다. 검색과 백링크는 기기에서 계산합니다. 데모는 실제 폴더와 분리된 브라우저 저장소를 사용합니다.
- 선택한 폴더 최상위의 `.md`만 읽고 씁니다. 노트 하위 디렉터리는 탐색하지 않습니다. 이미지 첨부는 내부 `assets/` 디렉터리에 원본 SHA-256 파일명으로 저장합니다. 특수문자 제목은 인코딩된 파일명, 긴 제목은 해시 파일명으로 저장하며 제목은 Markdown 메타데이터에 보존합니다. 일반 기존 Markdown의 본문은 무단 변환하지 않습니다.
- 자동 저장의 미저장·저장 중·실패·충돌을 구분합니다. 실패한 초안은 저장소별로 이 브라우저에 보관합니다. 브라우저 데이터를 지우면 데모와 복구 초안도 지워질 수 있습니다.
- 외부 수정과 충돌하면 자동 덮어쓰기를 거부합니다. **초안 다운로드**로 편집 내용을 꺼낼 수 있습니다. **디스크 내용 다시 읽기**는 확인 후 현재 초안을 버립니다.
- ‘새 노트로 옮기기’ 기능은 제거되었습니다. 기존 노트와 링크는 그대로 유지됩니다.
- 외부 URL의 **제목 가져오기**는 해당 주소로 직접 요청합니다. CORS가 허용되는 응답만 읽을 수 있으며 실패하면 URL과 수동 별칭을 유지합니다. 인증·우회 프록시·외부 대행 서비스는 사용하지 않습니다.
- MVP는 데스크톱 Chrome 대상입니다. 제목 변경·삭제, 모바일 폴더 편집, 동기화·협업·계정·첨부 정리/삭제·AI 추천은 후속 범위입니다.

## 이미지와 수식·다이어그램

이미지를 붙여넣으면 PNG/JPEG/GIF/WebP 원본을 로컬 `assets/`에 저장하고 상대 Markdown 링크를 넣습니다(파일당 20 MiB). 같은 이미지는 중복 저장하지 않습니다. 데모 이미지는 별도 IndexedDB에 보관합니다.

수식은 `$x^2$`와 별도 줄의 `$$` 블록으로 작성하며 KaTeX가 표시합니다. 코드 fence는 언어별로 색상을 표시하고 `mermaid` fence는 다이어그램으로 표시합니다. 해당 표현을 편집할 때는 원문으로 돌아가며, 원문 보기에서는 전체 Markdown이 보입니다. 문법 오류가 있어도 원문은 보존됩니다. 세부 선택과 검증 기준은 [본문 표현 스펙](docs/superpowers/specs/2026-10-24-rich-note-content.md)에 기록합니다.

## 타입과 연결

노트 앞의 YAML frontmatter에 `type: Book` 같은 schema.org 타입과 `author: "[[저자]]"` 같은 속성을 넣을 수 있습니다. 접을 수 있는 **속성** 영역에서 원문 YAML을 편집하며, 연결 패널은 본문 링크와 속성 이름을 가진 관계를 보여줍니다. 미지정 속성·주석은 자동 변환하지 않습니다. [설계와 범위](docs/superpowers/specs/2026-10-25-typed-notes-visual-review.md)를 참고하세요.

## 검증

```sh
yarn test
yarn typecheck
yarn build
yarn playwright install chromium
yarn test:e2e
yarn test:report
```

E2E는 로컬 개발 서버를 시작하거나 이미 실행 중인 4173 포트의 Granite 서버를 사용합니다. CI에서는 기존 서버를 재사용하지 않고 직접 시작합니다. 각 브라우저 테스트는 독립된 저장소로 실행됩니다. 실패 화면과 trace 및 HTML 보고서는 `test-results/`, `playwright-report/`에 생성됩니다.

실제 파일 smoke test는 운영 폴더 어댑터를 실제 임시 디스크 파일에 연결한 handle 대역으로 검사합니다. Chrome의 네이티브 폴더 선택창과 권한 승인은 별도의 수동 검증입니다. 자동 통과만으로 권한 UI를 확인했다고 주장하지 않습니다. [검증 결과와 한계](docs/verification.md)를 참고하세요.

이 변경을 GitHub에 반영하면 모든 PR에서 [Tests 워크플로](.github/workflows/tests.yml)가 Ubuntu와 Node.js 24로 단위·타입·빌드 검사 및 Chromium 브라우저·디스크 검사를 실행합니다. 두 작업은 독립 실행하므로 단위 검사 실패로 브라우저 증거 수집이 생략되지 않습니다. GitHub의 PR **Checks → Tests → 실행 요약 → Artifacts**에서 `playwright-chromium-<run_id>-<run_attempt>`를 내려받을 수 있습니다. 생성된 HTML 보고서와 성공·실패 trace는 14일 보관합니다. 압축을 푼 폴더에서 `yarn playwright show-report playwright-report` 또는 `yarn playwright show-trace test-results/<테스트>/trace.zip`으로 확인합니다. [CI 검증 기록과 한계](docs/ci-verification.md)를 참고하세요.

Chromatic은 합성 데모의 별도 Playwright 시각 검사로 연결합니다. 로컬 실행은 `VITE_BASE_PATH=/granite/ yarn build` 후 `yarn test:visual`이며, 원격 게시에는 `CHROMATIC_PROJECT_TOKEN` Actions secret이 필요합니다. [설정 안내](docs/chromatic.md)를 참고하세요.

## 피드백과 구현 기준

[도그푸딩 양식](.github/ISSUE_TEMPLATE/dogfooding.yml)에 스펙 위반 / 스펙 부족 / 방향 변경을 구분해 기록합니다. 스펙 부족과 방향 변경은 스펙부터 수정합니다.

- [MVP 스펙](docs/superpowers/specs/2026-10-23-granite-mvp-design.md)
- [구현 계획](docs/superpowers/plans/2026-10-23-granite-mvp.md)
- [리뷰 가이드](docs/review-guide.md)

라이선스: [MIT](LICENSE).
