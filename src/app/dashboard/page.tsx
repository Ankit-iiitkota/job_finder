import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardStats } from "@/server/services/dashboard";
import { getSkillGap } from "@/server/services/skill-gap";
import { getEmailVariantStats } from "@/server/services/ab-testing";
import { StatCard } from "@/components/stat-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [stats, skillGap, variants] = await Promise.all([
    getDashboardStats(session.user.id),
    getSkillGap(session.user.id),
    getEmailVariantStats(session.user.id),
  ]);
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
        <StatCard index={0} label="Jobs found today" value={stats.jobsFoundToday} hint="across all sources" />
        <StatCard index={1} label="Jobs found this week" value={stats.jobsFoundThisWeek} />
        <StatCard index={2} label="Active applications" value={active} />
        <StatCard index={3} label="Resumes generated" value={stats.resumesGenerated} />
        <StatCard index={4} label="Emails sent" value={stats.emailsSent} />
        <StatCard index={5} label="Replies received" value={stats.repliesReceived} />
        <StatCard
          index={6}
          label="Response rate"
          value={`${Math.round(stats.responseRate * 100)}%`}
          hint={stats.emailsSent === 0 ? "no emails sent yet" : undefined}
        />
        <StatCard index={7} label="LinkedIn messages sent" value={stats.linkedinMessagesCopied} />
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

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {skillGap.length > 0 && (
          <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-1 text-lg font-semibold">Skill gap</h2>
            <p className="mb-4 text-xs text-zinc-500">
              Skills that keep appearing in job descriptions but aren&apos;t on your resume.
            </p>
            <div className="flex flex-wrap gap-2">
              {skillGap.map((s) => (
                <span
                  key={s.skill}
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  {s.skill} <span className="opacity-60">×{s.missingCount}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {variants.length > 0 && (
          <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-1 text-lg font-semibold">Email A/B test</h2>
            <p className="mb-4 text-xs text-zinc-500">
              Reply rate by tone variant — the platform auto-assigns each application a bucket.
            </p>
            <table className="w-full text-sm">
              <tbody>
                {variants.map((v, i) => (
                  <tr key={v.variant} className={i === 0 && v.sent > 0 ? "font-semibold" : ""}>
                    <td className="py-1 capitalize">
                      {v.variant} {i === 0 && v.sent > 0 && "🏆"}
                    </td>
                    <td className="py-1 text-right text-zinc-500">{v.sent} sent</td>
                    <td className="py-1 text-right text-zinc-500">{v.replied} replied</td>
                    <td className="py-1 text-right">{Math.round(v.replyRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
