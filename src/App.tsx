import { notePreview } from "./domain/note-preview";
import { Button } from "./design-system/Button";
import { noteReference } from "./schema/references";
import { SidebarNoteRow } from "./components/SidebarNoteRow";
import { RecoveryPanel } from "./components/RecoveryPanel";
import { NoteHeader } from "./components/NoteHeader";
import { EditorToolbar } from "./components/EditorToolbar";
import { TodayShortcut } from "./components/TodayShortcut";
import { SaveStatus } from "./components/SaveStatus";
import {
  createSignal,
  createMemo,
  createEffect,
  onSettled,
  untrack,
  Show,
  For,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Compass,
  Download,
  FolderOpen,
  Inbox,
  Link2,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Shuffle,
  Settings,
  X,
  TriangleAlert,
  RefreshCw,
} from "./icons";
import { Editor, type EditorHandle } from "./editor/Editor";
import { SettingsDialog } from "./components/SettingsDialog";
import { readSettings, subscribeSettings } from "./settings";
import { Dialog } from "./components/Dialog";
import { NoteProperties } from "./components/NoteProperties";
import { NoteGraph } from "./components/NoteGraph";
import { projectNoteGraph } from "./domain/note-graph";
import { readFrontmatter } from "./domain/frontmatter";
import { backlinks, localDate } from "./domain/links";
import type { Note } from "./domain/notes";
import { Workspace, type Entry } from "./storage/workspace";
import type { NoteStorage } from "./storage/storage";
import { openDemo } from "./storage/demo";
import { pickFolder, reconnectFolder, savedFolders } from "./storage/folders";
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "작업을 마치지 못했습니다. 다시 시도해 주세요.";
type Modal =
  | {
      kind: "create";
      title: string;
      missing?: boolean;
    }
  | {
      kind: "reload";
      title: string;
    };
