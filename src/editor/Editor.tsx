import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { EditorState, Compartment, Prec, StateEffect } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  ViewPlugin,
  keymap,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
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
  onUserEdit?: () => void;
  onCommand?: () => void;
  onMenuChange?: (open: boolean) => void;
  onSelection: (size: number) => void;
  onOpen: (title: string) => void;
}
interface PreviewLink {
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
  target: string;
  external: boolean;
}
function previewLinks(state: EditorState): PreviewLink[] {
  const links: PreviewLink[] = parseWikiLinks(state.doc.toString()).map(
    (link) => ({
      ...link,
      labelFrom: link.from + 2,
      labelTo: link.to - 2,
      target: link.title,
      external: false,
    }),
  );
  syntaxTree(state).iterate({
    enter(node) {
      if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name))
        return false;
      if (node.name !== "Link") return;
      const raw = state.doc.sliceString(node.from, node.to);
      const match = /^\[((?:\\.|[^\]])*)\]\(([^\s]+)\)$/.exec(raw);
      if (match && !raw.includes("\n") && safeWebUrl(match[2])) {
        links.push({
          from: node.from,
          to: node.to,
          labelFrom: node.from + 1,
          labelTo: node.from + 1 + match[1].length,
          target: match[2],
          external: true,
        });
      }
      return false;
    },
  });
  return links;
}
const refreshPreview = StateEffect.define<null>();
function preview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        // Keep the composing DOM stable, while tracking positions through edits.
        if (update.view.composing) {
          this.decorations = this.decorations.map(update.changes);
          return;
        }
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(refreshPreview)),
          )
        ) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView) {
        const ranges: ReturnType<
          ReturnType<typeof Decoration.mark>["range"]
        >[] = [];
        const doc = view.state.doc;
        const selection = view.state.selection.ranges;
        const activeLines = new Set(
          selection.flatMap((range) => {
            const lines: number[] = [];
            for (
              let n = doc.lineAt(range.from).number;
              n <= doc.lineAt(range.to).number;
              n++
            )
              lines.push(n);
            return lines;
          }),
        );
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
            if (activeLines.has(line.number)) return;
            if (
              ["HeaderMark", "EmphasisMark", "CodeMark"].includes(node.name)
            ) {
              ranges.push(Decoration.replace({}).range(node.from, node.to));
            }
            const classes: Record<string, string> = {
              StrongEmphasis: "cm-strong",
              Emphasis: "cm-emphasis",
              InlineCode: "cm-inline-code",
            };
            const className = classes[node.name];
            if (className)
              ranges.push(
                Decoration.mark({ class: className }).range(node.from, node.to),
              );
          },
        });
        for (const link of previewLinks(view.state)) {
          if (
            selection.some(
              (range) => range.from <= link.to && range.to >= link.from,
            )
          )
            continue;
          // Empty labels and multiline syntax stay editable as ordinary source.
          if (link.labelFrom === link.labelTo) continue;
          ranges.push(Decoration.replace({}).range(link.from, link.labelFrom));
          ranges.push(
            Decoration.mark({
              class: "cm-note-link",
              attributes: {
                "data-link-target": link.target,
                "data-link-external": String(link.external),
              },
            }).range(link.labelFrom, link.labelTo),
          );
          ranges.push(Decoration.replace({}).range(link.labelTo, link.to));
          const label = doc.sliceString(link.labelFrom, link.labelTo);
          const escapes = link.external ? /\\(.)/g : /\\([\\[\]])/g;
          for (const match of label.matchAll(escapes)) {
            const from = link.labelFrom + match.index;
            ranges.push(Decoration.replace({}).range(from, from + 1));
          }
        }
        return Decoration.set(ranges, true);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        compositionend(_event, view) {
          // CodeMirror finishes its composition handler before the queued refresh.
          queueMicrotask(() => {
            if (view.dom.isConnected)
              view.dispatch({ effects: refreshPreview.of(null) });
          });
        },
      },
    },
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
      latest.current.onMenuChange?.(p !== null);
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
                userEvent: "input.complete",
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
            placeholder("본문을 입력하세요."),
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
                { tag: tags.link, color: "#344f6a" },
                { tag: tags.url, color: "#595959" },
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
            previewConfig.current.of(latest.current.source ? [] : preview()),
            lockConfig.current.of([
              EditorState.readOnly.of(latest.current.locked),
              EditorView.editable.of(!latest.current.locked),
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                revision.current++;
                changePaste(null);
                latest.current.onChange(update.state.doc.toString());
                if (
                  update.transactions.some((transaction) =>
                    transaction.isUserEvent("input.complete"),
                  )
                ) {
                  latest.current.onCommand?.();
                } else if (
                  update.transactions.some(
                    (transaction) =>
                      transaction.docChanged &&
                      ["input", "delete", "undo", "redo"].some((event) =>
                        transaction.isUserEvent(event),
                      ),
                  )
                )
                  latest.current.onUserEdit?.();
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
                    userEvent: "input.paste",
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
                mousedown(event) {
                  // A navigation gesture must not first move the caret and reveal syntax.
                  return (
                    (event.metaKey || event.ctrlKey) &&
                    !!(event.target as HTMLElement).closest(".cm-note-link")
                  );
                },
                click(event, v) {
                  if (!(event.metaKey || event.ctrlKey)) return false;
                  const label = (
                    event.target as HTMLElement
                  ).closest<HTMLElement>(".cm-note-link");
                  const position = label
                    ? null
                    : v.posAtCoords({ x: event.clientX, y: event.clientY });
                  const link = label
                    ? {
                        target: label.dataset.linkTarget!,
                        external: label.dataset.linkExternal === "true",
                      }
                    : previewLinks(v.state).find(
                        (candidate) =>
                          position !== null &&
                          position >= candidate.from &&
                          position <= candidate.to,
                      );
                  if (!link) return false;
                  event.preventDefault();
                  if (link.external) {
                    const url = safeWebUrl(link.target);
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                  } else latest.current.onOpen(link.target);
                  return true;
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
          props.source ? [] : preview(),
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
