import { For } from "solid-js";
import { linkWarnings, type NoteReference } from "../../schema/references";
import { readFrontmatter } from "../../domain/frontmatter";
export function PropertyAdvice(props: {
  body?: string;
  property?: string;
  value?: string;
  references: readonly NoteReference[];
}) {
  const warnings = () =>
    props.body !== undefined
      ? [...readFrontmatter(props.body).properties].flatMap(([key, value]) =>
          (Array.isArray(value) ? value : [value]).flatMap((item) =>
            typeof item === "string"
              ? linkWarnings(item, key, props.references)
              : [],
          ),
        )
      : linkWarnings(props.value ?? "", props.property ?? "", props.references);
  return (
    <For each={warnings()} keyed={(text) => text}>
      {(text) => <p class="property-advice">{text()}</p>}
    </For>
  );
}
