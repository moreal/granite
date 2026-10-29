import type { WritingHeading } from "./outline";
import { Button } from "../design-system/Button";
export function Outline(props: {
  headings: WritingHeading[];
  active: number;
  onPick: (heading: WritingHeading) => void;
}) {
  return (
    <>
      {props.headings.length > 1 ? (
        <nav class="writing-outline" aria-label="목차">
          <ol>
            {props.headings.map((heading, index) => (
              <li class={"outline-h" + heading.level}>
                <Button
                  size="compact"
                  layout="list"
                  title={heading.text}
                  aria-current={index === props.active ? "location" : undefined}
                  onClick={() => props.onPick(heading)}
                >
                  <span class="outline-bar" aria-hidden="true" />
                  <span class="outline-text">{heading.text}</span>
                </Button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </>
  );
}
