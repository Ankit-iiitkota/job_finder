import Link from "next/link";
import { auth, signIn } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          AI Job Finder
        </h1>
        <p className="mx-auto max-w-xl text-lg text-zinc-500 dark:text-zinc-400">
          Upload your resume once. We find fresh jobs, tailor your resume for
          each one, reach the recruiter&apos;s inbox, and follow up — automatically.
        </p>
      </div>

      {session?.user ? (
        <Link
          href="/profile"
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to your profile →
        </Link>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/profile" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continue with Google
          </button>
        </form>
      )}

      <p className="max-w-md text-sm text-zinc-400 dark:text-zinc-500">
        Google sign-in also connects your Gmail so applications are sent from
        your own inbox — nothing is ever sent without your approval.
      </p>
    </main>
  );
}
