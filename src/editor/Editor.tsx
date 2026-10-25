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
import { languages } from "@codemirror/language-data";
import { richPreview, imagePath, refreshRichPreview } from "./rich-preview";
import {
  syntaxTree,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
} from "@codemirror/commands";
import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import {
  localDate,
  menuTrigger,
  parseWikiLinks,
  wikiLink,
} from "../domain/links";
import { pasteStillCurrent, safeWebUrl } from "./helpers";
import type { LinkTemplate } from "../settings";
import { renderLinkTemplate } from "./link-templates";
export interface EditorHandle {
  selection(): { from: number; to: number };
  focus(): void;
}
interface Props {
  linkTemplates?: readonly LinkTemplate[];
  documentKey?: string;
  onPasteImage?: (blob: Blob) => Promise<string>;
  readImage?: (path: string) => Promise<Blob>;
  onImageStatus?: (status: { message: string; error: boolean } | null) => void;
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
            if (node.name === "FencedCode" || node.name === "CodeBlock") {
              for (
                let number = line.number;
                number <= doc.lineAt(node.to).number;
                number++
              ) {
                ranges.push(
                  Decoration.line({
                    class:
                      node.name === "FencedCode"
                        ? "cm-fenced-code cm-code-layout"
                        : "cm-code-layout",
                  }).range(doc.line(number).from),
                );
              }
            }
            if (/^ATXHeading[1-6]$/.test(node.name)) {
              ranges.push(
                Decoration.line({
                  class: "cm-heading cm-heading-" + node.name.slice(-1),
                }).range(line.from),
              );
            }
            if (node.name === "InlineCode") {
              ranges.push(
                Decoration.mark({ class: "cm-code-layout" }).range(
                  node.from,
                  node.to,
                ),
              );
            }
            if (activeLines.has(line.number)) return;
            if (
              ["HeaderMark", "EmphasisMark", "CodeMark", "CodeInfo"].includes(
                node.name,
              )
            ) {
              // The opening ATX marker owns its separator; indentation and
              // closing-marker whitespace remain untouched document text.
              const openingHeading =
                node.name === "HeaderMark" &&
                /^ATXHeading[1-6]$/.test(node.node.parent?.name ?? "") &&
                node.node.parent?.firstChild?.from === node.from;
              const separator = openingHeading
                ? (doc.sliceString(node.to, line.to).match(/^[ \t]+/)?.[0]
                    .length ?? 0)
                : 0;
              ranges.push(
                Decoration.replace({}).range(node.from, node.to + separator),
              );
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
              view.dispatch({
                effects: [refreshPreview.of(null), refreshRichPreview.of(null)],
              });
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
  mode: "choices" | "loading" | "failed";
  active: number;
  key: string | undefined;
}
export const Editor = forwardRef<EditorHandle, Props>(
  function Editor(props, ref) {
    const mount = useRef<HTMLDivElement>(null),
      view = useRef<EditorView | null>(null),
      latest = useRef(props),
      revision = useRef(0),
      imageJob = useRef<{
        from: number;
        to: number;
        key: string | undefined;
      } | null>(null),
      fetchJob = useRef<AbortController | null>(null),
      menu = useRef<HTMLDivElement>(null),
      pasteRef = useRef<Paste | null>(null),
      [paste, setPaste] = useState<Paste | null>(null);
    if (latest.current.documentKey !== props.documentKey || props.locked)
      imageJob.current = null;
    latest.current = props;
    const previewConfig = useRef(new Compartment()),
      lockConfig = useRef(new Compartment());
    function changePaste(p: Paste | null) {
      if (!p) {
        fetchJob.current?.abort();
        fetchJob.current = null;
      }
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
            markdown({ codeLanguages: languages }),
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
                { tag: tags.link, color: "var(--link)" },
                { tag: tags.url, color: "var(--muted)" },
                { tag: tags.keyword, color: "var(--syntax-keyword)" },
                { tag: tags.string, color: "var(--syntax-string)" },
                {
                  tag: [tags.number, tags.bool],
                  color: "var(--syntax-number)",
                },
                {
                  tag: tags.comment,
                  color: "var(--syntax-comment)",
                  fontStyle: "italic",
                },
                {
                  tag: [tags.function(tags.variableName), tags.typeName],
                  color: "var(--link)",
                },
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
              // These menus require an explicit [[ or @ trigger. Once visible,
              // Enter must accept the selection, even immediately after opening.
              interactionDelay: 0,
            }),
            previewConfig.current.of(
              latest.current.source
                ? []
                : [preview(), richPreview(latest.current.readImage)],
            ),
            lockConfig.current.of([
              EditorState.readOnly.of(latest.current.locked),
              EditorView.editable.of(!latest.current.locked),
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const job = imageJob.current;
                if (job) {
                  let touched = false;
                  update.changes.iterChangedRanges((from, to) => {
                    if (from <= job.to && to >= job.from) touched = true;
                  });
                  if (touched) {
                    imageJob.current = null;
                    latest.current.onImageStatus?.(null);
                  } else {
                    job.from = update.changes.mapPos(job.from, 1);
                    job.to = update.changes.mapPos(job.to, -1);
                  }
                }
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
              if (update.selectionSet && !update.docChanged) changePaste(null);
              if (update.selectionSet || update.docChanged) {
                const s = update.state.selection.main;
                latest.current.onSelection(s.to - s.from);
              }
            }),
            Prec.highest(
              EditorView.domEventHandlers({
                paste(event, v) {
                  if (latest.current.locked) return true;
                  const images = Array.from(event.clipboardData?.items ?? [])
                    .filter(
                      (item) =>
                        item.kind === "file" && item.type.startsWith("image/"),
                    )
                    .map((item) => item.getAsFile())
                    .filter((file): file is File => file !== null);
                  if (images.length) {
                    event.preventDefault();
                    changePaste(null);
                    const save = latest.current.onPasteImage;
                    if (!save) {
                      latest.current.onImageStatus?.({
                        message: "이미지를 저장할 수 없습니다.",
                        error: true,
                      });
                      return true;
                    }
                    const selection = v.state.selection.main;
                    const job = {
                      from: selection.from,
                      to: selection.to,
                      key: latest.current.documentKey,
                    };
                    imageJob.current = job;
                    latest.current.onImageStatus?.({
                      message: "이미지 저장 중…",
                      error: false,
                    });
                    void (async () => {
                      try {
                        const paths: string[] = [];
                        for (const image of images) {
                          if (imageJob.current !== job) return;
                          const path = await save(image);
                          if (!imagePath(path))
                            throw new Error("안전하지 않은 이미지 경로입니다.");
                          paths.push(path);
                        }
                        if (
                          imageJob.current !== job ||
                          view.current !== v ||
                          latest.current.locked ||
                          latest.current.documentKey !== job.key
                        )
                          return;
                        imageJob.current = null;
                        const insert = paths
                          .map((path) => `![이미지](${path})`)
                          .join("\n");
                        v.dispatch({
                          changes: { from: job.from, to: job.to, insert },
                          selection: { anchor: job.from + insert.length },
                          userEvent: "input.paste",
                        });
                        latest.current.onImageStatus?.(null);
                      } catch (error) {
                        if (imageJob.current !== job) return;
                        imageJob.current = null;
                        latest.current.onImageStatus?.({
                          message:
                            error instanceof Error
                              ? error.message
                              : "이미지 저장에 실패했습니다.",
                          error: true,
                        });
                      }
                    })();
                    return true;
                  }
                  const text = event.clipboardData
                    ?.getData("text/plain")
                    .trim();
                  if (
                    !text ||
                    /\s/.test(text) ||
                    !/^https?:\/\//i.test(text) ||
                    !safeWebUrl(text)
                  )
                    return false;
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
                    active: 0,
                    key: latest.current.documentKey,
                  });
                  return true;
                },
                keydown(event) {
                  return pasteKey(event);
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
        imageJob.current = null;
        fetchJob.current?.abort();
        pasteRef.current = null;
        v.destroy();
        view.current = null;
      };
    }, []);
    useEffect(() => {
      imageJob.current = null;
      changePaste(null);
      latest.current.onImageStatus?.(null);
    }, [props.documentKey, props.locked]);
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
          props.source ? [] : [preview(), richPreview(props.readImage)],
        ),
      });
    }, [props.source, props.readImage, props.documentKey]);
    useEffect(() => {
      view.current?.dispatch({
        effects: lockConfig.current.reconfigure([
          EditorState.readOnly.of(props.locked),
          EditorView.editable.of(!props.locked),
        ]),
      });
    }, [props.locked]);
    useEffect(() => {
      if (!paste) return;
      function position() {
        const v = view.current,
          element = menu.current;
        if (!v || !element || !pasteRef.current) return;
        const rect = v.coordsAtPos(pasteRef.current.to);
        if (!rect) return;
        const height = element.offsetHeight,
          width = element.offsetWidth;
        element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
        element.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8))}px`;
      }
      function outside(event: PointerEvent) {
        if (!menu.current?.contains(event.target as Node)) changePaste(null);
      }
      position();
      window.addEventListener("scroll", position, true);
      window.addEventListener("resize", position);
      document.addEventListener("pointerdown", outside);
      return () => {
        window.removeEventListener("scroll", position, true);
        window.removeEventListener("resize", position);
        document.removeEventListener("pointerdown", outside);
      };
    }, [paste]);
    function pasteKey(event: KeyboardEvent) {
      const p = pasteRef.current;
      if (
        !p ||
        event.isComposing ||
        view.current?.composing ||
        event.keyCode === 229
      )
        return false;
      if (event.key === "Escape") {
        changePaste(null);
        view.current?.focus();
        return true;
      }
      if (p.mode === "loading") return false;
      const count = 3 + (latest.current.linkTemplates?.length ?? 0);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const active =
          (p.active + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
        changePaste({ ...p, active });
        if (menu.current?.contains(event.target as Node)) {
          menu.current
            .querySelectorAll<HTMLButtonElement>(".paste-actions button")
            [active]?.focus();
        }
        return true;
      }
      if (event.key === "Enter") {
        choose(p, p.active);
        return true;
      }
      return false;
    }
    function current(p: Paste) {
      const v = view.current;
      return (
        !!v &&
        pasteRef.current?.revision === p.revision &&
        latest.current.documentKey === p.key &&
        !latest.current.locked &&
        pasteStillCurrent(
          v.state.doc.toString(),
          p.from,
          p.to,
          p.url,
          p.revision,
          revision.current,
        )
      );
    }
    function replace(p: Paste, text: string, caret = text.length) {
      const v = view.current;
      if (!v || !current(p)) return;
      v.dispatch({
        changes: { from: p.from, to: p.to, insert: text },
        selection: { anchor: p.from + caret },
        userEvent: "input.paste",
        annotations: isolateHistory.of("full"),
      });
      changePaste(null);
      v.focus();
    }
    function choose(p: Paste, index: number) {
      if (!current(p)) return;
      if (index === 0) {
        changePaste(null);
        view.current?.focus();
        return;
      }
      if (index === 1) {
        replace(
          p,
          renderLinkTemplate("[{{selection}}]({{url}})", {
            url: p.url,
            title: "",
            selection: p.alias,
            hostname: new URL(p.url).hostname,
          }),
          p.alias ? undefined : 1,
        );
        return;
      }
      const template =
        index === 2
          ? "[{{title}}]({{url}})"
          : latest.current.linkTemplates?.[index - 3]?.template;
      if (!template) return;
      if (template.includes("{{title}}")) void fetchTitle(p, template);
      else
        replace(
          p,
          renderLinkTemplate(template, {
            url: p.url,
            title: "",
            selection: p.alias,
            hostname: new URL(p.url).hostname,
          }),
        );
    }
    async function fetchTitle(p: Paste, template: string) {
      const controller = new AbortController();
      fetchJob.current?.abort();
      fetchJob.current = controller;
      changePaste({ ...p, mode: "loading" });
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(p.url, {
          credentials: "omit",
          mode: "cors",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const limit = 1024 * 1024;
        if (Number(response.headers?.get("content-length")) > limit)
          throw Error();
        let html = "";
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let bytes = 0;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              bytes += part.value.byteLength;
              if (bytes > limit) throw Error();
              html += decoder.decode(part.value, { stream: true });
            }
            html += decoder.decode();
          } finally {
            await reader.cancel();
          }
        } else {
          html = await response.text();
          if (html.length > limit) throw Error();
        }
        if (
          controller.signal.aborted ||
          fetchJob.current !== controller ||
          !current(p)
        )
          return;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = (
          doc
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") ||
          doc.querySelector("title")?.textContent ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300);
        if (!title) throw Error();
        replace(
          p,
          renderLinkTemplate(template, {
            url: p.url,
            title,
            selection: p.alias,
            hostname: new URL(p.url).hostname,
          }),
        );
      } catch {
        if (fetchJob.current === controller && current(p))
          changePaste({ ...p, mode: "failed" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    return (
      <div className={"editor-wrap" + (props.source ? " source-mode" : "")}>
        <div ref={mount} />
        {paste && (
          <div
            ref={menu}
            className="paste-menu"
            role="group"
            aria-label="붙여넣은 링크"
            style={{
              position: "fixed",
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "calc(100vh - 16px)",
              overflow: "auto",
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.target as HTMLElement).closest(".text-button")
              )
                return;
              if (pasteKey(event.nativeEvent)) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="eyebrow">{new URL(paste.url).hostname}</div>
            {paste.mode === "loading" ? (
              <p role="status">제목을 가져오는 중… 계속 써도 괜찮아요.</p>
            ) : (
              <>
                {paste.mode === "failed" && (
                  <p role="status">
                    제목을 가져오지 못했어요. CORS가 허용된 주소만 가져올 수
                    있습니다.
                  </p>
                )}
                <span className="sr-only" role="status">
                  {
                    [
                      "URL 그대로",
                      "별칭 달기",
                      "제목 가져오기",
                      ...(props.linkTemplates ?? []).map(
                        (template) => template.name,
                      ),
                    ][paste.active]
                  }{" "}
                  선택됨. 위아래 화살표로 이동하고 Enter로 적용합니다.
                </span>
                <div className="paste-actions">
                  {[
                    "URL 그대로",
                    "별칭 달기",
                    "제목 가져오기",
                    ...(props.linkTemplates ?? []).map(
                      (template) => template.name,
                    ),
                  ].map((label, index) => (
                    <button
                      key={index}
                      data-active={paste.active === index}
                      onFocus={() => changePaste({ ...paste, active: index })}
                      onClick={() => choose(paste, index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              className="text-button"
              onClick={() => {
                changePaste(null);
                view.current?.focus();
              }}
            >
              닫기 · Esc
            </button>
          </div>
        )}
      </div>
    );
  },
);
