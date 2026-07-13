/**
 * Smoke test: verify the Gemini structured-output pipeline end-to-end
 * against the real API (resume parsing, the simplest of the three AI calls).
 * Usage: npx tsx scripts/smoke-gemini.ts
 * Requires GEMINI_API_KEY in .env.
 */
import "dotenv/config";
import { parseResume } from "@/lib/ai/resume-parser";

const SAMPLE_RESUME = `
Ankit Kumar
Full-Stack Developer
ankit@example.com | +91 98765 43210 | Kota, India
GitHub: github.com/example | LinkedIn: linkedin.com/in/example

SUMMARY
Full-stack developer with 1 year of experience building React and Node.js
applications, focused on clean, maintainable code.

SKILLS
JavaScript, TypeScript, React, Next.js, Node.js, PostgreSQL, Prisma, Tailwind CSS, Git

EXPERIENCE
Software Developer Intern — Acme Corp (Jun 2025 – Present)
- Built React dashboards used by 500+ internal users, cutting report time by 40%
- Designed REST APIs with Node.js and PostgreSQL handling 10k requests/day

PROJECTS
AI Job Finder — github.com/example/job-finder
- Automated job-application platform using Next.js, Prisma, and n8n
- Tech: Next.js, TypeScript, Prisma, PostgreSQL

EDUCATION
IIIT Kota — B.Tech, Computer Science (2022 – 2026), CGPA 8.5

CERTIFICATIONS
AWS Cloud Practitioner
`.trim();

async function main() {
  const started = Date.now();
  const parsed = await parseResume(SAMPLE_RESUME);
  const ms = Date.now() - started;

  console.log(`✅ Gemini structured output round-trip succeeded in ${ms}ms\n`);
  console.log(`Name: ${parsed.name}`);
  console.log(`Headline: ${parsed.headline}`);
  console.log(`Skills (${parsed.skills.length}): ${parsed.skills.join(", ")}`);
  console.log(`Experience entries: ${parsed.experience.length}`);
  console.log(`Projects: ${parsed.projects.length}`);
  console.log(`Education: ${parsed.education.length}`);
  console.log(`GitHub link extracted: ${parsed.links.github}`);

  // sanity checks — this is EXTRACTION, values must come from the input verbatim
  const checks: [string, boolean][] = [
    ["name extracted", parsed.name === "Ankit Kumar"],
    ["skills non-empty", parsed.skills.length > 0],
    ["no fabricated experience (exactly 1 entry)", parsed.experience.length === 1],
    ["github link captured", parsed.links.github?.includes("github.com/example") ?? false],
  ];
  console.log();
  for (const [label, ok] of checks) console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
