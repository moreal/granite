import { noteMarkdownLanguage } from "../../domain/markdown";
import { EditorState } from "@codemirror/state";
import { readFrontmatter } from "../../domain/frontmatter";
import { parseWikiLinks } from "../../domain/links";
import { richNodes } from "../rich-preview";
import type { EditorPlugin } from "../plugins/types";
export const FORMAT_LIMIT = 1024 * 1024;
export const FORMAT_TIMEOUT = 10_000;
export function formatBody(source: string) {
  if (new TextEncoder().encode(source).length > FORMAT_LIMIT)
    throw Error("문서 정리는 1 MiB 이하의 문서에서 사용할 수 있습니다.");
  const fm = readFrontmatter(source);
  if (fm.present && (!fm.closed || fm.warning))
    throw Error("속성 문법을 먼저 확인해 주세요. 원문은 그대로입니다.");
  return {
    prefix: source.slice(0, fm.bodyStart),
    body: source.slice(fm.bodyStart),
  };
}
export function preserveFormatting(source: string, output: string) {
  const { prefix, body } = formatBody(source);
  const normalize = (text: string) => text.replace(/\r\n/g, "\n");
  const assets = (text: string) => {
    const targets: string[] = [];
    noteMarkdownLanguage.parser.parse(text).iterate({
      enter(node) {
        if (
          ["FencedCode", "CodeBlock", "InlineCode", "Frontmatter"].includes(
            node.name,
          )
        )
          return false;
        if (node.name === "Image") {
          targets.push(text.slice(node.from, node.to));
          return false;
        }
      },
    });
    return targets.sort();
  };
  const signature = (text: string) =>
    JSON.stringify({
      assets: assets(text),
      wiki: parseWikiLinks(text)
        .map((link) => link.title)
        .sort(),
      rich: richNodes(EditorState.create({ doc: normalize(text) }))
        .map((node) =>
          JSON.stringify([node.kind, node.value, node.label, node.block]),
        )
        .sort(),
    });
  if (signature(body) !== signature(output))
    throw Error(
      "연결·이미지·수식·다이어그램이 달라져 정리를 중단했습니다. 원문은 그대로입니다.",
    );
  return (
    prefix +
    (source.includes("\r\n")
      ? normalize(output).replace(/\n/g, "\r\n")
      : output)
  );
}
export function runHongdown(
  body: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(
      new URL("./hongdown.worker.ts", import.meta.url),
      { type: "module" },
    );
    const finish = (error?: Error, output?: string) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(output!);
    };
    const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(Error("문서 정리 시간이 초과되었습니다. 다시 시도해 주세요.")),
      FORMAT_TIMEOUT,
    );
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = () =>
      finish(Error("문서 정리를 불러오지 못했습니다. 원문은 그대로입니다."));
    worker.onmessage = (
      event: MessageEvent<{ output?: string; error?: string }>,
    ) => {
      if (typeof event.data.output === "string")
        finish(undefined, event.data.output);
      else finish(Error(event.data.error ?? "문서 정리에 실패했습니다."));
    };
    worker.postMessage(body);
  });
}
export const hongdownPlugin: EditorPlugin = {
  id: "granite.formatting",
  formatters: [
    {
      id: "granite.hongdown",
      label: "문서 정리",
      async format(source, { signal }) {
        const { body } = formatBody(source);
        return preserveFormatting(source, await runHongdown(body, signal));
      },
    },
  ],
};
