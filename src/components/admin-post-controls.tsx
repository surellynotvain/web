"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";

export function AdminPostControls({
  postId,
  csrf,
}: {
  postId: string;
  postSlug: string;
  csrf: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const ok = await confirm({
      title: "delete post?",
      message:
        "this will permanently remove the post and all its comments and likes.",
      confirmLabel: "delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf }),
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("post deleted");
      router.push("/blog");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 px-4 py-2.5 border border-default rounded-lg bg-surface/60 text-xs font-mono">
      <span className="text-subtle uppercase tracking-widest">admin</span>
      <span className="text-subtle">·</span>
      <Link href={`/admin/post/${postId}`} className="link-accent">
        edit
      </Link>
      <span className="text-subtle">·</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-subtle hover:text-[rgb(220_60_80)] disabled:opacity-50"
      >
        {busy ? "deleting…" : "delete post"}
      </button>
    </div>
  );
}
