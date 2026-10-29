import { createSignal } from "solid-js";
import { expect, waitFor, within } from "storybook/test";
import { Editor } from "../src/editor/Editor";
import { NoteHeader } from "../src/components/NoteHeader";
import { Button } from "../src/design-system/Button";
import { decodeNote, filenameFor } from "../src/domain/notes";

export default {
  title: "Production/Writing Surface",
  parameters: { layout: "fullscreen" },
};
const initial =
  "# 생각을 이어 쓰는 시간\n\n문장의 속도에 맞춰 천천히 생각을 적습니다. 좁은 화면에서도 한국어 문장을 자연스럽게 이어 씁니다.\n\n## 연결하는 문장\n\n**중요한 생각**과 `작은 코드`는 원문 표시를 남겨 읽으며 고칩니다.\n\n> 인용의 표시도 편집할 수 있습니다.\n\n### 다음 문단\n\n" +
  "이어서 쓰는 문장입니다.\n\n".repeat(15);
function WritingFixture() {
  const [body, setBody] = createSignal(initial);
  const [source, setSource] = createSignal(false);
  const note = decodeNote(
    filenameFor("글쓰기 예제"),
    initial,
    new Date("2026-10-30T00:00:00Z").getTime(),
  );
  return (
    <div class="app-shell navigation-closed no-connections">
      <div class="work-area">
        <header class="topbar">
          <span>글쓰기 예제</span>
          <Button
            aria-pressed={source() ? "true" : "false"}
            onClick={() => setSource(!source())}
          >
            {source() ? "라이브 프리뷰" : "원문 보기"}
          </Button>
        </header>
        <NoteHeader
          entry={{
            note,
            body: body(),
            status: "dirty",
            error: null,
            recovered: false,
            recoverySources: [],
          }}
          locked={false}
          wordCount={body().split(/\s+/).length}
          source={source()}
          onBody={setBody}
        />
        <div class="writing-layout">
          <main class="note-pane">
            <Editor
              documentKey="writing-surface-story"
              value={body()}
              source={source()}
              locked={false}
              titles={[]}
              onChange={setBody}
              onSelection={() => {}}
              onOpen={() => {}}
              autoFormat={false}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
export const CmsWriting = {
  render: () => <WritingFixture />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () =>
      expect(
        canvas.getByRole("textbox", { name: "노트 본문" }),
      ).toHaveTextContent("생각을 이어 쓰는 시간"),
    );
    await document.fonts.ready;
    canvasElement.dataset.storyReady = "true";
  },
};
