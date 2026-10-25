import { propertyText } from "../../domain/frontmatter";
export interface PropertyRowProps {
  name: string;
  value: unknown;
}
export function PropertyRow(props: PropertyRowProps) {
  return (
    <div class="property-row">
      <dt>{props.name}</dt>
      <dd>{propertyText(props.value)}</dd>
    </div>
  );
}
