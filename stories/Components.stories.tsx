import { Button } from "../src/design-system/Button";
import { expect, userEvent, within } from "storybook/test";
import { createSignal } from "solid-js";
import { TodayShortcut } from "../src/components/TodayShortcut";
import { SaveStatus } from "../src/components/SaveStatus";
import { RecoveryPanel } from "../src/components/RecoveryPanel";
import { GraphItem } from "../src/components/GraphItem";
import { EditorToolbar } from "../src/components/EditorToolbar";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { LinkTemplateRow } from "../src/components/LinkTemplateRow";
import { TypePicker } from "../src/components/properties/TypePicker";
import { PropertyPicker } from "../src/components/properties/PropertyPicker";
import { PropertyCreateForm } from "../src/components/properties/PropertyCreateForm";
import { NoteProperties } from "../src/components/NoteProperties";
import { PropertyValueInput } from "../src/components/properties/PropertyValueInput";
import { PropertyRow } from "../src/components/properties/PropertyRow";
import { YamlEditor } from "../src/components/properties/YamlEditor";
import { UrlPasteMenu } from "../src/editor/UrlPasteMenu";
import { FormatReviewDialog } from "../src/editor/FormatReviewDialog";
import { noteReference } from "../src/schema/references";
import { defaultSettings } from "../src/settings";

export default { title: "Production/Components" };
const noop = () => {};
const long =
  "아주 긴 한글 제목과 속성 값으로 좁은 화면의 줄바꿈을 확인합니다 ".repeat(3);
