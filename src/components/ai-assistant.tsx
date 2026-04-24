"use client";

import { useEffect, useRef, useState } from "react";

type AiAction = "grammar" | "polish" | "expand" | "shorten" | "rewrite";

const ACTIONS: Array<{ id: AiAction; label: string; desc: string }> = [
  { id: "grammar", label: "fix grammar", desc: "grammar, spelling, typos — keeps voice" },
  { id: "polish", label: "polish", desc: "light flow + clarity cleanup" },
  { id: "expand", label: "expand", desc: "adds 1-2 on-topic sentences" },
  { id: "shorten", label: "shorten", desc: "trims ~30% without losing facts" },
  { id: "rewrite", label: "rewrite", desc: "one rewrite in your voice" },
];

type Props = {
  /** current editor content (used when there is no active selection) */
  getFullText: () => string;
  /** current selection within the editor, or null if no selection */
  getSelection: () => { start: number; end: number; text: string } | null;
  /** apply the AI output: if `replaceSelection` is true, replace selection;
   *  otherwise replace full content */
  applyResult: (params: {
    output: string;
    replaceSelection: boolean;
    start?: number;
    end?: number;
  }) => void;
  csrf: string;
};

type PendingReview = {
  action: AiAction;
  input: string;
  output: string;
  replaceSelection: boolean;
  start?: number;
  end?: number;
  model?: string;
  fallbackCount?: number;
};

export function AiAssistant({
  getFullText,
  getSelection,
  applyResult,
  csrf,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState<PendingReview | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // close menu on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // tiny delay so the opening click doesn't immediately close it
    const t = window.setTimeout(() => {
      window.addEventListener("click", onClick);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  async function run(action: AiAction) {
    setOpen(false);
    setErr(null);

    const sel = getSelection();
    const full = getFullText();
    const useSelection = sel && sel.text.trim().length >= 20;
    const input = useSelection ? sel!.text : full;

    if (!input.trim()) {
      setErr("editor is empty.");
      return;
    }

    // only send context if operating on a selection and full is meaningfully longer
    const context =
      useSelection && full.length > sel!.text.length + 100
        ? full.replace(sel!.text, "[…]")
        : undefined;

    setBusy(action);
    try {
      const res = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: input, context, csrf }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error ?? `ai failed (${res.status})`);
      }
      const output = (j?.text ?? "").toString().trim();
      if (!output) throw new Error("ai returned nothing");
      setReview({
        action,
        input,
        output,
        replaceSelection: Boolean(useSelection),
        start: useSelection ? sel!.start : undefined,
        end: useSelection ? sel!.end : undefined,
        model: typeof j?.model === "string" ? j.model : undefined,
        fallbackCount: typeof j?.fallbackCount === "number" ? j.fallbackCount : 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ai failed");
    } finally {
      setBusy(null);
    }
  }

  function accept() {
    if (!review) return;
    applyResult({
      output: review.output,
      replaceSelection: review.replaceSelection,
      start: review.start,
      end: review.end,
    });
    setReview(null);
  }

  const hasKey = true; // trust the server to tell us if not configured (503)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-7 px-2 rounded text-subtle hover:text-[rgb(var(--fg))] hover:bg-app transition-colors font-mono text-[11px] flex items-center gap-1.5 disabled:opacity-60"
        title="AI writing assistant"
      >
        <span aria-hidden="true">✨</span>
        <span>{busy ? "thinking…" : "ai"}</span>
      </button>

      {open && hasKey && (
        <div
          role="menu"
          className="absolute right-0 top-9 w-64 rounded-md border border-default bg-app shadow-lg py-1 z-50"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest font-mono text-subtle">
            writing assistant
          </p>
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              role="menuitem"
              type="button"
              onClick={() => run(a.id)}
              disabled={busy !== null}
              className="w-full text-left px-3 py-2 hover:bg-surface transition-colors disabled:opacity-60 group"
            >
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-[11px] text-subtle leading-snug mt-0.5">
                {a.desc}
              </p>
            </button>
          ))}
          <p className="px-3 py-2 text-[10px] font-mono text-subtle border-t border-default mt-1">
            operates on selection (≥20 chars) or whole post
          </p>
        </div>
      )}

      {err && (
        <p
          role="alert"
          className="absolute right-0 top-9 w-80 text-[11px] font-mono text-[rgb(220_60_80)] bg-app border border-[rgb(220_60_80)]/40 rounded-md px-3 py-2 shadow z-50"
        >
          {err}
          <button
            type="button"
            onClick={() => setErr(null)}
            className="ml-2 underline underline-offset-2"
          >
            dismiss
          </button>
        </p>
      )}

      {review && (
        <ReviewModal
          review={review}
          onAccept={accept}
          onCancel={() => setReview(null)}
        />
      )}
    </div>
  );
}

function ReviewModal({
  review,
  onAccept,
  onCancel,
}: {
  review: PendingReview;
  onAccept: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-review-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-[rgb(0_0_0/0.45)] backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-app border border-default rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-default flex items-center justify-between gap-3">
          <h2 id="ai-review-title" className="font-semibold tracking-tight">
            review: {review.action}
            {review.replaceSelection && (
              <span className="ml-2 chip !h-5 !text-[10px]">selection</span>
            )}
          </h2>
          <div className="flex items-center gap-2 min-w-0">
            {review.model && (
              <span
                className="font-mono text-[10px] text-subtle truncate max-w-[200px]"
                title={review.model}
              >
                via {review.model}
                {(review.fallbackCount ?? 0) > 0 && (
                  <span className="text-accent-light">
                    {" "}
                    (+{review.fallbackCount} fallback)
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={onCancel}
              aria-label="close"
              className="text-subtle hover:text-[rgb(var(--fg))] font-mono text-sm"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 divide-default md:divide-x flex-1 overflow-hidden">
          <div className="p-5 overflow-auto">
            <p className="eyebrow mb-3">before</p>
            <pre className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-muted">
              {review.input}
            </pre>
          </div>
          <div className="p-5 overflow-auto bg-surface/40">
            <p className="eyebrow mb-3">after</p>
            <pre className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed">
              {review.output}
            </pre>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-default flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            cancel
          </button>
          <button type="button" onClick={onAccept} className="btn-primary">
            apply
          </button>
        </div>
      </div>
    </div>
  );
}
