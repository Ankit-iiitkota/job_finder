"use client";

import { motion } from "framer-motion";

export function StatCard({
  label,
  value,
  hint,
  index = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** stagger position within its grid — each card enters slightly after the previous */
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </motion.div>
  );
}
