# GitHub Pages 배포와 워크플로 보안

2026-10-24. 수용 기준은 [S15 데모·S16 배포/보안](superpowers/specs/2026-10-24-demo-pages-security.md)을 따른다. 공개 주소는 <https://moreal.github.io/granite/>다. Pages에는 앱 정적 파일만 배포하며 사용자 노트나 로컬 첨부 파일을 업로드하지 않는다.

## 배포 경계

`.github/workflows/pages.yml`은 PR, `main` push, 수동 실행에서 프로덕션 빌드와 Pages artifact 생성을 검증한다. 게시 작업은 `main` 브랜치이면서 PR 이벤트가 아닌 경우에만 실행한다. 다른 브랜치에서 수동 실행해도 게시하지 않는다. PR 빌드에는 `contents: read`만 제공하고 checkout 인증 정보를 남기지 않는다. 게시 job에만 `pages: write`와 `id-token: write`를 부여한다.

빌드에는 의존성 캐시를 사용하지 않는다. 기존 테스트 workflow의 Yarn 캐시는 읽기 전용 테스트 job에 남겨 두되 Pages 빌드에서 복원하지 않으므로 게시 산출물의 의존성 입력으로 쓰이지 않는다. 게시 concurrency는 `github-pages`, `cancel-in-progress: false`여서 진행 중인 게시를 새 실행이 취소하지 않는다. GitHub concurrency는 대기 중 실행을 교체할 수 있으며 모든 중간 커밋의 순차 게시를 보장하지 않는다.

저장소 Settings → Pages → Source는 **GitHub Actions**로 설정한다. `github-pages` 환경의 기존 보호 규칙은 유지한다. 설정과 게시 성공은 별개다. 2026-10-24 저장소 API에서 `build_type: workflow`, `https_enforced: true`, 위 공개 주소를 확인했으며, 이 기록 시점에 첫 배포는 아직 관찰하지 않았다. 최초 게시는 워크플로가 `main`에 병합된 뒤 실행 결과와 공개 주소를 확인해야 한다. PR 상태 검사는 구성되지만 branch protection의 필수 검사로 지정했다고 주장하지 않는다.

## 경로와 로컬 재현

Vite `base`는 `VITE_BASE_PATH`로 설정하며 기본값은 `/`다. 기존 개발·E2E 주소 `http://127.0.0.1:4173`은 그대로다. Pages 빌드는 `/granite/`를 사용하고 Vite가 CSS 폰트 및 Mermaid 동적 import를 포함한 번들 자산 경로를 변환한다. 로컬 노트의 `assets/...` Markdown 링크는 이 배포 경로와 별개인 저장소 첨부 경로다.

Node.js 24와 `package.json`의 Yarn 4.18.1을 사용한다.

```sh
corepack enable
yarn install --immutable
VITE_BASE_PATH=/granite/ yarn build
VITE_BASE_PATH=/granite/ yarn vite preview --host 127.0.0.1 --port 4191 --strictPort
```

브라우저에서 `http://127.0.0.1:4191/granite/`를 연다. 다른 서버가 사용 중이면 별도의 빈 포트를 선택한다. 데모를 열어 수식과 Mermaid를 표시하고 Network에서 JavaScript/CSS/폰트 요청이 `/granite/assets/` 아래에서 성공하는지 확인한다. 넓은 창과 760px 창에서 본문 표시를 확인한다.

## 보안 검사

`.github/workflows/zizmor.yml`은 PR, `main` push, 수동 실행에서 모든 `.github/workflows`를 zizmor의 `pedantic` persona로 검사한다. zizmor-action v0.8.0과 zizmor v1.31.1을 고정한다. 온라인 검사는 읽기 전용 GitHub token으로 action 메타데이터도 확인한다. `advanced-security: false`로 native 출력과 실패 종료 코드를 사용하며, SARIF 업로드나 `security-events: write`는 요구하지 않는다. 경고 무시 설정이나 `continue-on-error`는 없다.

모든 직접 action 참조는 전체 commit SHA로 고정한다. GitHub API로 공식 릴리스의 commit을 확인한 버전은 configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1, zizmor-action v0.8.0이다. 기존 checkout v6.1.0과 setup-node v6.5.0 pin을 재사용한다. 업데이트 때 버전 주석과 SHA를 함께 갱신하고 검사를 다시 실행한다.

```sh
actionlint
zizmor --offline --persona pedantic .github/workflows
# GitHub CLI로 인증된 로컬 환경에서 온라인 검사를 재현한다.
GH_TOKEN="$(gh auth token)" zizmor --persona pedantic .github/workflows
```

## 실제 검증과 한계

- Node.js 24.18.0 / Yarn 4.18.1에서 `/granite/` 프로덕션 빌드 성공. 기존 500kB 초과 청크 안내는 남는다.
- actionlint 1.7.12 성공. zizmor 1.31.1 pedantic의 오프라인 검사와 인증된 온라인 검사 모두 findings 없음, 모두 종료 코드 0.
- 실제 Chromium으로 로컬 production preview의 `/granite/`에 접근. 새 데모 노트에 입력한 수식 2개와 Mermaid SVG 표시, 자산 요청 35개 중 폰트 2개 확인. 실패 응답·경로 이탈·외부 요청·페이지 오류 없음. 1440×900 및 760×900 화면을 열어 확인했고 좁은 화면 가로 넘침 없음.
- 이 로컬 결과는 GitHub runner 실행, artifact 업로드, 공개 사이트 게시 성공을 증명하지 않는다. 실제 폴더 선택·권한 UI나 OS 클립보드 검증 범위를 늘리지 않는다.

공식 참고: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite public base path](https://vite.dev/guide/build.html#public-base-path), [zizmor-action](https://github.com/zizmorcore/zizmor-action), [zizmor integration](https://docs.zizmor.sh/integrations/).
