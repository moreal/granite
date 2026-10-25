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
import { PropertyRow } from "../src/components/properties/PropertyRow";
import { YamlEditor } from "../src/components/properties/YamlEditor";
import { UrlPasteMenu } from "../src/editor/UrlPasteMenu";
import { FormatReviewDialog } from "../src/editor/FormatReviewDialog";
import { defaultSettings } from "../src/settings";

export default { title: "Production/Components" };
const noop = () => {};
const long =
  "아주 긴 한글 제목과 속성 값으로 좁은 화면의 줄바꿈을 확인합니다 ".repeat(3);
function Fixture(props: { kind: string; disabled?: boolean }) {
  const [value, setValue] = createSignal(props.kind === "type" ? "Book" : "");
  const [result, setResult] = createSignal("");
  const [source, setSource] = createSignal(false);
  const [yaml, setYaml] = createSignal("type: Book\nauthor: '[[작가]]'\n");
  return (
    <section class="story-surface" data-testid="component">
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
          onFormat={noop}
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
