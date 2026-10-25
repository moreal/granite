import { Dialog } from "../components/Dialog";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { frontmatterSyntax } from "../domain/markdown";
import { languages } from "@codemirror/language-data";
import { imagePath } from "./rich-preview";
import { previewLinks } from "./live-preview";
import { documentContext, synchronizeDocument } from "./document-context";
import { builtinPlugins } from "./plugins/builtins";
import { resolveEditorPlugins, pluginCompletions } from "./plugins/registry";
import type { EditorPlugin } from "./plugins/types";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
} from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { pasteStillCurrent, safeWebUrl } from "./helpers";
import type { LinkTemplate } from "../settings";
import { renderLinkTemplate } from "./link-templates";
export interface EditorHandle {
  selection(): { from: number; to: number };
  focus(): void;
  requestFormatting(id?: string): void;
}
interface Props {
  plugins?: readonly EditorPlugin[];
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
    const formattingJob = useRef<{
      controller: AbortController;
      key: string | undefined;
      revision: number;
      original: string;
      anchor: number;
      head: number;
      output?: string;
    } | null>(null);
    const [formatting, setFormatting] = useState<{
      label: string;
      original?: string;
      output?: string;
      message?: string;
    } | null>(null);
    function cancelFormatting() {
      formattingJob.current?.controller.abort();
      formattingJob.current = null;
      setFormatting(null);
    }
    function formattingCurrent(job: NonNullable<typeof formattingJob.current>) {
      return (
        formattingJob.current === job &&
        !job.controller.signal.aborted &&
        latest.current.documentKey === job.key &&
        revision.current === job.revision &&
        !latest.current.locked &&
        !!view.current &&
        !view.current.composing &&
        view.current.state.sliceDoc() === job.original
      );
    }
    async function requestFormatting(id?: string) {
      cancelFormatting();
      const v = view.current;
      if (!v || latest.current.locked || v.composing) return;
      const formatter = resolveEditorPlugins(
        latest.current.plugins ?? builtinPlugins,
      )
        .flatMap((p) => p.formatters ?? [])
        .find((f) => !id || f.id === id);
      if (!formatter) return;
      const selection = v.state.selection.main;
      const job = {
        controller: new AbortController(),
        key: latest.current.documentKey,
        revision: revision.current,
        original: v.state.sliceDoc(),
        anchor: selection.anchor,
        head: selection.head,
        output: undefined as string | undefined,
      };
      formattingJob.current = job;
      setFormatting({ label: formatter.label, message: "문서를 정리하는 중…" });
      try {
        const output = await formatter.format(job.original, {
          signal: job.controller.signal,
        });
        if (!formattingCurrent(job)) return;
        if (output === job.original) {
          setFormatting({
            label: formatter.label,
            message: "정리할 변경 사항이 없습니다.",
          });
          return;
        }
        job.output = output;
        setFormatting({
          label: formatter.label,
          original: job.original,
          output,
        });
      } catch (error) {
        if (formattingCurrent(job))
          setFormatting({
            label: formatter.label,
            message:
              error instanceof Error
                ? error.message
                : "문서 정리에 실패했습니다.",
          });
      }
    }
    function applyFormatting() {
      const job = formattingJob.current,
        v = view.current;
      if (!job || !v || job.output === undefined || !formattingCurrent(job)) {
        cancelFormatting();
        return;
      }
      const output = v.state.toText(job.output);
      const before = v.state.doc.toString(),
        after = output.toString();
      let from = 0,
        oldEnd = before.length,
        newEnd = after.length;
      while (from < oldEnd && from < newEnd && before[from] === after[from])
        from++;
      while (
        oldEnd > from &&
        newEnd > from &&
        before[oldEnd - 1] === after[newEnd - 1]
      ) {
        oldEnd--;
        newEnd--;
      }
      const changes = v.state.changes({
        from,
        to: oldEnd,
        insert: output.slice(from, newEnd),
      });
      cancelFormatting();
      v.dispatch({
        changes,
        selection: {
          anchor: changes.mapPos(job.anchor),
          head: changes.mapPos(job.head),
        },
        annotations: isolateHistory.of("full"),
        userEvent: "input.format",
      });
      v.focus();
    }
    resolveEditorPlugins(props.plugins ?? builtinPlugins);
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
        requestFormatting: (id) => {
          void requestFormatting(id);
        },
      }),
      [],
    );
    useEffect(() => {
      if (!mount.current) return;
      const complete = pluginCompletions(
        () => resolveEditorPlugins(latest.current.plugins ?? builtinPlugins),
        () => latest.current.titles,
      );
      const liveExtensions = () =>
        resolveEditorPlugins(latest.current.plugins ?? builtinPlugins).flatMap(
          (plugin) =>
            plugin.liveExtensions?.({
              readImage: latest.current.readImage,
              open: (title) => latest.current.onOpen(title),
            }) ?? [],
        );
      const v = new EditorView({
        parent: mount.current,
        state: EditorState.create({
          doc: latest.current.value,
          selection: {
            anchor: latest.current.source
              ? 0
              : documentContext(latest.current.value.replace(/\r\n/g, "\n"))
                  .bodyStart,
          },
          extensions: [
            markdown({
              codeLanguages: languages,
              extensions: frontmatterSyntax,
            }),
            history(),
            EditorState.lineSeparator.of(
              latest.current.value.includes("\r\n") ? "\r\n" : "\n",
            ),
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
              latest.current.source ? [] : liveExtensions(),
            ),
            lockConfig.current.of([
              EditorState.readOnly.of(latest.current.locked),
              EditorView.editable.of(!latest.current.locked),
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                cancelFormatting();
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
                latest.current.onChange(update.state.sliceDoc());
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
                compositionstart() {
                  cancelFormatting();
                  return false;
                },
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
        formattingJob.current?.controller.abort();
        formattingJob.current = null;
        imageJob.current = null;
        fetchJob.current?.abort();
        pasteRef.current = null;
        v.destroy();
        view.current = null;
      };
    }, []);
    useEffect(() => {
      cancelFormatting();
      imageJob.current = null;
      changePaste(null);
      latest.current.onImageStatus?.(null);
    }, [props.documentKey, props.locked]);
    useEffect(() => {
      const v = view.current;
      if (v && v.state.sliceDoc() !== props.value) {
        // A narrow source edit maps a prose selection through property updates.
        const before = v.state.doc.toString();
        const afterText = v.state.toText(props.value);
        const after = afterText.toString();
        let from = 0;
        while (
          from < before.length &&
          from < after.length &&
          before[from] === after[from]
        )
          from++;
        let oldEnd = before.length,
          newEnd = after.length;
        while (
          oldEnd > from &&
          newEnd > from &&
          before[oldEnd - 1] === after[newEnd - 1]
        ) {
          oldEnd--;
          newEnd--;
        }
        v.dispatch({
          changes: { from, to: oldEnd, insert: afterText.slice(from, newEnd) },
          annotations: [
            synchronizeDocument.of(true),
            isolateHistory.of("full"),
          ],
        });
      }
    }, [props.value]);
    useEffect(() => {
      view.current?.dispatch({
        effects: previewConfig.current.reconfigure(
          props.source
            ? []
            : resolveEditorPlugins(props.plugins ?? builtinPlugins).flatMap(
                (plugin) =>
                  plugin.liveExtensions?.({
                    readImage: props.readImage,
                    open: (title) => latest.current.onOpen(title),
                  }) ?? [],
              ),
        ),
      });
    }, [props.source, props.readImage, props.documentKey, props.plugins]);
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
        {formatting && (
          <Dialog title={formatting.label} onClose={cancelFormatting}>
            <p>
              변경 내용을 확인한 뒤 적용하세요. 적용 후 실행 취소할 수 있습니다.
            </p>
            {formatting.message && <p role="status">{formatting.message}</p>}
            {formatting.output !== undefined && (
              <div className="format-comparison">
                <label>
                  원문
                  <textarea
                    aria-label="정리 전 원문"
                    readOnly
                    value={formatting.original}
                  />
                </label>
                <label>
                  정리 결과
                  <textarea
                    aria-label="정리 결과"
                    readOnly
                    value={formatting.output}
                  />
                </label>
              </div>
            )}
            <div className="dialog-actions">
              <button onClick={cancelFormatting}>취소</button>
              {formatting.output !== undefined && (
                <button className="primary" onClick={applyFormatting}>
                  적용
                </button>
              )}
            </div>
          </Dialog>
        )}

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