function Fixture(props: { kind: string; disabled?: boolean }) {
  const [value, setValue] = createSignal(props.kind === "type" ? "Book" : "");
  const [result, setResult] = createSignal("");
  const [source, setSource] = createSignal(false);
  const [openedNote, setOpenedNote] = createSignal("");
  const [noteBody, setNoteBody] = createSignal(
    props.kind === "mode-invalid"
      ? "---\ntype: [\n---\n본문과 원문 보존"
      : props.kind === "mode-links"
        ? "---\ntype: Book\nauthor: '소개 [[작가]]와 [[대상 조직]]의 기록'\nabout:\n  - '[[대상 책]] 관련 글'\n  - 3\n  - false\ncount: 2\n---\n본문"
        : "---\ntype: Book\nauthor: '[[작가]]' # 보존할 주석\ncount: 2\n---\n본문",
  );
  const [yaml, setYaml] = createSignal("type: Book\nauthor: '[[작가]]'\n");
  return (
    <section class="story-surface" data-testid="component">
      {props.kind.startsWith("value-") && (
        <PropertyValueInput
          label="author 값"
          value={value()}
          titles={
            props.kind === "value-long"
              ? [
                  long,
                  "아주긴한글어절이반복되어도너비밖으로나가지않고계속읽을수있어야하는제목",
                ]
              : [
                  "작가",
                  "작[가]",
                  ...Array.from(
                    { length: 18 },
                    (_, index) => `작가의 기록 ${index + 1}`,
                  ),
                  "다른 노트",
                ]
          }
          linkable={true}
          contextKey="synthetic-story"
          onChange={setValue}
          onCommit={() => setResult(value())}
          onCancel={() => setResult("취소")}
        />
      )}
      {props.kind.startsWith("mode-") && (
        <>
          {openedNote() && (
            <article aria-label="연결된 노트">
              <h2>{openedNote()}</h2>
              <p>속성 링크로 연 노트의 본문입니다.</p>
              <Button type="button" onClick={() => setOpenedNote("")}>
                속성 노트로 돌아가기
              </Button>
            </article>
          )}
          <div hidden={!!openedNote()}>
            <NoteProperties
              body={noteBody()}
              documentKey="mode-story"
              locked={!!props.disabled}
              mode={props.kind.startsWith("mode-yaml") ? "yaml" : "form"}
              onSource={() => setResult("전체 원문 수정 요청")}
              onOpen={(title) => {
                setOpenedNote(title);
                setResult(`${title} 노트 열기`);
              }}
              references={[
                noteReference("대상 책", "---\ntype: Book\n---\n"),
                noteReference("대상 조직", "---\ntype: Organization\n---\n"),
                noteReference("대상 작가", "---\ntype: Person\n---\n"),
                noteReference("대상 사용자", "body"),
              ]}
              onChange={setNoteBody}
            />
          </div>
        </>
      )}
      {props.kind === "inline-properties" && (
        <NoteProperties
          body={noteBody()}
          documentKey="story-note"
          locked={!!props.disabled}
          onChange={setNoteBody}
        />
      )}
      {props.kind === "today" && (
        <div class="sidebar-actions">
          <TodayShortcut disabled={!!props.disabled} onOpen={setResult} />
        </div>
      )}
      {props.kind === "type" && (
        <TypePicker
          value={value()}
          disabled={props.disabled}
          onChange={setValue}
          onSelect={(v) => {
            setValue(v);
            setResult(v);
          }}
        />
      )}
      {props.kind === "property" && (
        <PropertyPicker
          value={value()}
          types={["Book"]}
          existingKeys={["type", "name"]}
          disabled={props.disabled}
          onChange={setValue}
          onSelect={(v) => {
            setValue(v);
            setResult(v);
          }}
        />
      )}
      {props.kind === "create" && (
        <PropertyCreateForm disabled={props.disabled} onCreate={setResult} />
      )}
      {props.kind === "row" && (
        <dl>
          <PropertyRow name={long} value={long} />
        </dl>
      )}
      {props.kind === "yaml" && (
        <YamlEditor
          value={yaml()}
          disabled={props.disabled}
          onChange={setYaml}
        />
      )}
      {props.kind === "save" && (
        <>
          <SaveStatus status="saved" />
          <SaveStatus status="saving" />
          <SaveStatus status="dirty" />
          <SaveStatus status="error" />
          <SaveStatus status="conflict" />
        </>
      )}
      {props.kind === "recovery" && (
        <RecoveryPanel
          status="conflict"
          error={long}
          busy={false}
          onRetry={noop}
          onDownload={() => setResult("다운로드 선택")}
          onReload={() => setResult("다시 읽기 선택")}
        />
      )}
      {props.kind === "graph" && (
        <GraphItem
          node={{
            id: "synthetic",
            title: long,
            types: ["Book"],
            missing: true,
          }}
          incoming={false}
          property="author"
          locked={!!props.disabled}
          onOpen={setResult}
        />
      )}
      {props.kind === "toolbar" && (
        <EditorToolbar
          hasNote={!props.disabled}
          demo={false}
          source={source()}
          connections={false}
          focus={false}
          onSource={() => setSource(!source())}
          onConnections={noop}
        />
      )}
      {props.kind === "template" && (
        <LinkTemplateRow
          template={{ id: "synthetic", name: long, template: "[{{unknown}}]" }}
          index={0}
          error="지원하지 않는 자리표시자입니다."
          onChange={noop}
          onRemove={noop}
        />
      )}
      {props.kind.startsWith("paste") && (
        <UrlPasteMenu
          paste={{
            url: "https://example.com/synthetic",
            mode:
              props.kind === "paste-failed"
                ? "failed"
                : props.kind === "paste-loading"
                  ? "loading"
                  : "choices",
            active: 0,
          }}
          onMount={noop}
          onKey={() => false}
          onActive={noop}
          onChoose={(v) => setResult(String(v))}
          onClose={() => setResult("닫힘")}
        />
      )}
      {props.kind === "settings" && (
        <SettingsDialog
          settings={defaultSettings()}
          onClose={() => setResult("닫힘")}
        />
      )}
      {props.kind === "format" && (
        <FormatReviewDialog
          review={{
            label: "문서 정리",
            original: "#제목\n\n본문",
            output: "# 제목\n\n본문\n",
          }}
          onClose={() => setResult("취소")}
          onApply={() => setResult("적용")}
        />
      )}
      <output aria-label="상호작용 결과">{result()}</output>
    </section>
  );
}
const story = (kind: string, disabled = false) => ({
  render: () => <Fixture kind={kind} disabled={disabled} />,
});
export const Today = story("today");
export const TodayDisabled = story("today", true);
export const Type = {
  ...story("type"),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("상호작용 결과")).toHaveTextContent(
      /^Book$/,
    );
  },
};
export const TypeDisabled = story("type", true);
export const Property = story("property");
export const PropertyDisabled = story("property", true);
export const Create = story("create");
export const CreateDisabled = story("create", true);
export const RowLong = story("row");
export const Yaml = story("yaml");
export const YamlDisabled = story("yaml", true);
export const Save = story("save");
export const Recovery = story("recovery");
export const GraphLong = story("graph");
export const GraphDisabled = story("graph", true);
export const Toolbar = story("toolbar");
export const ToolbarDisabled = story("toolbar", true);
export const TemplateError = story("template");
export const Paste = story("paste");
export const PasteFailed = story("paste-failed");
export const PasteLoading = story("paste-loading");
export const Settings = story("settings");
export const Format = story("format");

