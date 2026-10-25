# 편집기 플러그인

`src/editor/plugins/types.ts`의 `EditorPlugin`은 앱에 포함한 신뢰된 TypeScript 코드다. 저장소를 받지 않지만 보안 샌드박스는 아니다. Markdown이나 폴더 설정에서 플러그인 코드를 실행하지 않는다.

`Editor`의 `plugins`는 기본 목록을 대체한다. 기본 동작과 함께 추가하려면 다음처럼 등록한다. ID는 플러그인·completion·formatter 전체에서 고유해야 한다.

```tsx
const plugins = [...builtinPlugins, {
  id: "example.typography",
  formatters: [{
    id: "example.trim-end",
    label: "끝 공백 정리",
    async format(text, { signal }) {
      signal.throwIfAborted();
      return text.trimEnd() + "\n";
    },
  }],
}];
<Editor plugins={plugins} ref={editor} {...editorProps} />;
editor.current?.requestFormatting("example.trim-end");
```

`liveExtensions(services)`는 CodeMirror 확장을, `completions`는 `@`/`[[` 입력 후보를 제공한다. 호스트는 현재 노트 키·리비전·잠금·조합 입력·취소를 소유하고, 결과를 원문/결과 텍스트 미리보기로 제시한다. 적용은 하나의 undo 단위이며 기존 onChange/자동 저장 경로를 따른다. 결과 대기나 미리보기 중 문서 변경, 노트 전환, 잠금, compositionstart, 새 요청은 기존 요청을 취소한다. 포매터는 AbortSignal에 응답해야 한다.

기본 `granite.hongdown`은 `@hongdown/wasm` 0.5.3을 로컬 module worker에서 실행한다. 본문 업로드, 폴더 TOML, 외부 formatter 실행은 없다. 전체 입력은 UTF-8 1 MiB 이하이고 worker 제한 시간은 10초다. 취소/오류/시간 초과 시 worker를 종료하며 원문은 유지한다. 줄 폭 재배치·Setext 전환·스마트 문장부호를 끄고 backtick 3개와 math를 사용한다. 인용문·목록·빈 줄 및 외부 링크(reference 문법) 모양은 바뀔 수 있다.

유효 frontmatter 접두부는 원래 바이트 그대로 분리·복원한다. 오류나 닫히지 않은 속성은 정리를 거절한다. 위키 대상의 중복 개수, 이미지 원문, 수식/지원 Mermaid 내용이 달라지면 거절한다. 이는 모든 Markdown 문법의 의미 동등성 증명이 아니다. 지원하지 않는 내용도 텍스트로 편집할 수 있으며 미리보기에서 직접 확인해야 한다. 출력은 HTML로 실행하지 않는다. HTTP(S) reference 링크는 full/collapsed/shortcut과 대소문자 무시 정의를 지원한다. 미해결 위키는 외부 링크로 바꾸지 않는다.

설정의 **라이선스와 소스** 링크에서 AGPL 고지와 배포 소스를 제공한다. 배포 패키징 책임은 `scripts/`와 Pages workflow에 있다.
