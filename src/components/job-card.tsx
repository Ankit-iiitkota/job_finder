"use client";

import { motion } from "framer-motion";
import type { JobListItem } from "@/server/services/jobs";
import { ApplyButton } from "@/components/apply-button";

function timeAgo(date: Date | null): string {
  if (!date) return "date unknown";
  const hours = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function salary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max)!);
}

export function JobCard({ job, index }: { job: JobListItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: "easeOut" }}
      whileHover={{ y: -2, borderColor: "rgba(99,102,241,0.4)" }}
      className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="min-w-0">
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
        >
          {job.title}
        </a>
        <p className="text-sm text-zinc-500">{job.company}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          <span>{job.remote ? "Remote" : job.location ?? "Location unknown"}</span>
          <span>·</span>
          <span>{job.source}</span>
          <span>·</span>
          <span>{timeAgo(job.postedAt)}</span>
          {salary(job.salaryMin, job.salaryMax) && (
            <>
              <span>·</span>
              <span>{salary(job.salaryMin, job.salaryMax)}</span>
            </>
          )}
        </div>
      </div>
      <ApplyButton jobId={job.id} />
    </motion.div>
  );
}
