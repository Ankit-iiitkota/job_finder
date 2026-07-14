"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { readError } from "@/lib/read-error";

export function ApplyButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setState("busy");
    setError(null);
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!response.ok) {
      setError(await readError(response));
      setState("error");
      return;
    }
    const application = (await response.json()) as { id: string };
    router.push(`/applications/${application.id}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.button
        onClick={() => void apply()}
        disabled={state === "busy"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {state === "busy" ? "Applying…" : "Apply"}
      </motion.button>
      {error && <p className="max-w-[220px] text-right text-xs text-red-500">{error}</p>}
    </div>
  );
}
