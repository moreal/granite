# GitHub 호스팅 CI 검증 기록

2026-10-24. S11의 실제 GitHub 실행·실패 전파·보고서 업로드와 다운로드를 확인했다. 최초 실행은 실패했고, 아래 수정 후 두 번째 실행은 모두 통과했다. 두 실행의 증거를 별도로 보존한다.

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

이번 실행으로 Linux 설치, 실제 PR 트리거, 검사 실패의 체크 실패 전파, 실패 후 보고서 업로드, 실제 다운로드 및 만료 메타데이터까지 확인했다. 아래 두 번째 실행에서 성공 후 업로드·다운로드도 별도로 확인했다. Branch protection의 필수 체크 설정은 변경하지 않았다.

브라우저 테스트는 데모 저장소와 디스크 handle 대역을 사용한다. 실제 사용자 폴더 선택창, 권한 승인·거부·철회·재연결, macOS 네이티브 한글 IME, 운영체제 클립보드와 실제 사이트 CORS는 이 CI로 검증하지 않았다. [기존 검증 범위](verification.md)와 [수용 검증표](acceptance-matrix.md)의 한계를 유지한다.


## 수정 후 두 번째 실행: 성공

[Tests #40059553384, attempt 1](https://github.com/moreal/granite/actions/runs/40059553384)은 `pull_request` 이벤트로 실행되어 전체 `success`로 완료됐다. PR head는 `30258710e70cdc2f63c0004b9199297dcc257ba0`, 두 작업의 실제 checkout merge commit은 `1823784bf25be0bd34c5fc73aa41be2ea5e9b0bc`다. 최초 실패의 플랫폼별 redo 키와 자동완성 키 처리 문제를 수정하고 인접 키 입력 회귀를 추가한 실행이다.

- [단위·타입·빌드](https://github.com/moreal/granite/actions/runs/40059553384/job/120769885487): 성공, 24초. 단위 44개 통과, 타입 검사·빌드 성공.
- [Chromium 브라우저·디스크](https://github.com/moreal/granite/actions/runs/40059553384/job/120769885343): 성공, 작업 전체 1분 16초. 테스트 **42개 통과, 41.2초**, 실패·flaky·skip 0개. 설치와 업로드 단계도 성공했다.
- 새 폴더 `/private/tmp/granite-hosted-fix.wXBzCz/`에 메타데이터·전체 로그·artifact를 내려받았다. 다운로드 종료 코드 0.

| 성공 artifact 항목 | 실제 값 |
| --- | --- |
| 이름 | `playwright-chromium-40059553384-1` |
| ID | `12546397837` |
| 압축 크기 | 68,311,777 bytes |
| 생성 UTC | `2026-10-24T03:46:04Z` |
| 만료 UTC | `2026-11-07T03:46:01Z` |
| 조회 당시 expired | `false` |
| API digest | `sha256:cb381ed2ba2f3b4c24369658de0abc0fc7ed6ed420c8f26877926e113fb61980` |

다운로드된 HTML 보고서는 665,716 bytes이며, 내장 보고서 ZIP CRC와 JSON 통계(total 42, expected 42, unexpected/flaky/skipped 0, ok true)를 확인했다. `test-results` trace 42개와 보고서 첨부 사본 42개, **총 84개 ZIP 모두 CRC 검사를 통과**했다. PNG 11개가 포함되어 있다. 성공·실패 양쪽에서 실제 보고서 업로드·다운로드와 약 14일의 만료 메타데이터를 확인했다. 앞서 명시한 HTML 화면 렌더링·원본 외부 ZIP digest 재계산·네이티브 권한/IME 미검증 한계는 그대로다.
