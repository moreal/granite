import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  WidgetType,
  ViewPlugin,
  keymap,
  placeholder,
  type DecorationSet,
} from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  syntaxTree,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import {
  localDate,
  markdownLink,
  menuTrigger,
  parseWikiLinks,
  wikiLink,
} from "../domain/links";
import { pasteStillCurrent, safeWebUrl } from "./helpers";
export interface EditorHandle {
  selection(): { from: number; to: number };
  focus(): void;
}
interface Props {
  value: string;
  source: boolean;
  locked: boolean;
  titles: string[];
  onChange: (body: string) => void;
  onSelection: (size: number) => void;
  onOpen: (title: string) => void;
}
class LinkWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly title: string,
    readonly open: (title: string) => void,
    readonly external = false,
  ) {
    super();
  }
  eq(other: LinkWidget) {
    return this.text === other.text && this.title === other.title;
  }
  toDOM() {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "cm-note-link";
    el.textContent = this.text;
    el.setAttribute(
      "aria-label",
      `${this.text} ${this.external ? "외부 링크" : "노트 열기"}`,
    );
    el.onclick = (e) => {
      e.preventDefault();
      if (this.external) {
        const url = safeWebUrl(this.title);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } else this.open(this.title);
    };
    return el;
  }
  ignoreEvent() {
    return true;
  }
}
function preview(open: (title: string) => void) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(u: {
        view: EditorView;
        docChanged: boolean;
        selectionSet: boolean;
        viewportChanged: boolean;
      }) {
        if (u.docChanged || u.selectionSet || u.viewportChanged)
          this.decorations = this.build(u.view);
      }
      build(view: EditorView) {
        const ranges: ReturnType<
          ReturnType<typeof Decoration.mark>["range"]
        >[] = [];
        const doc = view.state.doc;
        const active = new Set(
          view.state.selection.ranges.flatMap((r) => {
            const lines: number[] = [];
            for (
              let n = doc.lineAt(r.from).number;
              n <= doc.lineAt(r.to).number;
              n++
            )
              lines.push(n);
            return lines;
          }),
        );
        const inactive = (from: number) => !active.has(doc.lineAt(from).number);
        syntaxTree(view.state).iterate({
          enter(node) {
            const line = doc.lineAt(node.from);
            if (/^ATXHeading[1-6]$/.test(node.name)) {
              ranges.push(
                Decoration.line({
                  class: "cm-heading cm-heading-" + node.name.slice(-1),
                }).range(line.from),
              );
            }
            if (!inactive(node.from)) return;
            if (["HeaderMark", "EmphasisMark", "CodeMark"].includes(node.name))
              ranges.push(Decoration.replace({}).range(node.from, node.to));
            if (node.name === "StrongEmphasis")
              ranges.push(
                Decoration.mark({ class: "cm-strong" }).range(
                  node.from,
                  node.to,
                ),
              );
            if (node.name === "Emphasis")
              ranges.push(
                Decoration.mark({ class: "cm-emphasis" }).range(
                  node.from,
                  node.to,
                ),
              );
            if (node.name === "InlineCode")
              ranges.push(
                Decoration.mark({ class: "cm-inline-code" }).range(
                  node.from,
                  node.to,
                ),
              );
            if (node.name === "Link") {
              const raw = doc.sliceString(node.from, node.to),
                m = /^\[((?:\\.|[^\]])*)\]\(([^\s]+)\)$/.exec(raw);
              if (m && !raw.includes("\n") && safeWebUrl(m[2]))
                ranges.push(
                  Decoration.replace({
                    widget: new LinkWidget(
                      m[1].replace(/\\(.)/g, "$1"),
                      m[2],
                      open,
                      true,
                    ),
                  }).range(node.from, node.to),
                );
              return false;
            }
          },
        });
        for (const l of parseWikiLinks(doc.toString()))
          if (inactive(l.from))
            ranges.push(
              Decoration.replace({
                widget: new LinkWidget(l.title, l.title, open),
              }).range(l.from, l.to),
            );
        return Decoration.set(ranges, true);
      }
    },
    { decorations: (v) => v.decorations },
  );
}
interface Paste {
  from: number;
  to: number;
  url: string;
  alias: string;
  revision: number;
  mode: "choices" | "alias" | "loading" | "failed";
}
export const Editor = forwardRef<EditorHandle, Props>(
  function Editor(props, ref) {
    const mount = useRef<HTMLDivElement>(null),
      view = useRef<EditorView | null>(null),
      latest = useRef(props),
      revision = useRef(0),
      pasteRef = useRef<Paste | null>(null),
      [paste, setPaste] = useState<Paste | null>(null);
    latest.current = props;
    const previewConfig = useRef(new Compartment()),
      lockConfig = useRef(new Compartment());
    function changePaste(p: Paste | null) {
      pasteRef.current = p;
      setPaste(p);
    }
    useImperativeHandle(
      ref,
      () => ({
        selection: () => {
          const s = view.current?.state.selection.main;
          return { from: s?.from ?? 0, to: s?.to ?? 0 };
        },
        focus: () => view.current?.focus(),
      }),
      [],
    );
    useEffect(() => {
      if (!mount.current) return;
      const complete = (ctx: CompletionContext) => {
        const trigger = menuTrigger(
          ctx.state.doc.toString(),
          ctx.pos,
          !!ctx.view?.composing,
        );
        if (!trigger) return null;
        const commands =
          trigger.kind === "command"
            ? [
                { title: "오늘", detail: "오늘 날짜 연결", offset: 0 },
                { title: "어제", detail: "어제 날짜 연결", offset: -1 },
                { title: "내일", detail: "내일 날짜 연결", offset: 1 },
              ].filter((c) => c.title.includes(trigger.query))
            : [];
        const notes = latest.current.titles
          .filter((t) =>
            t.toLocaleLowerCase().includes(trigger.query.toLocaleLowerCase()),
          )
          .slice(0, 12);
        const options = [
          ...commands.map((c) => ({
            label: c.title,
            detail: c.detail,
            type: "keyword",
            apply: (v: EditorView, _c: unknown, from: number, to: number) => {
              const text = wikiLink(localDate(c.offset));
              v.dispatch({
                changes: { from, to, insert: text },
                selection: { anchor: from + text.length },
              });
            },
          })),
          ...notes.map((t) => ({
            label: t,
            detail: "노트",
            type: "text",
            apply: wikiLink(t),
          })),
        ];
        if (
          trigger.query &&
          !notes.includes(trigger.query) &&
          trigger.kind === "wiki"
        )
          options.push({
            label: trigger.query,
            detail: "새 연결 · 열 때 만들기",
            type: "text",
            apply: wikiLink(trigger.query),
          });
        return { from: trigger.from, to: trigger.to, options, filter: false };
      };
      const v = new EditorView({
        parent: mount.current,
        state: EditorState.create({
          doc: latest.current.value,
          extensions: [
            markdown(),
            history(),
            EditorView.lineWrapping,
            placeholder(
              "떠오른 생각을 적어 보세요.  [[ 로 연결하고, @ 로 날짜를 넣어요.",
            ),
            EditorView.contentAttributes.of({
              "aria-label": "노트 본문",
              role: "textbox",
              "aria-multiline": "true",
            }),
            syntaxHighlighting(
              HighlightStyle.define([
                { tag: tags.strong, fontWeight: "650" },
                { tag: tags.emphasis, fontStyle: "italic" },
                { tag: tags.monospace, fontFamily: "ui-monospace, monospace" },
                { tag: tags.link, color: "#557463" },
                { tag: tags.url, color: "#77756b" },
              ]),
            ),
            keymap.of([
              ...completionKeymap,
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            autocompletion({
              override: [complete],
              activateOnTyping: true,
              defaultKeymap: false,
            }),
            previewConfig.current.of(
              latest.current.source
                ? []
                : preview((title) => latest.current.onOpen(title)),
            ),
            lockConfig.current.of([
              EditorState.readOnly.of(latest.current.locked),
              EditorView.editable.of(!latest.current.locked),
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                revision.current++;
                changePaste(null);
                latest.current.onChange(update.state.doc.toString());
              }
              if (update.selectionSet || update.docChanged) {
                const s = update.state.selection.main;
                latest.current.onSelection(s.to - s.from);
              }
            }),
            Prec.highest(
              EditorView.domEventHandlers({
                paste(event, v) {
                  if (latest.current.locked) return true;
                  const text = event.clipboardData
                    ?.getData("text/plain")
                    .trim();
                  if (!text || !safeWebUrl(text)) return false;
                  event.preventDefault();
                  const s = v.state.selection.main,
                    alias = v.state.sliceDoc(s.from, s.to);
                  v.dispatch({
                    changes: { from: s.from, to: s.to, insert: text },
                    selection: { anchor: s.from + text.length },
                  });
                  changePaste({
                    from: s.from,
                    to: s.from + text.length,
                    url: text,
                    alias,
                    revision: revision.current,
                    mode: "choices",
                  });
                  return true;
                },
                keydown(event) {
                  if (event.key === "Escape" && pasteRef.current) {
                    changePaste(null);
                    return true;
                  }
                  return false;
                },
                click(event, v) {
                  const target = event.target as HTMLElement;
                  if (target.closest("button")) return false;
                  if (event.metaKey || event.ctrlKey) {
                    const p = v.posAtCoords({
                      x: event.clientX,
                      y: event.clientY,
                    });
                    const link =
                      p === null
                        ? undefined
                        : parseWikiLinks(v.state.doc.toString()).find(
                            (l) => p >= l.from && p <= l.to,
                          );
                    if (link) {
                      latest.current.onOpen(link.title);
                      return true;
                    }
                  }
                  return false;
                },
              }),
            ),
          ],
        }),
      });
      view.current = v;
      return () => {
        v.destroy();
        view.current = null;
      };
    }, []);
    useEffect(() => {
      const v = view.current;
      if (v && v.state.doc.toString() !== props.value) {
        v.dispatch({
          changes: { from: 0, to: v.state.doc.length, insert: props.value },
        });
      }
    }, [props.value]);
    useEffect(() => {
      view.current?.dispatch({
        effects: previewConfig.current.reconfigure(
          props.source ? [] : preview((title) => latest.current.onOpen(title)),
        ),
      });
    }, [props.source]);
    useEffect(() => {
      view.current?.dispatch({
        effects: lockConfig.current.reconfigure([
          EditorState.readOnly.of(props.locked),
          EditorView.editable.of(!props.locked),
        ]),
      });
    }, [props.locked]);
    function replace(p: Paste, label: string) {
      const v = view.current;
      if (
        !v ||
        pasteRef.current?.revision !== p.revision ||
        latest.current.locked ||
        !pasteStillCurrent(
          v.state.doc.toString(),
          p.from,
          p.to,
          p.url,
          p.revision,
          revision.current,
        )
      ) {
        changePaste(null);
        return;
      }
      const text = markdownLink(label, p.url);
      v.dispatch({
        changes: { from: p.from, to: p.to, insert: text },
        selection: { anchor: p.from + text.length },
      });
      changePaste(null);
      v.focus();
    }
    async function fetchTitle(p: Paste) {
      changePaste({ ...p, mode: "loading" });
      try {
        const response = await fetch(p.url, {
          credentials: "omit",
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw Error();
        const html = await response.text();
        const title = new DOMParser()
          .parseFromString(html, "text/html")
          .querySelector("title")
          ?.textContent?.trim();
        if (!title) throw Error();
        replace(p, title);
      } catch {
        if (
          pasteRef.current?.revision === p.revision &&
          revision.current === p.revision
        )
          changePaste({ ...p, mode: "failed" });
      }
    }
    return (
      <div className={"editor-wrap" + (props.source ? " source-mode" : "")}>
        <div ref={mount} />
        {paste && (
          <div
            className="paste-menu"
            role="dialog"
            aria-label="붙여넣은 링크"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                changePaste(null);
                view.current?.focus();
              }
            }}
          >
            <div className="eyebrow">외부 출처</div>
            {paste.mode === "loading" ? (
              <p role="status">제목을 가져오는 중… 계속 써도 괜찮아요.</p>
            ) : (
              <>
                <p>
                  {paste.mode === "failed"
                    ? "제목을 가져오지 못했어요. CORS가 허용된 주소만 가져올 수 있습니다."
                    : "링크를 어떻게 남길까요?"}
                </p>
                <div className="paste-actions">
                  <button onClick={() => changePaste(null)}>URL 그대로</button>
                  <button
                    onClick={() =>
                      paste.alias
                        ? replace(paste, paste.alias)
                        : changePaste({ ...paste, mode: "alias" })
                    }
                  >
                    별칭 달기
                  </button>
                  <button onClick={() => void fetchTitle(paste)}>
                    제목 가져오기
                  </button>
                </div>
                {paste.mode === "alias" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (paste.alias.trim()) replace(paste, paste.alias);
                    }}
                  >
                    <label>
                      링크 별칭
                      <input
                        autoFocus
                        value={paste.alias}
                        onChange={(e) =>
                          changePaste({ ...paste, alias: e.target.value })
                        }
                      />
                    </label>
                    <button type="submit">적용</button>
                  </form>
                )}
              </>
            )}
            <button className="text-button" onClick={() => changePaste(null)}>
              닫기 · Esc
            </button>
          </div>
        )}
      </div>
    );
  },
);
