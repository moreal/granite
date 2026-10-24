# Chromatic 시각적 회귀 검사

프로젝트: `Project:6adcb003518f31ed207ae4d4`. 기존 Playwright와 연결하며 앱용 Storybook 화면을 별도로 만들지 않는다. 패키지의 archive builder가 Yarn pnpm linker에서 정상 해석되도록 일치하는 Storybook 런타임을 명시적 개발 의존성으로 둔다.

`Visual review` 워크플로는 main push/수동 실행에서 합성 데모만 캡처한다. 사용자 폴더를 열거나 개인 노트를 업로드하지 않는다. 5개 여정·7개 캡처로 시작/데스크톱/좁은 화면/원문/이미지/수식·코드/Mermaid를 확인한다. 시각 변경을 자동 승인하지 않는다.

## 실행

```sh
VITE_BASE_PATH=/granite/ yarn build
yarn test:visual
# CHROMATIC_PROJECT_TOKEN을 안전한 환경 변수로 제공한 상태에서
yarn chromatic
```

GitHub 저장소 Actions secret `CHROMATIC_PROJECT_TOKEN`에 프로젝트 설정의 토큰이 필요하다. appId는 토큰이 아니다. 값은 저장소·문서·로그에 넣지 않는다. 토큰이 없으면 CI가 명확한 설정 오류를 표시하고 게시를 수행하지 않는다. 설정 후 workflow를 다시 실행하면 된다.

로컬 visual 실행과 archive 패키징은 통과했다. 실제 프로젝트 업로드·클라우드 baseline은 토큰 설정 후 실행에서 별도로 확인해야 한다. [공식 Playwright 안내](https://www.chromatic.com/docs/playwright/)를 따른다.
