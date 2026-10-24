import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  X,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";
import { Editor, type EditorHandle } from "./editor/Editor";
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
  | { kind: "create"; title: string; missing?: boolean }
  | { kind: "reload"; title: string };
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [notes, setNotes] = useState<Note[]>([]),
    [current, setCurrent] = useState<string | null>(null),
    [revision, render] = useState(0),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(false),
    [chromeIntent, setChromeIntent] = useState<"clear" | "typing" | "pointer">(
      "clear",
    ),
    [editorMenu, setEditorMenu] = useState(false),
    [focus, setFocus] = useState(false),
    [connections, setConnections] = useState(true),
    [selection, setSelection] = useState(0),
    [modal, setModal] = useState<Modal | null>(null),
    [modalError, setModalError] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [imageStatus, setImageStatus] = useState<{
      message: string;
      error: boolean;
    } | null>(null),
    [folders, setFolders] = useState<Awaited<ReturnType<typeof savedFolders>>>(
      [],
    ),
    [discovery, setDiscovery] = useState(0);
  const editor = useRef<EditorHandle>(null),
    search = useRef<HTMLInputElement>(null),
    workspaceRef = useRef(workspace),
    currentRef = useRef(current),
    booted = useRef(false);
  workspaceRef.current = workspace;
  currentRef.current = current;
  const notify = useCallback(() => render((x) => x + 1), []);
  const entry: Entry | undefined =
    workspace && current ? workspace.entries.get(current) : undefined;
  const storage = workspace?.storage;
  const putImage = useCallback(
    (blob: Blob) => {
      if (!storage) return Promise.reject(new Error("저장소가 없습니다."));
      return storage.putImage(blob);
    },
    [storage],
  );
  const readImage = useCallback(
    (path: string) => {
      if (!storage) return Promise.reject(new Error("저장소가 없습니다."));
      return storage.readImage(path);
    },
    [storage],
  );
  useEffect(() => {
    setImageStatus(null);
  }, [current, workspace]);
  const revealChrome = useCallback(() => setChromeIntent("clear"), []);
  useEffect(() => {
    setChromeIntent("clear");
    setEditorMenu(false);
  }, [current, workspace, focus]);
  useEffect(() => {
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
      setChromeIntent((intent) => (intent === "typing" ? "pointer" : intent));
    window.addEventListener("pointermove", revealFromPointer);
    window.addEventListener("pointerdown", revealFromPointer);
    window.addEventListener("touchstart", revealFromPointer, { passive: true });
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
  }, [revealChrome]);
  async function refresh(w = workspace) {
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
  useEffect(() => {
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
  }, []);
  useEffect(() => {
    if (!workspace || !current) return;
    try {
      localStorage.setItem("granite.active." + workspace.storage.id, current);
    } catch (e) {
      setError(errorText(e));
    }
  }, [workspace, current]);
  useEffect(() => {
    if (!workspace || !current || !entry || entry.status !== "dirty") return;
    const timer = setTimeout(
      () =>
        void workspace
          .flush(current)
          .then(() => refresh(workspace))
          .catch((e) => setError(errorText(e))),
      650,
    );
    return () => clearTimeout(timer);
  }, [revision, current, workspace]);
  useEffect(() => {
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
        if (workspaceRef.current && currentRef.current)
          void workspaceRef.current.flush(currentRef.current);
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
  }, []);
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
    if (!workspace || busy) return;
    setBusy(true);
    try {
      if (current) await workspace.flush(current);
      const latest = await workspace.storage.read(note.filename);
      workspace.load(latest);
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
    if (busy) return;
    const existing = notes.find((n) => n.title === title);
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
    if (!modal || !workspace || busy) return;
    setBusy(true);
    setModalError("");
    try {
      if (modal.kind === "reload") {
        if (current) await workspace.reload(current);
        await refresh();
        setModal(null);
        return;
      }
      const title = modal.title.trim();
      if (!title) throw Error("제목을 입력해 주세요.");
      if (current) await workspace.flush(current);
      const note = await workspace.storage.create(title, "");
      workspace.load(note);
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
    if (!workspace || busy) return;
    const note = notes.find((n) => n.title === title);
    if (note) {
      await openNote(note);
      return;
    }
    setBusy(true);
    try {
      if (current) await workspace.flush(current);
      const n = await workspace.storage.create(title, "");
      workspace.load(n);
      setCurrent(n.filename);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!entry) return;
    const url = URL.createObjectURL(
      new Blob([entry.body], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.note.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function leave() {
    if (busy) return;
    setBusy(true);
    try {
      if (workspace && current) await workspace.flush(current);
      setWorkspace(null);
      setCurrent(null);
      localStorage.removeItem("granite.lastMode");
      setFolders(await savedFolders().catch(() => []));
    } finally {
      setBusy(false);
    }
  }
  const filtered = notes.filter((n) =>
    (n.title + "\n" + (workspace?.entries.get(n.filename)?.body ?? n.body))
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const graph = useMemo(
    () =>
      projectNoteGraph(
        notes.map((note) => ({
          ...note,
          body: workspace?.entries.get(note.filename)?.body ?? note.body,
        })),
      ),
    [notes, workspace, revision],
  );
  const linked = entry
    ? backlinks(
        notes.map((n) => ({
          ...n,
          body: readFrontmatter(
            workspace?.entries.get(n.filename)?.body ?? n.body,
          ).markdown,
        })),
        entry.note.title,
      )
    : [];
  const others = notes.filter((n) => n.filename !== current);
  const rediscovered = others.length ? others[discovery % others.length] : null;
  const recoveryDrafts =
    entry && workspace
      ? workspace.drafts
          .list(entry.note.filename)
          .filter(
            (draft, index, all) =>
              all.findIndex(
                (d) => d.body === draft.body && d.baseline === draft.baseline,
              ) === index,
          )
      : [];
  const count = entry?.body.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return !workspace ? (
    <div className="welcome">
      <header className="welcome-header">
        <div className="brand">granite</div>
      </header>
      <main className="welcome-main">
        <div className="welcome-copy">
          <h1>나의 노트</h1>
          <p>로컬 폴더의 Markdown 노트를 읽고 씁니다.</p>
          <button
            className="primary start-button"
            onClick={() => void runStart("folder")}
            disabled={loading}
          >
            <FolderOpen size={18} />내 폴더 열기
            <ArrowUpRight size={18} />
          </button>
          <button
            className="demo-button"
            onClick={() => void runStart("demo")}
            disabled={loading}
          >
            데모 둘러보기 <ChevronRight size={16} />
          </button>
          <p className="start-hint">
            폴더의 최상위 .md 파일만 엽니다. 노트는 이 기기에 저장됩니다.
          </p>
          {folders.map((f) => (
            <button
              key={f.id}
              className="reconnect"
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
            </button>
          ))}
          {loading && <p role="status">노트를 여는 중…</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  ) : (
    <div
      className={
        "app-shell" +
        (chromeIntent === "typing" && !selection && !modal && !editorMenu
          ? " typing"
          : "") +
        (chromeIntent === "pointer" ? " pointer-reveal" : "") +
        (focus ? " focus-mode" : "") +
        (connections ? "" : " no-connections")
      }
    >
      <aside className="sidebar">
        <div className="brand">granite</div>
        <button
          className="workspace-switch"
          onClick={() => void leave()}
          disabled={busy}
        >
          <span className="workspace-dot" />
          <span>
            {workspace.storage.kind === "demo"
              ? "데모 노트"
              : workspace.storage.label}
            <small>
              {workspace.storage.kind === "demo"
                ? "브라우저에만 저장되는 체험 공간"
                : "이 기기에 저장"}
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="search-box">
          <Search size={16} />
          <input
            ref={search}
            aria-label="노트 검색"
            placeholder="생각 찾아보기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>
        <button className="new-note" onClick={beginCreate} disabled={busy}>
          <Plus size={17} />새 노트
        </button>
        <nav className="quick-nav" aria-label="빠른 노트">
          <button onClick={() => void daily(localDate())} disabled={busy}>
            <CalendarDays size={17} />
            오늘의 노트<span>{new Date().getDate()}</span>
          </button>
          <button onClick={() => void daily("덤프")} disabled={busy}>
            <Inbox size={17} />
            덤프
          </button>
        </nav>
        <div className="section-label">
          {query ? "검색 결과" : "최근 노트"}
          <span>{filtered.length}</span>
        </div>
        <div className="note-list">
          {filtered.map((n) => (
            <button
              key={n.filename}
              className={
                n.filename === current ? "note-item active" : "note-item"
              }
              onClick={() => void openNote(n)}
              disabled={busy}
            >
              <span className="note-title">
                <BookOpen size={15} />
                {n.title}
              </span>
              {query && (
                <span className="note-excerpt">
                  {(workspace.entries.get(n.filename)?.body ?? n.body)
                    .replace(/[#*`>\[\]]/g, "")
                    .slice(0, 70) || "아직 비어 있는 노트"}
                </span>
              )}
            </button>
          ))}
          {!filtered.length && (
            <p className="empty-small">
              {query
                ? "일치하는 생각이 없어요."
                : "첫 번째 생각을 남겨 보세요."}
            </p>
          )}
        </div>
        <footer className="sidebar-footer">
          <span>
            <span className="online-dot" />{" "}
            {workspace.storage.kind === "demo"
              ? "데모 · 별도 저장소"
              : "로컬 폴더 연결됨"}
          </span>
          <span>{notes.length}개의 노트</span>
        </footer>
      </aside>
      <div className="work-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button focus-toggle"
              title={focus ? "집중 모드 끝내기" : "집중 모드"}
              aria-label={focus ? "집중 모드 끝내기" : "집중 모드"}
              aria-pressed={focus}
              onClick={() => setFocus(!focus)}
            >
              {focus ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <span>나의 노트</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-current">
              {entry?.note.title ?? "첫 번째 노트"}
            </span>
          </div>
          <div className="top-actions">
            {workspace.storage.kind === "demo" && (
              <span className="demo-tag">DEMO</span>
            )}
            <button
              className={"mode-button" + (source ? " selected" : "")}
              onClick={() => setSource(!source)}
              aria-pressed={source}
            >
              <Code2 size={15} />
              {source ? "라이브 프리뷰" : "원문 보기"}
            </button>
            <button
              className="icon-button"
              onClick={() => {
                if (focus || !connections) {
                  setFocus(false);
                  setConnections(true);
                } else setConnections(false);
              }}
              aria-expanded={connections && !focus}
              aria-label={
                connections && !focus ? "연결 패널 접기" : "연결 패널 열기"
              }
              title={
                connections && !focus ? "연결 패널 접기" : "연결 패널 열기"
              }
            >
              {connections && !focus ? (
                <PanelRightClose size={18} />
              ) : (
                <PanelRightOpen size={18} />
              )}
            </button>
          </div>
        </header>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="오류 닫기">
              <X size={15} />
            </button>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
            <button onClick={() => setMessage("")} aria-label="안내 닫기">
              <X size={15} />
            </button>
          </div>
        )}
        <div className="writing-layout">
          <main className="note-pane">
            {entry ? (
              <>
                <div className="note-header">
                  <div className="note-kicker">
                    <div className={"save-state " + entry.status} role="status">
                      {entry.status === "saved" ? (
                        <Check size={13} />
                      ) : entry.status === "saving" ? (
                        <LoaderCircle size={13} className="spin" />
                      ) : (
                        <span className="unsaved-dot" />
                      )}
                      {
                        {
                          saved: "저장 완료",
                          dirty: "미저장",
                          saving: "저장 중…",
                          error: "저장 실패",
                          conflict: "외부 변경 충돌",
                        }[entry.status]
                      }
                    </div>
                  </div>
                  <h1>{entry.note.title}</h1>
                  <NoteProperties
                    key={workspace.storage.id + ":" + current}
                    body={entry.body}
                    locked={busy}
                    onChange={(body) => workspace.edit(current!, body)}
                  />
                  <div className="note-meta">
                    <span>
                      {new Intl.DateTimeFormat("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }).format(entry.note.updated)}
                    </span>
                    <span>·</span>
                    <span>{count}단어</span>
                  </div>
                </div>
                {entry.recovered && (
                  <div className="draft-notice">
                    이전에 저장하지 못한 초안을 복구했습니다.
                    {recoveryDrafts.length > 1 && (
                      <label className="draft-choices">
                        보관된 초안 {recoveryDrafts.length}개
                        <select
                          aria-label="복구할 초안"
                          value={
                            recoveryDrafts.find((d) => d.body === entry.body)
                              ?.owner ?? ""
                          }
                          disabled={busy}
                          onChange={(e) => {
                            setBusy(true);
                            void workspace
                              .restoreDraft(current!, e.target.value)
                              .catch((error) => setError(errorText(error)))
                              .finally(() => setBusy(false));
                          }}
                        >
                          {recoveryDrafts.map((d) => (
                            <option key={d.owner} value={d.owner}>
                              {new Date(d.updated).toLocaleTimeString("ko-KR")}{" "}
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
                {entry.error && (
                  <div className="save-error" role="alert">
                    <TriangleAlert size={17} />
                    <div>
                      <strong>
                        {entry.status === "conflict"
                          ? "원본과 초안이 달라졌습니다."
                          : "저장을 마치지 못했습니다."}
                      </strong>
                      <p>
                        {entry.error} 편집한 내용은 이 브라우저에 보관합니다.
                      </p>
                      <div className="recovery-actions">
                        <button
                          onClick={() =>
                            void workspace.flush(current!).then(() => refresh())
                          }
                          disabled={busy || entry.status === "conflict"}
                        >
                          다시 저장
                        </button>
                        <button onClick={download}>
                          <Download size={14} />
                          초안 다운로드
                        </button>
                        <button
                          onClick={() => {
                            setModalError("");
                            setModal({ kind: "reload", title: "" });
                          }}
                        >
                          디스크 내용 다시 읽기
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <Editor
                  key={workspace.storage.id + ":" + current}
                  documentKey={workspace.storage.id + ":" + current}
                  onPasteImage={putImage}
                  readImage={readImage}
                  onImageStatus={setImageStatus}
                  ref={editor}
                  value={entry.body}
                  source={source}
                  locked={busy}
                  titles={notes.map((n) => n.title)}
                  onChange={(body) => workspace.edit(current!, body)}
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
                {imageStatus && (
                  <p
                    className={
                      imageStatus.error ? "image-status error" : "image-status"
                    }
                    role={imageStatus.error ? "alert" : "status"}
                  >
                    {imageStatus.message}
                  </p>
                )}
                <div className="editor-hint">
                  [[ 로 노트 연결 <span>·</span> @ 로 날짜와 노트 찾기{" "}
                  <span>·</span> 링크 클릭으로 편집 · ⌘/Ctrl+클릭으로 열기
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h1>노트가 없습니다</h1>
                <p>새 노트를 만들거나 오늘의 노트를 여세요.</p>
                <button className="primary" onClick={beginCreate}>
                  <Plus size={17} />새 노트
                </button>
              </div>
            )}
          </main>
          {connections && (
            <aside className="connections">
              <div className="connection-heading">
                <Link2 size={16} />
                <h2>연결된 생각</h2>
              </div>
              {current && (
                <NoteGraph
                  graph={graph}
                  current={current}
                  onOpen={openTitle}
                  locked={busy}
                />
              )}
              <div className="backlink-heading">
                이 노트를 언급한 곳<span>{linked.length}</span>
              </div>
              {linked.length ? (
                linked.map((n, i) => (
                  <button
                    className="backlink-card"
                    key={n.filename + i}
                    onClick={() =>
                      void openNote(
                        notes.find((x) => x.filename === n.filename)!,
                      )
                    }
                    disabled={busy}
                  >
                    <span>
                      <BookOpen size={14} />
                      {n.title}
                    </span>
                    <p>{n.context}</p>
                    <small>
                      이 노트로 이어지는 연결 <ArrowUpRight size={12} />
                    </small>
                  </button>
                ))
              ) : (
                <p className="connection-empty">
                  이 노트를 언급한 노트가 없습니다.
                </p>
              )}
              <div className="rediscover">
                <div className="connection-heading">
                  <Compass size={16} />
                  <h2>다시 발견</h2>
                  <button
                    className="icon-button"
                    onClick={() => setDiscovery((x) => x + 1)}
                    aria-label="다른 노트 발견"
                    disabled={others.length < 2}
                  >
                    <Shuffle size={14} />
                  </button>
                </div>
                {rediscovered ? (
                  <button
                    className="rediscovery-card"
                    onClick={() => void openNote(rediscovered)}
                    disabled={busy}
                  >
                    <h3>{rediscovered.title}</h3>
                    <p>
                      {rediscovered.body
                        .replace(/[#*`>\[\]]/g, "")
                        .slice(0, 110)}
                    </p>
                  </button>
                ) : (
                  <p className="connection-empty">다른 노트가 없습니다.</p>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
      {modal && (
        <Dialog
          title={
            modal.kind === "reload"
              ? "디스크 내용을 다시 읽을까요?"
              : modal.missing
                ? "아직 없는 노트예요"
                : "새 노트"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal.kind === "reload" ? (
            <>
              <p>
                현재 편집 중인 초안은 지워집니다. 필요하다면 먼저 다운로드해
                보관하세요.
              </p>
              <div className="dialog-actions">
                <button onClick={() => setModal(null)} disabled={busy}>
                  취소
                </button>
                <button
                  className="primary"
                  onClick={() => void submitModal()}
                  disabled={busy}
                >
                  초안 버리고 다시 읽기
                </button>
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
                {modal.missing
                  ? "이 제목으로 노트를 만들어 연결을 이어 가세요."
                  : "이름을 붙이고 생각을 시작해 보세요."}
              </p>
              <label htmlFor="note-title">새 노트 제목</label>
              <input
                id="note-title"
                value={modal.title}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
                placeholder="어떤 생각인가요?"
                disabled={busy}
              />
              <p className="field-hint">만든 후에는 제목을 바꿀 수 없습니다.</p>
              {modalError && (
                <p className="error" role="alert">
                  {modalError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  취소
                </button>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "저장 중…" : "만들기"}
                </button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </div>
  );
}
