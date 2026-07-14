import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { JobSource } from "@/generated/prisma/client";
import { listJobs, listJobsQuerySchema } from "@/server/services/jobs";
import { JobCard } from "@/components/job-card";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const params = await searchParams;
  const query = listJobsQuerySchema.parse({
    q: params.q,
    source: params.source,
    remote: params.remote,
    page: params.page,
  });
  const { jobs, pagination } = await listJobs(query);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Jobs</h1>

      <form className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500">Search</label>
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="react, frontend developer…"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Source</label>
          <select
            name="source"
            defaultValue={query.source ?? ""}
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="">All sources</option>
            {Object.values(JobSource).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="remote" value="true" defaultChecked={query.remote === true} />
          Remote only
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Filter
        </button>
      </form>

      <p className="mb-4 text-sm text-zinc-500">{pagination.total} jobs found</p>

      <div className="space-y-3">
        {jobs.map((job, index) => (
          <JobCard key={job.id} job={job} index={index} />
        ))}

        {jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
            No jobs match these filters yet — try widening the search, or trigger a scan.
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2 text-sm">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ query: { ...params, page: p } }}
              className={`rounded-md px-2.5 py-1 ${
                p === pagination.page
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
