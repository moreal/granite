import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export function SettingsDialog({
  settings,
  onClose,
}: {
  settings: AppSettings;
  onClose: () => void;
}) {
  const [original] = useState(() => JSON.stringify(settings));
  const [draft, setDraft] = useState<AppSettings>(() =>
    structuredClone(settings),
  );
  const [section, setSection] = useState<"appearance" | "links">("appearance");
  const [error, setError] = useState("");
  const templateErrors = draft.linkTemplates.map((t) =>
    !t.name.trim() ? "이름을 입력해 주세요." : validateLinkTemplate(t.template),
  );
  const updateTemplate = (
    id: string,
    patch: Partial<AppSettings["linkTemplates"][number]>,
  ) =>
    setDraft({
      ...draft,
      linkTemplates: draft.linkTemplates.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    });
  return (
    <Dialog title="설정" onClose={onClose}>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (templateErrors.some(Boolean)) {
            setSection("links");
            setError("링크 양식의 입력 내용을 확인해 주세요.");
            return;
          }
          try {
            if (JSON.stringify(readSettings()) !== original) {
              setError(
                "다른 탭에서 설정이 바뀌었습니다. 취소한 뒤 설정을 다시 열어 주세요.",
              );
              return;
            }
            saveSettings(draft);
            onClose();
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      >
        <p className="settings-intro">
          이 브라우저에서 사용할 화면과 글쓰기 방식을 정합니다.
        </p>
        <nav className="settings-nav" aria-label="설정 분류">
          <button
            type="button"
            aria-pressed={section === "appearance"}
            onClick={() => setSection("appearance")}
          >
            화면
          </button>
          <button
            type="button"
            aria-pressed={section === "links"}
            onClick={() => setSection("links")}
          >
            링크 붙여넣기
          </button>
        </nav>
        {section === "appearance" ? (
          <section aria-label="화면 설정">
            <h3>테마</h3>
            <p>밝게, 어둡게 또는 기기의 화면 설정을 따릅니다.</p>
            <fieldset className="theme-options">
              <legend className="sr-only">테마</legend>
              {(
                [
                  ["light", "밝게"],
                  ["dark", "어둡게"],
                  ["system", "시스템"],
                ] as [ThemePreference, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={draft.theme === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={draft.theme === value}
                    onChange={() => setDraft({ ...draft, theme: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </section>
        ) : (
          <section aria-label="링크 붙여넣기 설정">
            <h3>나만의 링크 양식</h3>
            <p>
              URL을 붙여넣을 때 사용할 Markdown 양식을 추가합니다. 기본 붙여넣기
              방식은 계속 사용할 수 있습니다.
            </p>
            <p className="field-hint" id="template-help">
              사용 가능한 자리표시자:{" "}
              <code>{"{{url}}, {{title}}, {{selection}}, {{hostname}}"}</code>.
              미리보기는 예시 텍스트이며 웹페이지를 가져오지 않습니다.
            </p>
            {!draft.linkTemplates.length && (
              <p className="settings-empty">아직 추가한 양식이 없습니다.</p>
            )}
            {draft.linkTemplates.map((template, index) => (
              <fieldset className="template-card" key={template.id}>
                <legend>양식 {index + 1}</legend>
                <label htmlFor={`name-${template.id}`}>이름</label>
                <input
                  id={`name-${template.id}`}
                  value={template.name}
                  maxLength={80}
                  onChange={(e) =>
                    updateTemplate(template.id, { name: e.target.value })
                  }
                />
                <label htmlFor={`template-${template.id}`}>Markdown 양식</label>
                <textarea
                  id={`template-${template.id}`}
                  rows={3}
                  value={template.template}
                  aria-describedby={`template-help template-error-${template.id}`}
                  aria-invalid={!!templateErrors[index]}
                  onChange={(e) =>
                    updateTemplate(template.id, { template: e.target.value })
                  }
                />
                {templateErrors[index] && (
                  <p className="error" id={`template-error-${template.id}`}>
                    {templateErrors[index]}
                  </p>
                )}
                <span className="preview-label">미리보기</span>
                <pre className="template-preview">
                  {validateLinkTemplate(template.template)
                    ? "양식을 완성하면 미리보기가 표시됩니다."
                    : renderLinkTemplate(template.template, {
                        url: "https://example.com/article",
                        title: "읽고 싶은 글",
                        selection: "선택한 글",
                        hostname: "example.com",
                      })}
                </pre>
                <button
                  className="template-remove"
                  type="button"
                  aria-label={`양식 ${index + 1} 삭제`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      linkTemplates: draft.linkTemplates.filter(
                        (t) => t.id !== template.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="template-add"
              onClick={() =>
                setDraft({
                  ...draft,
                  linkTemplates: [
                    ...draft.linkTemplates,
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
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary" type="submit">
            적용
          </button>
        </div>
      </form>
    </Dialog>
  );
}
