# Yarn 설치·검증 전환

2026-10-24. S11의 개발 도구 요구 변경이다. 패키지 관리자는 `packageManager: "yarn@4.18.1"`로 고정하고 `.yarnrc.yml`은 `nodeLinker: pnpm`을 사용한다. `yarn.lock`이 설치 기준이며 `package-lock.json`은 제거했다. pnpm CLI를 설치하거나 실행하지 않는다.

공식 [Yarn release tags](https://repo.yarnpkg.com/tags)의 stable 4.18.1과 [nodeLinker 설정](https://yarnpkg.com/configuration/yarnrc#nodeLinker)을 확인했다. pnpm linker는 `node_modules/.store`와 패키지 심볼릭 링크를 생성한다. `.yarn/`, `.pnp.*`, `node_modules/`는 설치 산출물로 Git에서 제외한다.

## 현재 재현 방법

Node.js 24와 Corepack이 있으면 다음을 사용한다. Corepack은 `package.json`의 정확한 Yarn 버전을 선택한다.

```sh
corepack enable
yarn --version
yarn install --immutable
yarn test
yarn typecheck
yarn build
yarn playwright install chromium
yarn test:e2e
yarn test:report
```

Corepack이 없는 환경에서는 npm bootstrap 없이 공식 단일 파일 release를 내려받을 수 있다. 다음 예시는 프로젝트에 저장된 버전을 읽고 사용자 지정 경로에 실행 파일을 만든다. 이 경로를 PATH 앞에 추가한다.

```sh
yarn_version=$(node -p "require('./package.json').packageManager.split('@')[1]")
mkdir -p "$PWD/.yarn/bootstrap"
curl --fail --silent --show-error --location "https://repo.yarnpkg.com/$yarn_version/packages/yarnpkg-cli/bin/yarn.js" --output "$PWD/.yarn/bootstrap/yarn.js"
printf '#!/bin/sh\nexec node "%s/.yarn/bootstrap/yarn.js" "$@"\n' "$PWD" > "$PWD/.yarn/bootstrap/yarn"
chmod +x "$PWD/.yarn/bootstrap/yarn"
export PATH="$PWD/.yarn/bootstrap:$PATH"
yarn --version
yarn install --immutable
```

## 의존성과 CI

제품 의존성 범위는 바꾸지 않았다. 기존 npm lock의 151개 패키지·버전 항목이 모두 Yarn lock에도 존재하는지 비교했으며 누락이나 업그레이드는 없었다. npm이 자동 설치하던 `@testing-library/react`의 peer `@testing-library/dom`은 Yarn에서 명시적으로 제공해야 하므로 기존 잠금 버전 10.4.2의 범위 `^10.4.2`를 개발 의존성에 추가했다. 그 하위 패키지도 기존 버전을 유지한다. Yarn lock에는 여러 플랫폼의 선택적 바이너리 해상도도 포함된다.

CI는 각 작업에서 먼저 Node.js 24를 설정하고 `corepack enable`, `yarn --version`으로 Yarn을 준비한다. 이후 두 번째 setup-node가 `cache: yarn`과 `yarn.lock`을 사용한다. 따라서 캐시 경로 조회 전에 Yarn이 준비된다. 로컬에서도 Node.js 24의 `corepack enable --install-directory /private/tmp/granite-ci-corepack-bin` 후 해당 shim의 `yarn --version`(4.18.1)과 `yarn config get cacheFolder`가 성공했다. 두 독립 작업, 시간 제한, 실패 전파, 항상 실행하는 보고서 업로드와 14일 보관 정책은 유지했다. 설치는 `yarn install --immutable`, Playwright 서버와 브라우저 설치도 Yarn 명령을 사용한다.

## 실제 검증과 한계

macOS arm64, Node.js 24.18.0, Yarn 4.18.1. Corepack 0.36.0으로 Yarn을 내려받았다. sandbox 바깥 캐시 쓰기를 피하려고 `COREPACK_HOME=/private/tmp/granite-corepack`, `YARN_GLOBAL_FOLDER=/private/tmp/granite-yarn-global`을 사용했다. 네트워크 다운로드는 승인된 실행으로 수행했다. npm 명령은 실행하지 않았다.

기존 4173과 5173 서버를 유지하고 `/private/tmp/granite-yarn-ypqst9ue`에 설치 산출물 없는 사본을 만들었다. 사본의 Playwright 설정과 동일 출처 assertion의 4173만 4174로 맞췄다. 검증 PATH는 Node.js 24.18.0과 고정 Yarn 실행 파일을 먼저 선택했다. 원본 테스트 동작은 수정하지 않았다.

| 실행                                                      | 결과                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CI=true yarn install --immutable` (빈 node_modules 사본) | 성공, 잠금 파일 변경 없음                                                     |
| `node --version`, `yarn --version`                        | v24.18.0, 4.18.1                                                              |
| `yarn config get nodeLinker`                              | pnpm                                                                          |
| 설치 레이아웃 확인                                        | `.store` 디렉터리·react 심볼릭 링크 존재, `.pnp.cjs`와 `.pnp.loader.mjs` 없음 |
| `CI=true yarn test`                                       | 4개 파일, 44개 통과                                                           |
| `yarn typecheck`                                          | 종료 0                                                                        |
| `yarn build`                                              | 종료 0, 기존 약 795kB 청크 크기 안내 유지                                     |
| `CI=true yarn test:e2e`                                   | 41개 통과, 33.1초, 종료 0                                                     |
| `actionlint .github/workflows/tests.yml`                  | 종료 0                                                                        |

첫 E2E 실행은 sandbox의 4174 bind 제한으로 서버를 시작하지 못했다. 승인된 실행으로 전체를 다시 실행했다. 이는 제품 테스트 실패가 아니다. GitHub 원격 실행은 저장소가 아직 push되지 않아 미검증이다. 로컬 검증은 Ubuntu 의존성 설치나 GitHub 캐시 복원·artifact 업로드를 증명하지 않는다. 브라우저 폴더 선택·네이티브 권한 UI 검증 범위도 늘리지 않는다.

이 문서가 현재 설치·CI 재현 안내를 대체한다. 이전 `ci-verification.md`, 구현 보고서와 `verification.md`의 npm 실행 결과는 당시 실제 기록으로 보존한다.
