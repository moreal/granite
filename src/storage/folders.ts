import { DirectoryStorage, type DirectoryHandle } from "./storage";
interface SavedFolder {
  id: string;
  handle: DirectoryHandle;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("granite-folders", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("handles", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function savedFolders(): Promise<SavedFolder[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const t = db.transaction("handles");
    const r = t.objectStore("handles").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}
export async function rememberFolder(handle: DirectoryHandle) {
  const folders = await savedFolders();
  for (const item of folders)
    if (await handle.isSameEntry(item.handle))
      return new DirectoryStorage(handle, item.id);
  const id = crypto.randomUUID();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("handles", "readwrite");
    t.objectStore("handles").put({ id, handle });
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
  return new DirectoryStorage(handle, id);
}
export async function pickFolder() {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (options: {
        mode: "readwrite";
      }) => Promise<DirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker)
    throw Error(
      "로컬 폴더는 데스크톱 Chrome에서 열 수 있습니다. 데모로 먼저 둘러보세요.",
    );
  const handle = await picker({ mode: "readwrite" });
  return rememberFolder(handle);
}
export async function reconnectFolder(item: SavedFolder) {
  if (
    (await item.handle.requestPermission?.({ mode: "readwrite" })) !== "granted"
  )
    throw Error("폴더 접근 권한이 필요합니다. 다시 연결해 주세요.");
  return new DirectoryStorage(item.handle, item.id);
}
