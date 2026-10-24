> 현재 CI 설치·캐시 구성은 [Yarn 전환 기록](yarn-migration.md)이 대체한다. 아래 npm 명령과 결과는 전환 전 실행 증거다.

# PR CI 검증 기록

2026-10-24. S11(재현 가능한 검증·리뷰)을 위한 운영 자동화 추가다. 제품 동작과 S01–S12의 기존 안전 계약은 바꾸지 않는다.

## 실행 계약

[Tests](../.github/workflows/tests.yml)는 경로·대상 브랜치 필터 없는 `pull_request`와 수동 `workflow_dispatch`를 사용한다. 일반 PR 열기·갱신·다시 열기에 실행되며, `pull_request_target`이나 저장된 checkout 인증정보를 사용하지 않는다. 권한은 `contents: read`로 제한한다. 같은 PR 또는 수동 실행 ref의 이전 실행은 취소한다.

두 Ubuntu 작업은 서로 의존하지 않는다. `validation`은 단위 검사·타입 검사·빌드를, `browser`는 Chromium 브라우저·디스크 검사를 실행한다. 각각 15분·20분 제한이며 모든 명령은 실패 종료 코드를 그대로 전달한다. Node.js 24, lockfile 기반 npm 캐시, `npm ci`를 사용한다. 브라우저 작업은 설치된 Playwright 버전에 맞는 Chromium과 Linux 의존성을 `npx playwright install --with-deps chromium`으로 설치한다.

`CI: true`는 기존 Playwright 설정의 `forbidOnly`를 켜고 `reuseExistingServer`를 끈다. CI 서버는 4173 포트를 직접 소유한다. 기존 `trace: "on"`, HTML reporter, 실패 스크린샷 설정을 유지한다.

아티팩트 단계는 `always()`로 성공·실패 후 모두 실행한다. `playwright-report/`와 `test-results/`를 `playwright-chromium-<run_id>-<run_attempt>` 이름으로 14일 보관한다. 설치·서버 시작 실패 등으로 증거가 생성되지 않았으면 경고만 남겨 원래 실패 원인을 가리지 않는다. 강제 종료·러너 장애·취소 시 업로드 완료까지 보장하지는 않는다.

## 공식 의존성 확인

공식 저장소의 태그를 `git ls-remote`로 조회하고, 해당 커밋의 `action.yml`에서 세 액션 모두 `node24` 런타임임을 확인했다. Node 24 액션은 runner 2.327.1 이상이 필요하며 GitHub 관리형 `ubuntu-latest`를 사용한다.

| 액션            | 확인한 태그 | 고정 커밋                                  |
| --------------- | ----------- | ------------------------------------------ |
| checkout        | v6.1.0      | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| setup-node      | v6.5.0      | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| upload-artifact | v7.0.2      | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

참고: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-artifact](https://github.com/actions/upload-artifact), [Playwright CI](https://playwright.dev/docs/ci-intro). 태그 업데이트 시 커밋·런타임 요구사항을 다시 확인한다.

## 로컬 실행 증거

macOS arm64, Node.js 24.18.0, npm 11.16.0, Playwright 1.64.1, Chromium 156.0.8078.4, actionlint 1.7.12에서 실행했다. 기존 4173 개발 서버를 중단하지 않기 위해 `/private/tmp/granite-ci.H3Vk0n`에 `.git`, `node_modules`, 빌드·테스트 결과를 제외한 별도 사본을 만들었다. 사본의 Playwright 설정 내 포트와 `journeys.spec.ts`의 동일 출처 확인 주소만 4174로 맞췄다. `CI=true`, 서버 재사용 금지, 모든 검사와 원본 저장소 설정은 유지했다.

첫 사본 실행에서는 설정만 4174로 바꿔 동일 출처 검사의 4173 리터럴과 불일치했다(40 통과·1 실패, 종료 코드 1). 사본의 해당 주소도 4174로 맞춘 뒤 전체를 재실행했다. 제품 결함이나 운영 테스트 수정은 없었다.

```sh
# 아래 명령은 임시 사본에서 실행; mise는 로컬 Node 버전 선택 도구다.
mise exec node@24.18.0 -- npm ci
CI=true mise exec node@24.18.0 -- npm test
CI=true mise exec node@24.18.0 -- npm run typecheck
CI=true mise exec node@24.18.0 -- npm run build
mise exec node@24.18.0 -- npx playwright install --with-deps chromium
CI=true mise exec node@24.18.0 -- npm run test:e2e
# 원본 저장소에서 실행
actionlint .github/workflows/tests.yml
```

단위 4개 파일·44개 테스트 통과. 타입·빌드·Chromium 설치 종료 코드 0. 기존 약 795 kB JavaScript 청크 크기 안내는 오류가 아니다. macOS에서의 `--with-deps` 성공은 Ubuntu 시스템 패키지 설치 성공 증거가 아니다.

전체 브라우저·디스크 검사 **41개 통과, 44.5초, 종료 코드 0**. actionlint와 `git diff --check` 통과. 성공 보고서 `evidence/success/playwright-report/index.html`(581,084 bytes)과 `evidence/success/test-results/`의 trace ZIP 41개를 임시 사본에 보존했고 모든 ZIP의 CRC 무결성을 확인했다.

실패 경로는 사본에만 `ci-artifact-failure.spec.ts`를 만들어 페이지 방문 뒤 의도적으로 다른 두 문자열을 비교했다. 다음 실행은 **1개 실패·종료 코드 1**을 반환했고, `playwright-report/index.html`(519,404 bytes), 실패 스크린샷 및 `test-results/ci-artifact-failure-CI-intentional-failure-evidence/trace.zip`이 생성되었다. ZIP CRC 검사도 통과했다. 실패 probe 파일은 실행 후 삭제했다. 이는 Playwright의 실패 전달과 파일 생성을 검증하며 GitHub 업로드 자체를 실행한 증거는 아니다.

```sh
CI=true mise exec node@24.18.0 -- npm run test:e2e -- tests/e2e/ci-artifact-failure.spec.ts
```

위 증거의 전체 경로는 `/private/tmp/granite-ci.H3Vk0n/` 아래이며 임시 파일이므로 영구 보관을 보장하지 않는다. 원본 저장소의 테스트 결과나 사용자 개발 서버는 대체하지 않았다.

## 보고서 열기와 한계

GitHub 실행 요약의 **Artifacts**에서 압축 파일을 내려받고 푼 뒤 설치된 프로젝트에서 실행한다.

```sh
npx playwright show-report <압축을-푼-폴더>/playwright-report
npx playwright show-trace <압축을-푼-폴더>/test-results/<테스트>/trace.zip
```

이 기록은 로컬 명령·실패 전파·보고서 생성과 workflow 정적 검증의 증거다. GitHub 호스팅 실행, Linux 의존성 설치, 실제 artifact 업로드·다운로드·보존 정책 적용은 원격 실행 전에는 미검증이다. fork PR의 최초 실행은 저장소의 GitHub 승인 정책에 따라 승인이 필요할 수 있다. Branch protection의 필수 체크 설정은 변경하지 않았다.

브라우저 테스트는 데모 저장소 및 디스크 handle 대역을 사용한다. 실제 폴더 선택창, 권한 승인·거부·철회와 네이티브 IME는 이번 CI 추가로 검증된 것이 아니다. [기존 검증 범위](verification.md)와 [S01–S12 수용 검증표](acceptance-matrix.md)를 유지한다.
