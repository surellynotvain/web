"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";

type Props = {
  csrf: string;
  initial: {
    username: string;
    email: string;
    allowAiTraining: boolean;
  };
};

export function SettingsForm({ csrf, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [allowAi, setAllowAi] = useState(initial.allowAiTraining);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = allowAi !== initial.allowAiTraining;

  async function savePreferences() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowAiTraining: allowAi, csrf }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "save failed");
      }
      toast.success("preferences saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vainie-export-${initial.username}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("export ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "export failed");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: "delete your account?",
      message:
        "this will permanently remove your account, comments, and likes. this cannot be undone.",
      confirmLabel: "delete forever",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "delete failed");
      }
      toast.success("account deleted. goodbye.");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-10 space-y-8">
      {/* ---- profile read-only ---- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-4">profile</h2>
        <div className="border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
          <Row k="username" v={`@${initial.username}`} />
          <Row k="email" v={initial.email || "— not set"} />
        </div>
      </section>

      {/* ---- ai training toggle ---- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          ai training
        </h2>
        <label
          className="border border-default rounded-xl p-5 bg-app flex items-start gap-4 cursor-pointer hover:bg-surface transition-colors"
        >
          <input
            type="checkbox"
            checked={allowAi}
            onChange={(e) => setAllowAi(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[rgb(var(--accent-light))] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              allow future comments to be used to improve vainie&apos;s writing
              assistant
            </p>
            <p className="text-[12px] text-muted leading-snug mt-1.5">
              applies to comments you post <i>after</i> saving this. each
              comment form also has its own checkbox; either one opting out is
              enough.
            </p>
          </div>
        </label>

        <div className="mt-4 flex items-center gap-3 justify-end">
          {dirty && (
            <span className="font-mono text-[11px] text-subtle">
              unsaved changes
            </span>
          )}
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={savePreferences}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "saving…" : "save"}
          </button>
        </div>
      </section>

      {/* ---- export ---- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          export your data
        </h2>
        <div className="border border-default rounded-xl p-5 bg-app flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted max-w-md leading-relaxed">
            download a JSON file containing your account info, comments, and
            likes. no hashed IPs, no session tokens.
          </p>
          <button
            type="button"
            onClick={exportData}
            disabled={exporting}
            className="btn-ghost disabled:opacity-60"
          >
            {exporting ? "preparing…" : "export (json)"}
          </button>
        </div>
      </section>

      {/* ---- delete ---- */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          danger zone
        </h2>
        <div className="border border-[rgb(220_60_80)]/40 rounded-xl p-5 bg-app flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm max-w-md leading-relaxed">
            <b>delete your account.</b> removes your profile, all comments
            you&apos;ve posted, and all likes. posts you authored (as admin) are
            not affected. not reversible.
          </p>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium text-white transition-colors bg-[rgb(220_60_80)] hover:bg-[rgb(200_50_70)] disabled:opacity-60"
          >
            {deleting ? "deleting…" : "delete account"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 px-4 md:px-5 py-3">
      <p className="font-mono text-[12px] text-subtle">{k}</p>
      <p className="text-sm">{v}</p>
    </div>
  );
}
