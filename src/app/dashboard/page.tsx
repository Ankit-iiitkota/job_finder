import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardStats } from "@/server/services/dashboard";
import { StatCard } from "@/components/stat-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const stats = await getDashboardStats(session.user.id);
  const active =
    stats.applications.total -
    (stats.applications.byStatus.REJECTED ?? 0) -
    (stats.applications.byStatus.NO_RESPONSE ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-3">
          <Link
            href="/jobs"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Find jobs
          </Link>
          <Link
            href="/applications"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View applications
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Jobs found today" value={stats.jobsFoundToday} hint="across all sources" />
        <StatCard label="Jobs found this week" value={stats.jobsFoundThisWeek} />
        <StatCard label="Active applications" value={active} />
        <StatCard label="Resumes generated" value={stats.resumesGenerated} />
        <StatCard label="Emails sent" value={stats.emailsSent} />
        <StatCard label="Replies received" value={stats.repliesReceived} />
        <StatCard
          label="Response rate"
          value={`${Math.round(stats.responseRate * 100)}%`}
          hint={stats.emailsSent === 0 ? "no emails sent yet" : undefined}
        />
        <StatCard label="LinkedIn messages sent" value={stats.linkedinMessagesCopied} />
      </div>

      {stats.applications.total > 0 && (
        <div className="mt-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Pipeline breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.applications.byStatus).map(([status, count]) => (
              <span
                key={status}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
              >
                {status.replace(/_/g, " ")}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.applications.total === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-zinc-500">
            No applications yet.{" "}
            <Link href="/jobs" className="underline">
              Browse fresh jobs
            </Link>{" "}
            to start your first one.
          </p>
        </div>
      )}
    </main>
  );
}
