import { Trash2 } from "../icons";
import type { LinkTemplate } from "../settings";
import {
  validateLinkTemplate,
  renderLinkTemplate,
} from "../editor/link-templates";
export function LinkTemplateRow(props: {
  template: LinkTemplate;
  index: number;
  error: string | null;
  onChange: (patch: Partial<LinkTemplate>) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset class="template-card">
      <legend>양식 {props.index + 1}</legend>
      <label for={`name-${props.template.id}`}>이름</label>
      <input
        id={`name-${props.template.id}`}
        value={props.template.name}
        maxlength={80}
        onInput={(e) => props.onChange({ name: e.target.value })}
      />
      <label for={`template-${props.template.id}`}>Markdown 양식</label>
      <textarea
        id={`template-${props.template.id}`}
        rows={3}
        value={props.template.template}
        aria-describedby={`template-help template-error-${props.template.id}`}
        aria-invalid={!!props.error ? "true" : "false"}
        onInput={(e) => props.onChange({ template: e.target.value })}
      />
      {props.error && (
        <p class="error" id={`template-error-${props.template.id}`}>
          {props.error}
        </p>
      )}
      <span class="preview-label">미리보기</span>
      <pre class="template-preview">
        {validateLinkTemplate(props.template.template)
          ? "양식을 완성하면 미리보기가 표시됩니다."
          : renderLinkTemplate(props.template.template, {
              url: "https://example.com/article",
              title: "읽고 싶은 글",
              selection: "선택한 글",
              hostname: "example.com",
            })}
      </pre>
      <button
        class="template-remove"
        type="button"
        aria-label={`양식 ${props.index + 1} 삭제`}
        onClick={props.onRemove}
      >
        <Trash2 size={15} />
        삭제
      </button>
    </fieldset>
  );
}
