"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "@/components/reveal";
import { HeroSceneLoader } from "@/components/hero-scene-loader";

const FEATURES = [
  {
    title: "Free job discovery",
    body: "Pulls fresh roles from RemoteOK, Remotive, Arbeitnow, Adzuna, and Hacker News' Who's Hiring — five sources, zero API cost.",
    icon: "🔎",
  },
  {
    title: "AI resume tailoring",
    body: "Rewrites your resume per job description — real ATS scoring, and a fabrication guard that only reorders and rephrases what's actually on your resume.",
    icon: "📄",
  },
  {
    title: "Recruiter emails, for free",
    body: "No Hunter.io, no Apollo. We scrape, learn the company's email pattern, and MX-verify candidates ourselves.",
    icon: "✉️",
  },
  {
    title: "Follow-ups that don't nag",
    body: "Auto-sends a polite bump after 7 days of silence, caps at two, and instantly stops the moment a recruiter replies.",
    icon: "⏱️",
  },
] as const;

const STEPS = [
  { n: "01", title: "Upload your resume", body: "We parse it into a structured profile — nothing is invented, only extracted." },
  { n: "02", title: "Browse matched jobs", body: "Freshest listings first, scored against your actual skills." },
  { n: "03", title: "Tailor & send", body: "One click tailors your resume, finds the recruiter, and drafts a cold email for your approval." },
  { n: "04", title: "Track & follow up", body: "A single dashboard for every application — automated follow-ups included." },
] as const;

const STACK_BADGES = [
  "Next.js 16",
  "Groq (free LLM)",
  "Neon Postgres",
  "n8n automation",
  "Gmail API",
  "Zero paid APIs",
] as const;

export function LandingContent({
  signedIn,
  signInAction,
}: {
  signedIn: boolean;
  signInAction: () => Promise<void>;
}) {
  return (
    <main className="relative overflow-hidden">
      {/* ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.18),transparent)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.25),transparent)]"
      />

      {/* minimal header for signed-out visitors (the authenticated NavBar renders nothing here) */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-semibold tracking-tight">AI Job Finder</span>
        {signedIn ? (
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard →
          </Link>
        ) : (
          <form action={signInAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sign in
            </button>
          </form>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 px-6 pt-10 pb-20 md:grid-cols-2 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <span className="mb-5 inline-block rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Built on entirely free infrastructure
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Job hunting,{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 bg-clip-text text-transparent">
              on autopilot
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-zinc-500 dark:text-zinc-400">
            Upload your resume once. We find fresh jobs, tailor your resume for
            each one, reach the recruiter&apos;s inbox, and follow up —
            automatically.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {signedIn ? (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/dashboard"
                  className="inline-block rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-500/10 transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Go to your dashboard →
                </Link>
              </motion.div>
            ) : (
              <form action={signInAction}>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-500/10 transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Continue with Google
                </motion.button>
              </form>
            )}
          </div>

          <p className="mt-5 max-w-md text-sm text-zinc-400 dark:text-zinc-500">
            Google sign-in also connects your Gmail so applications are sent
            from your own inbox — nothing is ever sent without your approval.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative h-[340px] sm:h-[420px] md:h-[480px]"
        >
          <HeroSceneLoader />
        </motion.div>
      </section>

      {/* Stack badges */}
      <Reveal className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          {STACK_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300"
            >
              {badge}
            </span>
          ))}
        </div>
      </Reveal>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a job search needs — automated
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{feature.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.1}>
              <div>
                <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-3xl font-bold text-transparent">
                  {step.n}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <Reveal className="mx-auto max-w-3xl px-6 pb-28 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop applying manually.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-zinc-500 dark:text-zinc-400">
          Set it up once — the platform finds jobs and reaches out while you focus on interviews.
        </p>
        <div className="mt-8">
          {signedIn ? (
            <motion.div
              className="inline-block"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/dashboard"
                className="inline-block rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to your dashboard →
              </Link>
            </motion.div>
          ) : (
            <form action={signInAction}>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Continue with Google
              </motion.button>
            </form>
          )}
        </div>
      </Reveal>
    </main>
  );
}
