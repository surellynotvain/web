"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";

export function AdminPostRowActions({
  postId,
  csrf,
}: {
  postId: string;
  csrf: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "delete post?",
      message: "this cannot be undone.",
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
      if (!res.ok) throw new Error();
      toast.success("post deleted");
      router.refresh();
    } catch {
      toast.error("delete failed");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label="delete post"
      className="text-[11px] font-mono text-subtle hover:text-[rgb(220_60_80)] disabled:opacity-50 transition-colors px-2 py-1"
      title="delete post"
    >
      {busy ? "…" : "×"}
    </button>
  );
}
