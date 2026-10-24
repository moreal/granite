/** Assets are immutable original raster bytes; Markdown paths are portable. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const assetPattern = /^assets\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/;
export function isImageAssetPath(path: string): boolean {
  return assetPattern.test(path);
}
export function validateImageAssetPath(path: string): string {
  if (!isImageAssetPath(path))
    throw Error("안전한 이미지 파일 경로가 아닙니다.");
  return path.slice("assets/".length);
}
export async function prepareImage(blob: Blob) {
  if (blob.size > MAX_IMAGE_BYTES)
    throw Error("이미지는 20 MiB 이하만 붙여넣을 수 있습니다.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const starts = (...signature: number[]) =>
    signature.every((b, i) => bytes[i] === b);
  let extension: string, type: string;
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) {
    extension = "png";
    type = "image/png";
  } else if (starts(255, 216, 255)) {
    extension = "jpg";
    type = "image/jpeg";
  } else if (starts(71, 73, 70, 56, 55, 97) || starts(71, 73, 70, 56, 57, 97)) {
    extension = "gif";
    type = "image/gif";
  } else if (
    starts(82, 73, 70, 70) &&
    bytes.length >= 12 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  ) {
    extension = "webp";
    type = "image/webp";
  } else
    throw Error(
      "PNG, JPEG, GIF, WebP 이미지만 지원합니다. SVG는 지원하지 않습니다.",
    );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    path: `assets/${hash}.${extension}`,
    blob: new Blob([bytes], { type }),
  };
}
export async function verifyImage(path: string, blob: Blob): Promise<Blob> {
  validateImageAssetPath(path);
  const image = await prepareImage(blob);
  if (image.path !== path)
    throw Error(
      "이미지 파일이 변경되었거나 손상되었습니다. 기존 파일은 덮어쓰지 않습니다.",
    );
  return image.blob;
}

// Kept separate from note localStorage; resolving waits for transaction commit.
async function openAssetDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    throw Error("브라우저 이미지 저장소를 사용할 수 없습니다.");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("granite.image-assets.v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(
        Error(
          "이미지 저장소를 열 수 없습니다. 다른 탭을 닫고 다시 시도하세요.",
        ),
      );
    request.onsuccess = () => resolve(request.result);
  });
}
export async function demoImage(
  id: string,
  path: string,
  blob?: Blob,
): Promise<Blob> {
  validateImageAssetPath(path);
  const db = await openAssetDatabase();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const tx = db.transaction("images", blob ? "readwrite" : "readonly");
      const store = tx.objectStore("images");
      const key = JSON.stringify([id, path]);
      let result: Blob;
      const get = store.get(key);
      get.onsuccess = () => {
        result = get.result;
        if (!result && blob) {
          result = blob;
          store.add(blob, key);
        }
      };
      tx.oncomplete = () =>
        result
          ? resolve(result)
          : reject(Error("이미지 파일을 찾을 수 없습니다."));
      tx.onabort = () =>
        reject(tx.error ?? Error("이미지를 저장하지 못했습니다."));
      tx.onerror = () => reject(tx.error ?? Error("이미지 저장소 오류입니다."));
    });
  } finally {
    db.close();
  }
}