export const InlineProperties = {
  ...story("inline-properties"),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("속성", { exact: true }));
    await userEvent.click(
      canvas.getByRole("button", { name: "author 값 편집" }),
    );
    await expect(
      canvas.getByRole("combobox", { name: "author 값" }),
    ).toHaveValue("[[작가]]");
  },
};

const propertyValueStory = (kind: string, query: string) => ({
  ...story(kind),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "author 값" });
    // userEvent's keyboard syntax escapes a literal [ as [[.
    await userEvent.type(input, query.replace(/\[/g, "[["));
    await expect(input).toHaveValue(query);
    if (kind === "value-empty")
      await expect(
        canvas.getByText(
          "일치하는 노트가 없습니다. 값을 직접 입력할 수 있습니다.",
        ),
      ).toHaveAttribute("role", "status");
    else await expect(canvas.getByRole("listbox")).toBeVisible();
  },
});
export const PropertyValueMenu = propertyValueStory("value-menu", "@작");
export const PropertyValueNoResults = propertyValueStory(
  "value-empty",
  "[[없는 노트",
);
export const PropertyValueLongKorean = propertyValueStory(
  "value-long",
  "[[아주",
);

const propertyModeStory = (kind: string) => ({
  ...story(kind),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("속성", { exact: true }));
    if (kind === "mode-type") {
      await userEvent.click(
        canvas.getByRole("button", { name: "작가 노트 열기" }),
      );
      await expect(
        canvas.getByRole("heading", { name: /^작가$/ }),
      ).toBeVisible();
      await userEvent.click(
        canvas.getByRole("button", { name: "속성 노트로 돌아가기" }),
      );
      const button = canvas.getByRole("button", {
        name: "type 값 편집",
      });
      await userEvent.click(button);
      const input = canvas.getByRole("combobox", {
        name: "type 값",
      });
      await userEvent.clear(input);
      await userEvent.type(input, "Per");
      await expect(canvas.getByRole("listbox")).toBeVisible();
      await userEvent.click(
        canvas.getByRole("button", { name: "작가 노트 열기" }),
      );
      await expect(input).toHaveValue("Per");
      await expect(input).toHaveFocus();
      await expect(canvas.queryByRole("article")).toBeNull();
      await expect(
        canvas.getByText("입력 중인 값을 적용하거나 취소해 주세요."),
      ).toBeVisible();
    } else if (kind.startsWith("mode-yaml")) {
      const input = canvas.getByRole("textbox", {
        name: "속성 YAML 원문",
      });
      await userEvent.clear(input);
      if (kind === "mode-yaml") {
        await userEvent.type(input, "author: @대상");
        await expect(canvas.getByRole("listbox")).toBeVisible();
      } else if (kind === "mode-yaml-empty") {
        await userEvent.type(input, 'author: "@없는노트"');
        (input as HTMLTextAreaElement).setSelectionRange(
          (input as HTMLTextAreaElement).value.length - 1,
          (input as HTMLTextAreaElement).value.length - 1,
        );
        await userEvent.keyboard("{Control>} {/Control}");
        await expect(
          canvas.getByText(/일치하는 기존 노트가 없습니다/),
        ).toBeVisible();
      } else {
        await userEvent.type(input, "type: [[");
        if (kind === "mode-yaml-validated") await userEvent.tab();
        await expect(canvas.queryByText("확인 필요") !== null).toBe(
          kind === "mode-yaml-validated",
        );
      }
    } else if (kind === "mode-value" || kind === "mode-new") {
      if (kind === "mode-new") {
        const picker = canvas.getByRole("combobox", { name: "속성 이름 검색" });
        await userEvent.type(picker, "about");
        await userEvent.keyboard("{Enter}");
      } else
        await userEvent.click(
          canvas.getByRole("button", { name: "author 값 편집" }),
        );
      const input = canvas.getByRole("combobox", {
        name: kind === "mode-new" ? "about 값" : "author 값",
      });
      await userEvent.clear(input);
      await userEvent.type(input, "@대상");
      await expect(canvas.getByRole("listbox")).toBeVisible();
    } else if (kind === "mode-preserved") {
      await userEvent.click(
        canvas.getByRole("button", { name: "count 값 편집" }),
      );
      const input = canvas.getByRole("textbox", { name: "count 값" });
      await userEvent.clear(input);
      await userEvent.type(input, "not a number");
      await userEvent.keyboard("{Enter}");
      await userEvent.click(
        canvas.getByRole("button", { name: "author 값 편집" }),
      );
      await expect(input).toHaveValue("not a number");
      await expect(canvas.getByRole("alert")).toHaveTextContent("숫자");
      await expect(
        canvas.getByText("입력 중인 값을 적용하거나 취소해 주세요."),
      ).toBeVisible();
    } else if (kind === "mode-invalid") {
      await expect(canvas.queryByRole("combobox")).toBeNull();
      await expect(
        canvas.getByRole("button", { name: "전체 원문에서 속성 수정" }),
      ).toBeVisible();
    } else if (kind === "mode-warning") {
      await userEvent.click(
        canvas.getByRole("button", { name: "author 값 편집" }),
      );
      const input = canvas.getByRole("combobox", {
        name: "author 값",
      });
      await userEvent.clear(input);
      await userEvent.type(input, "@대상");
      await userEvent.click(canvas.getByRole("option", { name: "대상 책" }));
      await userEvent.keyboard("{Enter}");
      await expect(
        canvas.getByText(/대상 책 \(Book\): author 권장/),
      ).toBeVisible();
    }
  },
});
export const PropertiesDisplay = propertyModeStory("mode-display");
export const PropertiesLinks = propertyModeStory("mode-links");
export const PropertiesType = propertyModeStory("mode-type");
export const PropertiesYaml = propertyModeStory("mode-yaml");
export const PropertiesWarning = propertyModeStory("mode-warning");

export const PropertiesValue = propertyModeStory("mode-value");
export const PropertiesNew = propertyModeStory("mode-new");

export const PropertiesYamlQuiet = propertyModeStory("mode-yaml-quiet");
export const PropertiesYamlValidated = propertyModeStory("mode-yaml-validated");
export const PropertiesYamlNoResults = propertyModeStory("mode-yaml-empty");
export const PropertiesDraftPreserved = propertyModeStory("mode-preserved");
export const PropertiesInvalidForm = propertyModeStory("mode-invalid");
