import type { ApplicationStatus } from "@/generated/prisma/client";

/** Single source of truth for status label + color across the dashboard. */
const STATUS_META: Record<ApplicationStatus, { label: string; className: string }> = {
  FOUND: { label: "Found", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  RESUME_READY: { label: "Resume ready", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  EMAIL_QUEUED: { label: "Draft ready", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  EMAIL_SENT: { label: "Email sent", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  FOLLOWUP_1: { label: "Follow-up 1 sent", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  FOLLOWUP_2: { label: "Follow-up 2 sent", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  REPLIED: { label: "Replied", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  INTERVIEW: { label: "Interview", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  OFFER: { label: "Offer", className: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  NO_RESPONSE: { label: "No response", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
