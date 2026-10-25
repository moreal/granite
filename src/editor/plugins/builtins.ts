import { hongdownPlugin } from "../formatting/hongdown";
import { localDate, wikiLink } from "../../domain/links";
import { preview } from "../live-preview";
import { richPreview } from "../rich-preview";
import { frontmatterPresentation } from "./frontmatter";
import type { EditorPlugin } from "./types";
export const builtinPlugins: readonly EditorPlugin[] = [
  hongdownPlugin,
  {
    id: "granite.frontmatter",
    liveExtensions: () => frontmatterPresentation(),
  },
  { id: "granite.markdown", liveExtensions: () => preview() },
  {
    id: "granite.rich",
    liveExtensions: ({ readImage }) => richPreview(readImage),
  },
  {
    id: "granite.completions",
    completions: [
      {
        id: "granite.dates",
        complete: ({ trigger }) =>
          trigger.kind !== "command"
            ? []
            : [
                { title: "오늘", detail: "오늘 날짜 연결", offset: 0 },
                { title: "어제", detail: "어제 날짜 연결", offset: -1 },
                { title: "내일", detail: "내일 날짜 연결", offset: 1 },
              ]
                .filter((c) => c.title.includes(trigger.query))
                .map((c) => ({
                  label: c.title,
                  detail: c.detail,
                  type: "keyword",
                  apply: (view, _completion, from, to) => {
                    const text = wikiLink(localDate(c.offset));
                    view.dispatch({
                      changes: { from, to, insert: text },
                      selection: { anchor: from + text.length },
                      userEvent: "input.complete",
                    });
                  },
                })),
      },
      {
        id: "granite.notes",
        complete: ({ trigger, titles }) => {
          const notes = titles
            .filter((title) =>
              title
                .toLocaleLowerCase()
                .includes(trigger.query.toLocaleLowerCase()),
            )
            .slice(0, 12);
          const options = notes.map((title) => ({
            label: title,
            detail: "노트",
            type: "text",
            apply: wikiLink(title),
          }));
          if (
            trigger.kind === "wiki" &&
            trigger.query &&
            !notes.includes(trigger.query)
          )
            options.push({
              label: trigger.query,
              detail: "새 연결 · 열 때 만들기",
              type: "text",
              apply: wikiLink(trigger.query),
            });
          return options;
        },
      },
    ],
  },
];
