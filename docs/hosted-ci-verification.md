# GitHub 호스팅 CI 검증 기록

2026-10-24. S11의 실제 GitHub 실행·실패 전파·보고서 업로드와 다운로드를 확인했다. 이 기록의 최초 실행은 실패했으며, 로컬 성공 결과로 대체하지 않는다.

## 최초 PR 실행

- PR: [#1](https://github.com/moreal/granite/pull/1)
- 실행: [Tests #40059118282, attempt 1](https://github.com/moreal/granite/actions/runs/40059118282), `pull_request` 이벤트.
- PR head: `af770e0c76da5df5cfa6937a5117c63cbeea2e79`.
- 두 작업이 실제 checkout한 PR merge commit: `1eb12a0847495bb7e985acac6c9f6f82484bd683` (checkout 로그에서 확인).
- 환경: Ubuntu 24.04.5, Node.js 24.21.0, Yarn 4.18.1. 두 작업에서 `yarn install --immutable` 성공. Chromium 및 Linux 시스템 의존성 설치 성공.
- [Unit tests, types, and build](https://github.com/moreal/granite/actions/runs/40059118282/job/120768570554): 성공. 단위 테스트 4개 파일·44개 통과, 타입 검사·빌드 성공.
- [Chromium browser and disk tests](https://github.com/moreal/granite/actions/runs/40059118282/job/120768570349): 실패. 41개 중 39개 통과·2개 실패(약 1분), 종료 코드 1. 실행 전체도 `failure`로 표시했다. 실패 후 artifact 업로드 단계는 성공했다.

실패 항목은 S04의 한글 조합 후 redo 검증(`journeys.spec.ts:536`, 예상 `입력 한`, 실제 빈 편집기)과 S06/S07/S12의 기존 노트 자동완성 Enter 후 주변 UI 복원(`typing-chrome.spec.ts:205`, 예상 opacity 1, 실제 0.3)이다. 원인과 수정 결과는 후속 실행 증거와 구분한다.

## 실제 업로드·다운로드 증거

GitHub API 메타데이터와 `gh run download`로 확인했다. 다운로드 종료 코드 0이며, 기존 로컬 결과가 없는 새 임시 폴더에 받았다.

| 항목 | 실제 값 |
| --- | --- |
| Artifact 이름 | `playwright-chromium-40059118282-1` |
| Artifact ID | `12546438451` |
| 압축 크기 | 68,062,881 bytes |
| 생성 UTC | `2026-10-24T03:40:01Z` |
| 만료 UTC | `2026-11-07T03:39:58Z` |
| 조회 당시 expired | `false` |
| API digest | `sha256:1c34a7477bcee8b7b7f52debae3492703c1c2d9e1794926ce54596015c932342` |

14일 설정과 약 14일 뒤의 실제 만료 메타데이터가 일치한다(업로드 시작과 생성 시각 사이 3초 차이). 미래의 실제 삭제 시점까지 관찰한 것은 아니다. digest는 GitHub가 반환한 값이며, `gh run download`가 압축 해제한 뒤 원본 외부 ZIP의 SHA256을 별도로 다시 계산하지는 않았다.

증거 폴더: `/private/tmp/granite-hosted-ci.mIG6fL/`. `run.json`, `artifacts.json`, `run.log`, 보고서에서 추출한 `report.json`과 `download/playwright-chromium-40059118282-1/`을 보존했다. 임시 폴더의 영구 보존은 보장하지 않는다.

다운로드한 `playwright-report/index.html`은 671,752 bytes다. HTML 안에 포함된 보고서 ZIP을 추출해 CRC와 JSON을 검사했다. 보고서 통계는 total 41, expected 39, unexpected 2, flaky 0, skipped 0, ok false로 실제 작업 로그와 일치했다. `test-results`의 trace ZIP 41개와 HTML 보고서 첨부 사본 41개, 총 82개 ZIP 모두 CRC 무결성 검사를 통과했다. PNG 15개가 포함되며 두 실패의 스크린샷·오류 문맥·trace도 존재한다. 이 검사는 파일과 보고서 데이터의 확인이며 HTML 뷰어의 화면 렌더링을 확인했다는 의미는 아니다.

## 재현과 한계

```sh
gh run view 40059118282 --repo moreal/granite
gh run download 40059118282 --repo moreal/granite --dir <새-증거-폴더>
yarn playwright show-report <새-증거-폴더>/playwright-chromium-40059118282-1/playwright-report
yarn playwright show-trace <실패-테스트-폴더>/trace.zip
```

이번 실행으로 Linux 설치, 실제 PR 트리거, 검사 실패의 체크 실패 전파, 실패 후 보고서 업로드, 실제 다운로드 및 만료 메타데이터까지 확인했다. 성공 실행의 업로드 증거는 후속 성공 실행으로 확인해야 한다. Branch protection의 필수 체크 설정은 변경하지 않았다.

브라우저 테스트는 데모 저장소와 디스크 handle 대역을 사용한다. 실제 사용자 폴더 선택창, 권한 승인·거부·철회·재연결, macOS 네이티브 한글 IME, 운영체제 클립보드와 실제 사이트 CORS는 이 CI로 검증하지 않았다. [기존 검증 범위](verification.md)와 [수용 검증표](acceptance-matrix.md)의 한계를 유지한다.
