import { LinkTemplateRow } from "./LinkTemplateRow";
import { createSignal, untrack, For } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Plus, Trash2 } from "../icons";
import { Dialog } from "./Dialog";
import {
  readSettings,
  saveSettings,
  type AppSettings,
  type ThemePreference,
} from "../settings";
import {
  validateLinkTemplate,
  renderLinkTemplate,
} from "../editor/link-templates";
export function SettingsDialog(props: {
  settings: AppSettings;
  onClose: () => void;
}) {
  const [original] = createSignal(
    untrack(() => JSON.stringify(props.settings)),
  );
  const [draft, setDraft] = createSignal<AppSettings>(
    untrack(() => structuredClone(props.settings)),
  );
  const [section, setSection] = createSignal<
    "appearance" | "writing" | "links"
  >("appearance");
  const [error, setError] = createSignal("");
  const templateErrors = () =>
    draft().linkTemplates.map((t) =>
      !t.name.trim()
        ? "이름을 입력해 주세요."
        : validateLinkTemplate(t.template),
    );
  const updateTemplate = (
    id: string,
    patch: Partial<AppSettings["linkTemplates"][number]>,
  ) =>
    setDraft({
      ...draft(),
      linkTemplates: draft().linkTemplates.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    });
  return (
    <Dialog title="설정" onClose={props.onClose}>
      <form
        class="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (templateErrors().some(Boolean)) {
            setSection("links");
            setError("링크 양식의 입력 내용을 확인해 주세요.");
            return;
          }
          try {
            if (JSON.stringify(readSettings()) !== original()) {
              setError(
                "다른 탭에서 설정이 바뀌었습니다. 취소한 뒤 설정을 다시 열어 주세요.",
              );
              return;
            }
            saveSettings(draft());
            props.onClose();
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      >
        <p class="settings-intro">
          이 브라우저에서 사용할 화면과 글쓰기 방식을 정합니다.
        </p>
        <nav class="settings-nav" aria-label="설정 분류">
          <button
            type="button"
            aria-pressed={section() === "appearance" ? "true" : "false"}
            onClick={() => setSection("appearance")}
          >
            화면
          </button>
          <button
            type="button"
            aria-pressed={section() === "writing" ? "true" : "false"}
            onClick={() => setSection("writing")}
          >
            글쓰기
          </button>
          <button
            type="button"
            aria-pressed={section() === "links" ? "true" : "false"}
            onClick={() => setSection("links")}
          >
            링크 붙여넣기
          </button>
        </nav>
        {section() === "appearance" ? (
          <section aria-label="화면 설정">
            <h3>테마</h3>
            <p>밝게, 어둡게 또는 기기의 화면 설정을 따릅니다.</p>
            <fieldset class="theme-options">
              <legend class="sr-only">테마</legend>
              {(
                [
                  ["light", "밝게"],
                  ["dark", "어둡게"],
                  ["system", "시스템"],
                ] as [ThemePreference, string][]
              ).map(([value, label]) => (
                <label class={draft().theme === value ? "selected" : ""}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={draft().theme === value}
                    onInput={() => setDraft({ ...draft(), theme: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </section>
        ) : section() === "writing" ? (
          <section aria-label="글쓰기 설정">
            <h3>자동 문서 정리</h3>
            <p>
              입력을 잠시 멈추면 Markdown 문서의 형식을 정리합니다. 정리한
              내용은 실행 취소할 수 있습니다.
            </p>
            <label class="auto-format-option">
              <input
                type="checkbox"
                checked={draft().autoFormat}
                onInput={(event) =>
                  setDraft({ ...draft(), autoFormat: event.target.checked })
                }
              />{" "}
              자동 문서 정리 사용
            </label>
          </section>
        ) : (
          <section aria-label="링크 붙여넣기 설정">
            <h3>나만의 링크 양식</h3>
            <p>
              URL을 붙여넣을 때 사용할 Markdown 양식을 추가합니다. 기본 붙여넣기
              방식은 계속 사용할 수 있습니다.
            </p>
            <p class="field-hint" id="template-help">
              사용 가능한 자리표시자:{" "}
              <code>{"{{url}}, {{title}}, {{selection}}, {{hostname}}"}</code>.
              미리보기는 예시 텍스트이며 웹페이지를 가져오지 않습니다.
            </p>
            {!draft().linkTemplates.length && (
              <p class="settings-empty">아직 추가한 양식이 없습니다.</p>
            )}
            <For each={draft().linkTemplates} keyed={(template) => template.id}>
              {(template, index) => (
                <LinkTemplateRow
                  template={template()}
                  index={index()}
                  error={templateErrors()[index()]}
                  onChange={(patch) => updateTemplate(template().id, patch)}
                  onRemove={() =>
                    setDraft({
                      ...draft(),
                      linkTemplates: draft().linkTemplates.filter(
                        (t) => t.id !== template().id,
                      ),
                    })
                  }
                />
              )}
            </For>
            <button
              type="button"
              class="template-add"
              onClick={() =>
                setDraft({
                  ...draft(),
                  linkTemplates: [
                    ...draft().linkTemplates,
                    {
                      id: crypto.randomUUID(),
                      name: "새 양식",
                      template: "[{{title}}]({{url}})",
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              양식 추가
            </button>
          </section>
        )}
        {error() && (
          <p class="error" role="alert">
            {error()}
          </p>
        )}
        <div class="dialog-actions">
          <button type="button" onClick={props.onClose}>
            취소
          </button>
          <button class="primary" type="submit">
            적용
          </button>
        </div>
        <footer>
          <a href={`${import.meta.env.BASE_URL}licenses/`}>라이선스와 소스</a>
        </footer>
      </form>
    </Dialog>
  );
}
