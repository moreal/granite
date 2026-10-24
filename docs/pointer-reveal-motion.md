# 포인터 복원 모션 검증

2026-10-24. 주변 UI가 마우스 이동에서 갑자기 밝아지는 동작을 빠른 전환으로 바꾸는 **방향 변경**이다. [글쓰기 집중 스펙](superpowers/specs/2026-10-24-writing-focus.md)의 S04/S12 추가 기준을 함께 수정했다.

포인터 이동·누름·터치는 opacity 0.3에서 1까지 120ms ease-out으로 복원한다. 입력 중 약화는 기존 250ms ease-out이다. 반복 포인터 이동은 진행 중 전환을 재시작하지 않으며, 재입력은 현재 밝기에서 다시 약화한다. 키보드 접근·앱 명령과 reduced-motion은 즉시 복원한다. 저장·오류·복구 UI의 밝기와 클릭 가능 시점은 바꾸지 않았다.

## 검증 결과

Node.js 24.18.0, Yarn 4.18.1. 기존 4173/5173 서버를 그대로 두고 `/private/tmp/granite-pointer-ar28ns95` 사본에서 CI=true로 4174 서버를 실행했다. 사본의 Playwright 포트와 같은 출처 assertion만 임시 조정했다. 최초 sandbox 실행은 포트 bind 제한으로 시작하지 못했으며, 승인된 실행에서 아래 검사가 통과했다.

| 검사 | 결과 |
| --- | --- |
| `yarn test` | 단위 44개 통과 |
| `yarn typecheck` | 종료 0 |
| `yarn build` | 종료 0, 기존 약 796kB 청크 크기 안내 유지 |
| 입력 집중 파일의 집중 E2E | 11개 통과, 11.4초 |
| `CI=true yarn test:e2e` | 전체 브라우저·디스크 44개 통과, 35.8초 |

[입력 집중 테스트](../tests/e2e/typing-chrome.spec.ts)의 새 S04/S12 검사는 실제 마우스 이동으로 생성된 브라우저 CSS transition을 일시 정지하고 60ms 시점의 렌더링 opacity가 0.3과 1 사이인지 확인한다. 실제 animation effect의 길이 120ms, 반복 이동 뒤 동일 중간 밝기, 재입력 시 중간 밝기 보존과 0.3 도달, 최종 복원 1을 검사한다. reduced-motion에서는 밝기 1과 실행 중 animation 0개를 확인한다. Tab 복원도 밝기 1과 animation 0개를 확인했다. 저장 상태 유효 opacity는 전환 중에도 1이었다.

기존 S04/S06/S07/S08/S10/S12 조합 입력·자동완성 마우스/Enter·즉시 Enter·메뉴·저장 오류·복구·집중 모드 회귀가 모두 통과했다. 실제 OS 한글 IME, 폴더 선택창·권한 UI는 이번에 검증하지 않았다. 조합 입력 자동화와 데모/디스크 어댑터 결과를 네이티브 검증으로 간주하지 않는다.

## 렌더링 확인

아래 새 파일들을 실제로 열어 확인했다. 기존 추적 화면 증거는 덮어쓰지 않았다. 1440×900 중간 프레임에서 제목·본문과 저장 상태는 선명하고 주변 UI만 복원 중이다. 760×900 일반/모션 감소 화면에서 상단·탐색·본문·작업·연결 영역이 보이고 가로 넘침이 없다. 중간 프레임은 topbar의 전환을 결정적으로 정지한 자동화 증거이며 자연 재생 영상은 아니다.

- [일반 모션 중간 프레임](screenshots/pointer-reveal-midpoint.png)
- [좁은 화면 복원](screenshots/pointer-reveal-narrow.png)
- [모션 감소 좁은 화면](screenshots/pointer-reveal-reduced.png)
