"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { AiAssistant } from "@/components/ai-assistant";
import { renderMarkdownClient } from "@/lib/markdown-client";

type InitialPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  published: boolean;
  slug: string;
};

type Props =
  | { mode: "create"; csrf: string; initial?: never }
  | { mode: "edit"; csrf: string; initial: InitialPost };

type Pane = "write" | "preview" | "split";

type DraftSnapshot = {
  title: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  savedAt: number;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;
const DRAFT_STORAGE_PREFIX = "vainie:draft:";

function draftKey(props: Props): string {
  return props.mode === "edit"
    ? `${DRAFT_STORAGE_PREFIX}${props.initial.id}`
    : `${DRAFT_STORAGE_PREFIX}new`;
}

function loadDraft(key: string): DraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSnapshot;
    if (typeof parsed?.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(key: string, snap: DraftSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snap));
  } catch {
    /* quota or private mode — ignore */
  }
}

function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function snapshotsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return (
    a.title === b.title &&
    a.excerpt === b.excerpt &&
    a.content === b.content &&
    a.coverUrl === b.coverUrl
  );
}

function formatRelative(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ms).toLocaleDateString("en-GB");
}

export function PostEditor(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initial : null;
  const key = useMemo(() => draftKey(props), [props]);

  const serverSnapshot: DraftSnapshot = useMemo(
    () => ({
      title: initial?.title ?? "",
      excerpt: initial?.excerpt ?? "",
      content: initial?.content ?? "",
      coverUrl: initial?.coverUrl ?? "",
      savedAt: 0,
    }),
    [initial],
  );

  const [title, setTitle] = useState(serverSnapshot.title);
  const [excerpt, setExcerpt] = useState(serverSnapshot.excerpt);
  const [content, setContent] = useState(serverSnapshot.content);
  const [coverUrl, setCoverUrl] = useState(serverSnapshot.coverUrl);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pane, setPane] = useState<Pane>("write");
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [restoredBanner, setRestoredBanner] = useState<DraftSnapshot | null>(null);
  const [, forceTick] = useState(0); // for relative-time re-render
  const [titleError, setTitleError] = useState<string | null>(null);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef<DraftSnapshot>(serverSnapshot);
  const lastSavedRef = useRef<DraftSnapshot>(serverSnapshot);

  // update latest snapshot ref on every change for autosave
  useEffect(() => {
    latestRef.current = {
      title,
      excerpt,
      content,
      coverUrl,
      savedAt: Date.now(),
    };
  }, [title, excerpt, content, coverUrl]);

  // offer to restore a newer local draft on mount
  useEffect(() => {
    const stored = loadDraft(key);
    if (!stored) return;
    if (snapshotsEqual(stored, serverSnapshot)) {
      // local == server, nothing to restore; keep timestamp display if we have one
      setDraftSavedAt(stored.savedAt);
      lastSavedRef.current = stored;
      return;
    }
    // local differs from server — offer restore
    setRestoredBanner(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave to localStorage, debounced
  useEffect(() => {
    const snap = latestRef.current;
    if (snapshotsEqual(snap, lastSavedRef.current)) return;
    const h = window.setTimeout(() => {
      saveDraft(key, snap);
      lastSavedRef.current = snap;
      setDraftSavedAt(snap.savedAt);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(h);
  }, [title, excerpt, content, coverUrl, key]);

  // tick every 20s to refresh relative-time labels
  useEffect(() => {
    const h = window.setInterval(() => forceTick((n) => n + 1), 20_000);
    return () => window.clearInterval(h);
  }, []);

  // warn on navigation if unsaved to server
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const snap = latestRef.current;
      if (!snapshotsEqual(snap, serverSnapshot)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [serverSnapshot]);

  // ctrl/cmd+s = save draft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!busy && title.trim() && content.trim()) save(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, title, content]);

  // ---------- upload ----------

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("csrf", props.csrf);
      setUploadBusy(true);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "upload failed");
        }
        const j = (await res.json()) as { url: string };
        return j.url;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "upload failed";
        toast.error(msg);
        return null;
      } finally {
        setUploadBusy(false);
      }
    },
    [props.csrf, toast],
  );

  const onImageInsert = useCallback(
    async (file: File) => {
      const url = await upload(file);
      if (!url) return;
      const insertion = `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n\n`;
      const ta = contentRef.current;
      if (ta) {
        const start = ta.selectionStart ?? content.length;
        const end = ta.selectionEnd ?? start;
        const next = content.slice(0, start) + insertion + content.slice(end);
        setContent(next);
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(
            start + insertion.length,
            start + insertion.length,
          );
        });
      } else {
        setContent(content + insertion);
      }
    },
    [content, upload],
  );

  const onCoverPicked = useCallback(
    async (file: File) => {
      const url = await upload(file);
      if (url) {
        setCoverUrl(url);
        toast.success("cover uploaded");
      }
    },
    [upload, toast],
  );

  // ---------- toolbar actions ----------

  function wrapSelection(before: string, after = before, placeholder = "") {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = content.slice(start, end) || placeholder;
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }

  function insertLinePrefix(prefix: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + prefix.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function insertLink() {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = content.slice(start, end) || "link text";
    const insertion = `[${selected}](https://)`;
    const next = content.slice(0, start) + insertion + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      // select the URL portion for easy paste
      const urlStart = start + selected.length + 3;
      ta.setSelectionRange(urlStart, urlStart + 8);
    });
  }

  // ---------- save ----------

  async function save(publish: boolean) {
    setTitleError(null);
    if (!title.trim()) {
      setTitleError("title is required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        title,
        excerpt,
        content,
        coverUrl,
        publish,
        csrf: props.csrf,
      };
      const url = isEdit ? `/api/posts/${initial!.id}` : "/api/posts";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error(
            j.error ??
              "a post with that slug already exists. try a different title.",
          );
        }
        throw new Error(j.error ?? `save failed (${res.status})`);
      }
      const j = (await res.json()) as { slug: string };
      setPublished(publish);
      clearDraft(key); // committed — drop local draft
      lastSavedRef.current = { ...latestRef.current };
      toast.success(publish ? "published" : "draft saved");
      if (publish) {
        router.push(`/blog/${j.slug}`);
      } else {
        router.push("/admin");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!isEdit) return;
    const ok = await confirm({
      title: "delete post?",
      message:
        "this will permanently remove the post, all its comments, and likes. this cannot be undone.",
      confirmLabel: "delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${initial!.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf: props.csrf }),
      });
      if (!res.ok) throw new Error("delete failed");
      clearDraft(key);
      toast.success("post deleted");
      router.push("/admin");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  }

  function restoreLocal() {
    if (!restoredBanner) return;
    setTitle(restoredBanner.title);
    setExcerpt(restoredBanner.excerpt);
    setContent(restoredBanner.content);
    setCoverUrl(restoredBanner.coverUrl);
    setDraftSavedAt(restoredBanner.savedAt);
    lastSavedRef.current = restoredBanner;
    setRestoredBanner(null);
    toast.info("local draft restored");
  }

  function discardLocal() {
    clearDraft(key);
    setDraftSavedAt(null);
    setRestoredBanner(null);
    toast.info("local draft discarded");
  }

  const unsavedToServer = !snapshotsEqual(latestRef.current, serverSnapshot);
  const previewHtml = useMemo(() => renderMarkdownClient(content), [content]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="eyebrow">{isEdit ? "edit post" : "new post"}</div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-subtle">
          {isEdit && (
            <>
              <span className="chip">/blog/{initial!.slug}</span>
              <span className={published ? "chip-accent" : "chip"}>
                {published ? "published" : "draft"}
              </span>
            </>
          )}
          {draftSavedAt && (
            <span
              className="chip"
              title={new Date(draftSavedAt).toLocaleString("en-GB")}
            >
              local · {formatRelative(Date.now() - draftSavedAt)}
            </span>
          )}
          {unsavedToServer && (
            <span className="chip-accent" title="there are unsaved changes on the server">
              unsaved
            </span>
          )}
        </div>
      </div>

      {restoredBanner && (
        <div
          role="status"
          className="border border-default rounded-lg p-4 bg-surface flex flex-wrap items-center gap-3 justify-between"
        >
          <p className="text-sm">
            found a local draft from{" "}
            <b>{formatRelative(Date.now() - restoredBanner.savedAt)}</b>. restore it?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={discardLocal} className="btn-ghost !h-8 !px-3 !text-xs">
              discard
            </button>
            <button type="button" onClick={restoreLocal} className="btn-primary !h-8 !px-3 !text-xs">
              restore
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="post-title" className="sr-only">
          title
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(null);
          }}
          placeholder="title"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "post-title-err" : undefined}
          className="w-full px-0 py-2 bg-transparent border-0 border-b border-default focus:outline-none focus:border-[rgb(var(--accent-light))] text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"
        />
        {titleError && (
          <p
            id="post-title-err"
            role="alert"
            className="text-xs font-mono text-[rgb(220_60_80)] mt-1"
          >
            {titleError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="post-excerpt" className="sr-only">
          excerpt
        </label>
        <input
          id="post-excerpt"
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="short summary / excerpt (optional)"
          maxLength={280}
          className="w-full px-3 h-10 rounded-md border border-default bg-app focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
        />
      </div>

      {/* cover */}
      <div className="border border-default rounded-lg p-4 bg-app">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2">cover image</p>
            {coverUrl ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded border border-default bg-surface">
                  <Image
                    src={coverUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-xs font-mono text-muted truncate flex-1 min-w-0">
                  {coverUrl}
                </span>
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="text-xs text-muted hover:text-[rgb(var(--fg))] shrink-0"
                >
                  remove
                </button>
              </div>
            ) : (
              <p className="text-xs text-subtle">no cover selected.</p>
            )}
          </div>
          <label className="btn-ghost cursor-pointer w-full sm:w-auto">
            {uploadBusy ? "uploading…" : coverUrl ? "replace" : "pick image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCoverPicked(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* content with toolbar + tabs */}
      <div className="border border-default rounded-lg overflow-hidden bg-app">
        <div className="flex items-center justify-between gap-3 px-2 sm:px-4 py-2 border-b border-default bg-surface flex-wrap">
          <div
            role="tablist"
            aria-label="editor mode"
            className="flex gap-1 font-mono text-[11px]"
          >
            {(["write", "split", "preview"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pane === p}
                onClick={() => setPane(p)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  pane === p
                    ? "bg-app text-[rgb(var(--fg))] border border-default"
                    : "text-subtle hover:text-[rgb(var(--fg))]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 flex-wrap">
            <ToolbarButton label="bold" onClick={() => wrapSelection("**", "**", "bold")}>
              <b>B</b>
            </ToolbarButton>
            <ToolbarButton label="italic" onClick={() => wrapSelection("*", "*", "italic")}>
              <i>I</i>
            </ToolbarButton>
            <ToolbarButton label="inline code" onClick={() => wrapSelection("`", "`", "code")}>
              <code className="text-[11px]">{"</>"}</code>
            </ToolbarButton>
            <span className="h-4 w-px bg-default mx-1" aria-hidden />
            <ToolbarButton label="heading 2" onClick={() => insertLinePrefix("## ")}>
              <span className="text-[11px] font-semibold">H2</span>
            </ToolbarButton>
            <ToolbarButton label="bulleted list" onClick={() => insertLinePrefix("- ")}>
              <span className="text-[11px]">• —</span>
            </ToolbarButton>
            <ToolbarButton label="quote" onClick={() => insertLinePrefix("> ")}>
              <span className="text-[11px]">&quot;</span>
            </ToolbarButton>
            <ToolbarButton label="code block" onClick={() => wrapSelection("\n```\n", "\n```\n", "code")}>
              <span className="text-[11px]">{"{ }"}</span>
            </ToolbarButton>
            <ToolbarButton label="link" onClick={insertLink}>
              <span className="text-[11px]">🔗</span>
            </ToolbarButton>
            <span className="h-4 w-px bg-default mx-1" aria-hidden />
            <label className="text-xs font-mono cursor-pointer text-muted hover:text-[rgb(var(--fg))] px-2 py-1 rounded hover:bg-app transition-colors">
              {uploadBusy ? "uploading…" : "+ image"}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImageInsert(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="h-4 w-px bg-default mx-1" aria-hidden />
            <AiAssistant
              csrf={props.csrf}
              getFullText={() => content}
              getSelection={() => {
                const ta = contentRef.current;
                if (!ta) return null;
                const start = ta.selectionStart ?? 0;
                const end = ta.selectionEnd ?? 0;
                if (end <= start) return null;
                return {
                  start,
                  end,
                  text: content.slice(start, end),
                };
              }}
              applyResult={({ output, replaceSelection, start, end }) => {
                if (
                  replaceSelection &&
                  typeof start === "number" &&
                  typeof end === "number"
                ) {
                  const next =
                    content.slice(0, start) + output + content.slice(end);
                  setContent(next);
                  const newEnd = start + output.length;
                  requestAnimationFrame(() => {
                    const ta = contentRef.current;
                    if (ta) {
                      ta.focus();
                      ta.setSelectionRange(newEnd, newEnd);
                    }
                  });
                } else {
                  setContent(output);
                  requestAnimationFrame(() => {
                    const ta = contentRef.current;
                    if (ta) ta.focus();
                  });
                }
                toast.success("ai suggestion applied");
              }}
            />
          </div>
        </div>

        <div
          className={
            pane === "split"
              ? "grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-default"
              : ""
          }
        >
          {(pane === "write" || pane === "split") && (
            <div>
              <label htmlFor="post-content" className="sr-only">
                content (markdown)
              </label>
              <textarea
                id="post-content"
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# heading\n\nwrite in **markdown**. drag and drop images or use the toolbar above.\n\n\`\`\`ts\ncode blocks work too\n\`\`\``}
                rows={22}
                className="w-full px-4 py-3 bg-app font-mono text-sm leading-relaxed focus:outline-none resize-y min-h-[400px]"
                onDrop={async (e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type.startsWith("image/")) {
                    await onImageInsert(f);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              />
            </div>
          )}
          {(pane === "preview" || pane === "split") && (
            <div className="px-4 py-3 min-h-[400px] overflow-auto">
              {content.trim() ? (
                <div
                  className="prose-post"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-subtle text-sm font-mono">
                  preview will appear here.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !title.trim() || !content.trim()}
            onClick={() => save(false)}
            className="btn-ghost disabled:opacity-60"
            title="ctrl/cmd + s"
          >
            save draft
          </button>
          <button
            type="button"
            disabled={busy || !title.trim() || !content.trim()}
            onClick={() => save(true)}
            className="btn-primary disabled:opacity-60"
          >
            {published ? "update & republish" : "publish"}
          </button>
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs font-mono text-muted hover:text-[rgb(220_60_80)]"
          >
            delete post
          </button>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="h-7 min-w-[28px] px-1.5 rounded text-subtle hover:text-[rgb(var(--fg))] hover:bg-app transition-colors font-mono text-xs"
    >
      {children}
    </button>
  );
}
