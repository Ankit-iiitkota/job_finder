import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listApplications } from "@/server/services/applications";
import { StatusBadge } from "@/components/status-badge";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const applications = await listApplications(session.user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        <Link
          href="/jobs"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Find more jobs
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          No applications yet.{" "}
          <Link href="/jobs" className="underline">
            Browse jobs
          </Link>{" "}
          to apply.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-4 py-3 font-medium">ATS</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link href={`/applications/${app.id}`} className="hover:underline">
                      <div className="font-medium">{app.job.title}</div>
                      <div className="text-zinc-500">{app.job.company}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {app.matchScore != null ? `${app.matchScore}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {app.atsScore != null ? `${app.atsScore}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(app.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
