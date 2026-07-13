import Link from "next/link";
import { auth, signOut } from "@/auth";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile", label: "Profile" },
];

/** Server component: reads the session directly, no client fetch needed. */
export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            AI Job Finder
          </Link>
          <div className="flex gap-4 text-sm text-zinc-500">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