export default function App() {
  const [settings, setSettings] = createSignal(readSettings());
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  onSettled(() =>
    untrack(() => subscribeSettings(() => setSettings(readSettings()))),
  );
  const settingsDialog = () =>
    settingsOpen() ? (
      <SettingsDialog
        settings={settings()}
        onClose={() => setSettingsOpen(false)}
      />
    ) : null;
  const settingsButton = () => (
    <Button
      layout="icon"
      class="icon-button"
      aria-label="설정"
      title="설정"
      onClick={() => {
        setSettingsOpen(true);
        setChromeIntent("clear");
      }}
    >
      <Settings size={18} />
    </Button>
  );
  const [workspace, setWorkspace] = createSignal<Workspace | null>(null),
    [notes, setNotes] = createSignal<Note[]>([]),
    [current, setCurrent] = createSignal<string | null>(null),
    [revision, render] = createSignal(0),
    [loading, setLoading] = createSignal(false),
    [busy, setBusy] = createSignal(false),
    [query, setQuery] = createSignal(""),
    [source, setSource] = createSignal(false),
    [metadataEditing, setMetadataEditing] = createSignal<string | null>(null),
    [chromeIntent, setChromeIntent] = createSignal<
      "clear" | "typing" | "pointer"
    >("clear"),
    [editorMenu, setEditorMenu] = createSignal(false),
    [focus, setFocus] = createSignal(false),
    [connections, setConnections] = createSignal(true),
    [selection, setSelection] = createSignal(0),
    [modal, setModal] = createSignal<Modal | null>(null),
    [modalError, setModalError] = createSignal(""),
    [message, setMessage] = createSignal(""),
    [error, setError] = createSignal(""),
    [imageStatus, setImageStatus] = createSignal<{
      message: string;
      error: boolean;
    } | null>(null),
    [folders, setFolders] = createSignal<
      Awaited<ReturnType<typeof savedFolders>>
    >([]),
    [discovery, setDiscovery] = createSignal(0);
  const editor = { current: null } as {
      current: EditorHandle | null;
    },
    search = { current: null } as {
      current: HTMLInputElement | null;
    },
    workspaceRef = { current: null as Workspace | null },
    currentRef = { current: null as string | null },
    booted = { current: false };
  Object.defineProperty(workspaceRef, "current", { get: workspace });
  Object.defineProperty(currentRef, "current", { get: current });
  const notify = () => render((x) => x + 1);
  const entry = (): Entry | undefined =>
    (revision(), workspace()!) && current()!
      ? workspace()!.entries.get(current()!)
      : undefined;
  const storage = () => workspace()!?.storage;
  const putImage = (blob: Blob) => {
    if (!storage()!) return Promise.reject(new Error("저장소가 없습니다."));
    return storage()!.putImage(blob);
  };
  const readImage = (path: string) => {
    if (!storage()!) return Promise.reject(new Error("저장소가 없습니다."));
    return storage()!.readImage(path);
  };
  createEffect(
    () => [current(), workspace(), source()],
    () => {
      setMetadataEditing(null);
    },
  );
  createEffect(
    () => [current()!, workspace()!],
    () =>
      untrack(() => {
        setImageStatus(null);
      }),
  );
  const revealChrome = () => setChromeIntent("clear");
  createEffect(
    () => [current()!, workspace()!, focus()],
    () =>
      untrack(() => {
        setChromeIntent("clear");
        setEditorMenu(false);
      }),
  );
  createEffect(
    () => [revealChrome],
    () =>
      untrack(() => {
        const keys = (event: KeyboardEvent) => {
          if (
            ["Tab", "Escape"].includes(event.key) ||
            ((event.metaKey || event.ctrlKey) &&
              ["s", "k"].includes(event.key.toLowerCase()))
          )
            revealChrome();
        };
        const focusOutside = (event: FocusEvent) => {
          if (
            !(event.target instanceof Element) ||
            !event.target.closest(".cm-content")
          )
            revealChrome();
        };
        const command = (event: MouseEvent) => {
          if (
            event.target instanceof Element &&
            event.target.closest("button, a, select")
          )
            revealChrome();
        };
        const revealFromPointer = () =>
          setChromeIntent((intent) =>
            intent === "typing" ? "pointer" : intent,
          );
        window.addEventListener("pointermove", revealFromPointer);
        window.addEventListener("pointerdown", revealFromPointer);
        window.addEventListener("touchstart", revealFromPointer, {
          passive: true,
        });
        window.addEventListener("keydown", keys, true);
        window.addEventListener("focusin", focusOutside);
        window.addEventListener("click", command, true);
        return () => {
          window.removeEventListener("pointermove", revealFromPointer);
          window.removeEventListener("pointerdown", revealFromPointer);
          window.removeEventListener("touchstart", revealFromPointer);
          window.removeEventListener("keydown", keys, true);
          window.removeEventListener("focusin", focusOutside);
          window.removeEventListener("click", command, true);
        };
      }),
  );
  async function refresh(w = workspace()!) {
    if (w) setNotes(await w.storage.list());
  }
  async function start(storage: NoteStorage) {
    const list = await storage.list(),
      w = new Workspace(storage, notify);
    setWorkspace(w);
    setNotes(list);
    setQuery("");
    setError("");
    setMessage("");
    let first =
      list.find(
        (n) =>
          n.filename === localStorage.getItem("granite.active." + storage.id),
      ) ??
      list.find((n) => n.title === "생각을 연결하는 작은 습관") ??
      list[0];
    if (first) {
      w.load(first);
      setCurrent(first.filename);
    } else setCurrent(null);
    localStorage.setItem("granite.lastMode", storage.kind);
  }
  onSettled(() =>
    untrack(() => {
      if (booted.current) return;
      booted.current = true;
      void savedFolders()
        .then(setFolders)
        .catch(() => {});
      if (localStorage.getItem("granite.lastMode") === "demo") {
        setLoading(true);
        void openDemo()
          .then(start)
          .catch((e) => setError(errorText(e)))
          .finally(() => setLoading(false));
      }
    }),
  );
  createEffect(
    () => [workspace()!, current()!],
    () =>
      untrack(() => {
        if (!workspace()! || !current()!) return;
        try {
          localStorage.setItem(
            "granite.active." + workspace()!.storage.id,
            current()!,
          );
        } catch (e) {
          setError(errorText(e));
        }
      }),
  );
  createEffect(
    () => [revision(), current()!, workspace()!],
    () =>
      untrack(() => {
        if (
          !workspace()! ||
          !current()! ||
          !entry()! ||
          entry()!.status !== "dirty"
        )
          return;
        const timer = setTimeout(
          () =>
            void workspace()!
              .flush(current()!)
              .then(() => refresh(workspace()!))
              .catch((e) => setError(errorText(e))),
          650,
        );
        return () => clearTimeout(timer);
      }),
  );
  onSettled(() =>
    untrack(() => {
      const unload = (e: BeforeUnloadEvent) => {
        const w = workspaceRef.current;
        if (w && [...w.entries.values()].some((e) => e.status !== "saved")) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", unload);
      const keys = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          setMetadataEditing(null);
          const target = workspaceRef.current;
          const title = currentRef.current;
          const handle = editor.current;
          if (target && title)
            void (async () => {
              await Promise.resolve();
              try {
                await handle?.formatForSave();
              } catch {
                /* Save the original on formatter failure. */
              }
              if (
                workspaceRef.current === target &&
                currentRef.current === title &&
                editor.current === handle
              )
                await target.flush(title);
            })();
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setFocus(false);
          setTimeout(() => search.current?.focus(), 0);
        }
      };
      window.addEventListener("keydown", keys);
      return () => {
        window.removeEventListener("beforeunload", unload);
        window.removeEventListener("keydown", keys);
      };
    }),
  );
  async function runStart(mode: "demo" | "folder") {
    setLoading(true);
    setError("");
    try {
      await start(mode === "demo" ? await openDemo() : await pickFolder());
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  async function openNote(note: Note) {
    if (!workspace()! || busy()) return;
    setBusy(true);
    try {
      if (current()!) await workspace()!.flush(current()!);
      const latest = await workspace()!.storage.read(note.filename);
      workspace()!.load(latest);
      setCurrent(note.filename);
      setSelection(0);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function openTitle(title: string) {
    if (busy()) return;
    const existing = notes().find((n) => n.title === title);
    if (existing) void openNote(existing);
    else {
      setModalError("");
      setModal({ kind: "create", title, missing: true });
    }
  }
  function beginCreate() {
    setModalError("");
    setModal({ kind: "create", title: "" });
  }
  async function submitModal() {
    if (!modal()! || !workspace()! || busy()) return;
    setBusy(true);
    setModalError("");
    try {
      if (modal()!.kind === "reload") {
        if (current()!) await workspace()!.reload(current()!);
        await refresh();
        setModal(null);
        return;
      }
      const title = modal()!.title.trim();
      if (!title) throw Error("제목을 입력해 주세요.");
      if (current()!) await workspace()!.flush(current()!);
      const note = await workspace()!.storage.create(title, "");
      workspace()!.load(note);
      setCurrent(note.filename);
      setMessage("새 노트를 만들었습니다.");
      await refresh();
      setSelection(0);
      setModal(null);
      setTimeout(() => editor.current?.focus(), 0);
    } catch (e) {
      setModalError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function daily(title: string) {
    if (!workspace()! || busy()) return;
    const note = notes().find((n) => n.title === title);
    if (note) {
      await openNote(note);
      return;
    }
    setBusy(true);
    try {
      if (current()!) await workspace()!.flush(current()!);
      const n = await workspace()!.storage.create(title, "");
      workspace()!.load(n);
      setCurrent(n.filename);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!entry()!) return;
    const url = URL.createObjectURL(
      new Blob([entry()!.body], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = entry()!.note.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function leave() {
    if (busy()) return;
    setBusy(true);
    try {
      if (workspace()! && current()!) await workspace()!.flush(current()!);
      setWorkspace(null);
      setCurrent(null);
      localStorage.removeItem("granite.lastMode");
      setFolders(await savedFolders().catch(() => []));
    } finally {
      setBusy(false);
    }
  }
  const filtered = () =>
    notes().filter((n) =>
      (n.title + "\n" + (workspace()!?.entries.get(n.filename)?.body ?? n.body))
        .toLocaleLowerCase()
        .includes(query().toLocaleLowerCase()),
    );
  const graph = () =>
    (revision(),
    () =>
      projectNoteGraph(
        notes().map((note) => ({
          ...note,
          body: workspace()!?.entries.get(note.filename)?.body ?? note.body,
        })),
      ))();
  const references = createMemo(
    () => (
      revision(),
      notes().map((note) =>
        noteReference(
          note.title,
          workspace()?.entries.get(note.filename)?.body ?? note.body,
        ),
      )
    ),
  );
  const previewNote = (title: string) => {
    revision();
    const note = notes().find((candidate) => candidate.title === title);
    return note
      ? notePreview(
          note.title,
          workspace()?.entries.get(note.filename)?.body ?? note.body,
        )
      : undefined;
  };
  const linked = () =>
    entry()!
      ? backlinks(
          notes().map((n) => ({
            ...n,
            body: readFrontmatter(
              workspace()!?.entries.get(n.filename)?.body ?? n.body,
            ).markdown,
          })),
          entry()!.note.title,
        )
      : [];
  const others = () => notes().filter((n) => n.filename !== current()!);
  const rediscovered = () =>
    others().length ? others()[discovery() % others().length] : null;
  const recoveryDrafts = () =>
    entry()! && workspace()!
      ? workspace()!
          .drafts.list(entry()!.note.filename)
          .filter(
            (draft, index, all) =>
              all.findIndex(
                (d) => d.body === draft.body && d.baseline === draft.baseline,
              ) === index,
          )
      : [];
  const count = () =>
    entry()!?.body.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return (
    <>
      {!workspace()! ? (
        <div class="welcome">
          <header class="welcome-header">
            <div class="brand">granite</div>
            {settingsButton()}
          </header>
          <main class="welcome-main">
            <div class="welcome-copy">
              <h1>나의 노트</h1>
              <p>로컬 폴더의 Markdown 노트를 읽고 씁니다.</p>
              <Button
                variant="primary"
                size="comfortable"
                class="start-button"
                onClick={() => void runStart("folder")}
                disabled={loading()}
              >
                <FolderOpen size={18} />내 폴더 열기
                <ArrowUpRight size={18} />
              </Button>
              <Button
                class="demo-button"
                onClick={() => void runStart("demo")}
                disabled={loading()}
              >
                데모 둘러보기 <ChevronRight size={16} />
              </Button>
              <p class="start-hint">
                폴더의 최상위 .md 파일만 엽니다. 노트는 이 기기에 저장됩니다.
              </p>
              {folders().map((f) => (
                <Button
                  class="reconnect"
                  onClick={() => {
                    setLoading(true);
                    void reconnectFolder(f)
                      .then(start)
                      .catch((e) => setError(errorText(e)))
                      .finally(() => setLoading(false));
                  }}
                >
                  <RefreshCw size={15} />
                  {f.handle.name} 다시 연결
                </Button>
              ))}
              {loading() && <p role="status">노트를 여는 중…</p>}
              {error() && (
                <p class="ui-feedback ui-feedback--error error" role="alert">
                  {error()}
                </p>
              )}
            </div>
          </main>
          {settingsDialog()}
        </div>
      ) : (
        <div
          class={
            "app-shell" +
            (chromeIntent() === "typing" &&
            !selection() &&
            !modal()! &&
            !settingsOpen() &&
            !editorMenu()
              ? " typing"
              : "") +
            (chromeIntent() === "pointer" ? " pointer-reveal" : "") +
            (focus() ? " focus-mode" : "") +
            (connections() ? "" : " no-connections")
          }
        >
          <aside class="sidebar">
            <div class="brand">granite</div>
            <Button
              class="workspace-switch"
              onClick={() => void leave()}
              disabled={busy()}
            >
              <span class="workspace-dot" />
              <span>
                {workspace()!.storage.kind === "demo"
                  ? "데모 노트"
                  : workspace()!.storage.label}
                <small>
                  {workspace()!.storage.kind === "demo"
                    ? "브라우저에만 저장되는 체험 공간"
                    : "이 기기에 저장"}
                </small>
              </span>
              <ChevronRight size={15} />
            </Button>
            <div class="search-box">
              <Search size={16} />
              <input
                class="ui-input"
                ref={(element) => (search.current = element)}
                aria-label="노트 검색"
                placeholder="생각 찾아보기"
                value={query()}
                onInput={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <Button class="new-note" onClick={beginCreate} disabled={busy()}>
              <Plus size={17} />새 노트
            </Button>
            <nav class="quick-nav" aria-label="빠른 노트">
              <TodayShortcut
                disabled={busy()}
                onOpen={(date) => void daily(date)}
              />
              <Button
                class="quick-nav-action"
                onClick={() => void daily("덤프")}
                disabled={busy()}
              >
                <Inbox size={17} />
                덤프
              </Button>
            </nav>
            <div class="section-label">
              {query() ? "검색 결과" : "최근 노트"}
              <span>{filtered().length}</span>
            </div>
            <div class="note-list">
              <For each={filtered()} keyed={(note) => note.filename}>
                {(n) => (
                  <SidebarNoteRow
                    title={n().title}
                    active={n().filename === current()}
                    disabled={busy()}
                    onOpen={() => void openNote(n())}
                    excerpt={
                      query()
                        ? (
                            workspace()!.entries.get(n().filename)?.body ??
                            n().body
                          )
                            .replace(/[#*`>\[\]]/g, "")
                            .slice(0, 70)
                        : undefined
                    }
                  />
                )}
              </For>
              {!filtered().length && (
                <p class="empty-small">
                  {query()
                    ? "일치하는 생각이 없어요."
                    : "첫 번째 생각을 남겨 보세요."}
                </p>
              )}
            </div>
            <footer class="sidebar-footer">
              {settingsButton()}
              <span>
                <span class="online-dot" />{" "}
                {workspace()!.storage.kind === "demo"
                  ? "데모 · 별도 저장소"
                  : "로컬 폴더 연결됨"}
              </span>
              <span>{notes().length}개의 노트</span>
            </footer>
          </aside>
          <div class="work-area">
            <header class="topbar">
              {focus() && settingsButton()}
              <div class="breadcrumb">
                <Button
                  layout="icon"
                  class="icon-button focus-toggle"
                  title={focus() ? "집중 모드 끝내기" : "집중 모드"}
                  aria-label={focus() ? "집중 모드 끝내기" : "집중 모드"}
                  aria-pressed={focus() ? "true" : "false"}
                  onClick={() => setFocus(!focus())}
                >
                  {focus() ? (
                    <PanelLeftOpen size={18} />
                  ) : (
                    <PanelLeftClose size={18} />
                  )}
                </Button>
                <span>나의 노트</span>
                <ChevronRight size={13} />
                <span class="breadcrumb-current">
                  {entry()!?.note.title ?? "첫 번째 노트"}
                </span>
              </div>
              <EditorToolbar
                hasNote={!!entry()}
                demo={workspace()!.storage.kind === "demo"}
                source={source()}
                connections={connections()}
                focus={focus()}
                onSource={() => setSource(!source())}
                onConnections={() => {
                  if (focus() || !connections()) {
                    setFocus(false);
                    setConnections(true);
                  } else setConnections(false);
                }}
              />
            </header>
            {error() && (
              <div class="notice error" role="alert">
                {error()}
                <Button onClick={() => setError("")} aria-label="오류 닫기">
                  <X size={15} />
                </Button>
              </div>
            )}
            {message() && (
              <div class="notice" role="status">
                {message()}
                <Button onClick={() => setMessage("")} aria-label="안내 닫기">
                  <X size={15} />
                </Button>
              </div>
            )}
            <div class="writing-layout">
              <main class="note-pane">
                {entry()! ? (
                  <>
                    <NoteHeader
                      preview={previewNote}
                      references={references()}
                      propertyMode={settings().propertyEditor}
                      source={source()}
                      sourceEditing={
                        metadataEditing() ===
                        workspace()!.storage.id + ":" + current()!
                      }
                      onSource={() => setSource(true)}
                      onOpen={openTitle}
                      titles={notes().map((note) => note.title)}
                      documentKey={workspace()!.storage.id + ":" + current()!}
                      entry={entry()!}
                      locked={busy()}
                      wordCount={count()}
                      onBody={(body) => workspace()!.edit(current()!, body)}
                    />
                    {entry()!.recovered && (
                      <div class="draft-notice">
                        이전에 저장하지 못한 초안을 복구했습니다.
                        {recoveryDrafts().length > 1 && (
                          <label class="ui-action-row draft-choices">
                            보관된 초안 {recoveryDrafts().length}개
                            <select
                              class="ui-select"
                              aria-label="복구할 초안"
                              value={
                                recoveryDrafts().find(
                                  (d) => d.body === entry()!.body,
                                )?.owner ?? ""
                              }
                              disabled={busy()}
                              onInput={(e) => {
                                setBusy(true);
                                void workspace()!
                                  .restoreDraft(current()!, e.target.value)
                                  .catch((error) => setError(errorText(error)))
                                  .finally(() => setBusy(false));
                              }}
                            >
                              {recoveryDrafts().map((d) => (
                                <option value={d.owner}>
                                  {new Date(d.updated).toLocaleTimeString(
                                    "ko-KR",
                                  )}{" "}
                                  ·{" "}
                                  {d.body.replace(/\s+/g, " ").slice(0, 35) ||
                                    "빈 초안"}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    )}
                    {entry()!.error && (
                      <RecoveryPanel
                        status={entry()!.status}
                        error={entry()!.error!}
                        busy={busy()}
                        onRetry={() =>
                          void workspace()!
                            .flush(current()!)
                            .then(() => refresh())
                        }
                        onDownload={download}
                        onReload={() => {
                          setModalError("");
                          setModal({ kind: "reload", title: "" });
                        }}
                      />
                    )}
                    <Show
                      when={workspace()!.storage.id + ":" + current()!}
                      keyed
                    >
                      {(identity) => (
                        <Editor
                          references={references()}
                          linkTemplates={settings().linkTemplates}
                          autoFormat={settings().autoFormat}
                          documentKey={identity}
                          onPasteImage={putImage}
                          readImage={readImage}
                          onImageStatus={setImageStatus}
                          ref={(element) => (editor.current = element)}
                          value={entry()!.body}
                          source={source()}
                          locked={busy()}
                          titles={notes().map((n) => n.title)}
                          onChange={(body) =>
                            workspace()!.edit(current()!, body)
                          }
                          onEditStart={() => {
                            if (source()) setMetadataEditing(identity);
                          }}
                          onEditLeave={() => setMetadataEditing(null)}
                          onUserEdit={() => setChromeIntent("typing")}
                          onCommand={revealChrome}
                          onMenuChange={(open) => {
                            setEditorMenu(open);
                            if (open) revealChrome();
                          }}
                          onSelection={(size) => {
                            setSelection(size);
                            if (size) revealChrome();
                          }}
                          onOpen={openTitle}
                        />
                      )}
                    </Show>
                    {imageStatus()! && (
                      <p
                        class={
                          imageStatus()!.error
                            ? "image-status error"
                            : "image-status"
                        }
                        role={imageStatus()!.error ? "alert" : "status"}
                      >
                        {imageStatus()!.message}
                      </p>
                    )}
                    <div class="editor-hint">
                      [[ 로 노트 연결 <span>·</span> @ 로 날짜와 노트 찾기{" "}
                      <span>·</span> 링크 클릭으로 편집 · ⌘/Ctrl+클릭으로 열기
                    </div>
                  </>
                ) : (
                  <div class="empty-state">
                    <h1>노트가 없습니다</h1>
                    <p>새 노트를 만들거나 오늘의 노트를 여세요.</p>
                    <Button
                      variant="primary"
                      size="comfortable"
                      onClick={beginCreate}
                    >
                      <Plus size={17} />새 노트
                    </Button>
                  </div>
                )}
              </main>
              {connections() && (
                <aside class="connections">
                  <div class="connection-heading">
                    <Link2 size={16} />
                    <h2>연결된 생각</h2>
                  </div>
                  {current()! && (
                    <NoteGraph
                      graph={graph()}
                      current={current()!}
                      onOpen={openTitle}
                      locked={busy()}
                    />
                  )}
                  <div class="backlink-heading">
                    이 노트를 언급한 곳<span>{linked().length}</span>
                  </div>
                  {linked().length ? (
                    <For each={linked()} keyed={(note) => note.filename}>
                      {(n) => (
                        <Button
                          layout="list"
                          class="backlink-card"
                          onClick={() =>
                            void openNote(
                              notes().find((x) => x.filename === n().filename)!,
                            )
                          }
                          disabled={busy()}
                        >
                          <span>
                            <BookOpen size={14} />
                            <span>{n().title}</span>
                          </span>
                          <p>{n().context}</p>
                          <small>
                            이 노트로 이어지는 연결 <ArrowUpRight size={12} />
                          </small>
                        </Button>
                      )}
                    </For>
                  ) : (
                    <p class="connection-empty">
                      이 노트를 언급한 노트가 없습니다.
                    </p>
                  )}
                  <div class="rediscover">
                    <div class="connection-heading">
                      <Compass size={16} />
                      <h2>다시 발견</h2>
                      <Button
                        layout="icon"
                        class="icon-button"
                        onClick={() => setDiscovery((x) => x + 1)}
                        aria-label="다른 노트 발견"
                        disabled={others().length < 2}
                      >
                        <Shuffle size={14} />
                      </Button>
                    </div>
                    {rediscovered()! ? (
                      <Button
                        layout="list"
                        class="rediscovery-card"
                        onClick={() => void openNote(rediscovered()!)}
                        disabled={busy()}
                      >
                        <h3>{rediscovered()!.title}</h3>
                        <p>
                          {rediscovered()!
                            .body.replace(/[#*`>\[\]]/g, "")
                            .slice(0, 110)}
                        </p>
                      </Button>
                    ) : (
                      <p class="connection-empty">다른 노트가 없습니다.</p>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </div>
          {settingsDialog()}
          {modal()! && (
            <Dialog
              title={
                modal()!.kind === "reload"
                  ? "디스크 내용을 다시 읽을까요?"
                  : "missing" in modal()! &&
                      modal()!.kind === "create" &&
                      (
                        modal()! as Extract<
                          Modal,
                          {
                            kind: "create";
                          }
                        >
                      ).missing
                    ? "아직 없는 노트예요"
                    : "새 노트"
              }
              onClose={() => {
                if (!busy()) setModal(null);
              }}
            >
              {modal()!.kind === "reload" ? (
                <>
                  <p>
                    현재 편집 중인 초안은 지워집니다. 필요하다면 먼저 다운로드해
                    보관하세요.
                  </p>
                  <div class="ui-action-row dialog-actions">
                    <Button
                      variant="secondary"
                      onClick={() => setModal(null)}
                      disabled={busy()}
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      size="comfortable"
                      onClick={() => void submitModal()}
                      disabled={busy()}
                    >
                      초안 버리고 다시 읽기
                    </Button>
                  </div>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitModal();
                  }}
                >
                  <p>
                    {"missing" in modal()! &&
                    modal()!.kind === "create" &&
                    (
                      modal()! as Extract<
                        Modal,
                        {
                          kind: "create";
                        }
                      >
                    ).missing
                      ? "이 제목으로 노트를 만들어 연결을 이어 가세요."
                      : "이름을 붙이고 생각을 시작해 보세요."}
                  </p>
                  <label for="note-title">새 노트 제목</label>
                  <input
                    class="ui-input"
                    id="note-title"
                    value={modal()!.title}
                    onInput={(e) =>
                      setModal({ ...modal()!, title: e.target.value })
                    }
                    placeholder="어떤 생각인가요?"
                    disabled={busy()}
                  />
                  <p class="field-hint">만든 후에는 제목을 바꿀 수 없습니다.</p>
                  {modalError() && (
                    <p
                      class="ui-feedback ui-feedback--error error"
                      role="alert"
                    >
                      {modalError()}
                    </p>
                  )}
                  <div class="ui-action-row dialog-actions">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setModal(null)}
                      disabled={busy()}
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      size="comfortable"
                      type="submit"
                      disabled={busy()}
                    >
                      {busy() ? "저장 중…" : "만들기"}
                    </Button>
                  </div>
                </form>
              )}
            </Dialog>
          )}
        </div>
      )}
    </>
  );
}
