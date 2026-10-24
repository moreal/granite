import { useMemo, useState } from "react";
import {
  propertyText,
  readFrontmatter,
  replaceFrontmatter,
  schemaTypes,
} from "../domain/frontmatter";

export function NoteProperties({
  body,
  onChange,
  locked,
}: {
  body: string;
  onChange: (body: string) => void;
  locked: boolean;
}) {
  const metadata = useMemo(() => readFrontmatter(body), [body]);
  const [type, setType] = useState<string>("Thing");
  return (
    <details className="note-properties">
      <summary>
        <span>속성</span>
        {metadata.present && (
          <span className="schema-type">{metadata.types.join(" · ")}</span>
        )}
      </summary>
      <div className="property-content">
        {metadata.warning && (
          <p className="property-warning" role="alert">
            {metadata.warning}
          </p>
        )}
        {metadata.present ? (
          <>
            {metadata.properties.size > 0 && (
              <dl className="property-list">
                {[...metadata.properties].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{propertyText(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <label className="property-source-label">
              속성 YAML 원문
              <textarea
                aria-label="속성 YAML 원문"
                spellCheck={false}
                value={metadata.yaml}
                disabled={locked}
                onChange={(event) =>
                  onChange(replaceFrontmatter(body, event.target.value))
                }
              />
            </label>
            <p className="property-help">
              원문을 편집하면 자동 저장합니다. type은 Book, Person 같은 이름이나
              schema.org URL을 사용할 수 있습니다. 연결은 author: &quot;[[노트
              제목]]&quot;처럼 입력하세요.
            </p>
            {!metadata.closed && (
              <p className="property-help">
                본문의 원문 보기에서 속성 마지막에 ---를 추가해 주세요.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="property-help">
              이 노트에 유형과 속성을 붙일 수 있습니다. 본문 맨 앞에 YAML로
              저장됩니다.
            </p>
            <div className="property-create">
              <label>
                노트 유형{" "}
                <select
                  aria-label="새 속성 유형"
                  value={type}
                  disabled={locked}
                  onChange={(event) => setType(event.target.value)}
                >
                  {schemaTypes.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={locked}
                onClick={() =>
                  onChange(replaceFrontmatter(body, `type: ${type}`))
                }
              >
                속성 추가
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
