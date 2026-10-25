import { formatWithWarnings } from "@hongdown/wasm";
import { hongdownOptions } from "./options";
self.onmessage = async (event: MessageEvent<string>) => {
  try {
    const result = await formatWithWarnings(event.data, hongdownOptions);
    self.postMessage({ output: result.output });
  } catch {
    self.postMessage({
      error: "문서 정리를 실행하지 못했습니다. 원문은 그대로입니다.",
    });
  }
};
