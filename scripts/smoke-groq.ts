/**
 * Smoke test: verify all three AI call sites end-to-end against the real
 * Groq API — parseResume, tailorResume (the heaviest: embeds the full
 * profile + JD in one request, highest risk of exceeding the free-tier TPM
 * cap), and draftOutreach.
 * Usage: npx tsx scripts/smoke-groq.ts
 * Requires GROQ_API_KEY in .env.
 */
import "dotenv/config";
import { parseResume } from "@/lib/ai/resume-parser";
import { tailorResume } from "@/lib/ai/resume-tailor";
import { draftOutreach } from "@/lib/ai/email-drafter";

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

// A realistic, moderately long JD — deliberately not trivially short, since
// this is the call most likely to hit the free-tier TPM ceiling.
const SAMPLE_JD = `
We are looking for a Full-Stack Developer to join our growing engineering team.

Responsibilities:
- Build and maintain responsive web applications using React and TypeScript
- Design and implement RESTful APIs using Node.js and PostgreSQL
- Collaborate with product and design teams to ship features end-to-end
- Write clean, well-tested, maintainable code
- Participate in code reviews and mentor junior engineers
- Optimize application performance and database queries
- Work with CI/CD pipelines and containerized deployments

Requirements:
- 1-3 years of professional experience in full-stack web development
- Strong proficiency in React, TypeScript, and modern JavaScript
- Experience with Node.js and relational databases (PostgreSQL preferred)
- Familiarity with REST API design and authentication patterns
- Experience with Git and collaborative development workflows
- Bachelor's degree in Computer Science or equivalent practical experience

Nice to have:
- Experience with Next.js and server-side rendering
- Familiarity with Prisma or another ORM
- Exposure to cloud platforms (AWS, GCP, or Azure)
- Experience with automated testing frameworks
`.trim();

async function main() {
  const parseStart = Date.now();
  const parsed = await parseResume(SAMPLE_RESUME);
  console.log(`✅ parseResume succeeded in ${Date.now() - parseStart}ms`);

  const tailorStart = Date.now();
  const tailored = await tailorResume(parsed, {
    title: "Full-Stack Developer",
    company: "Acme Corp",
    description: SAMPLE_JD,
  });
  console.log(`✅ tailorResume succeeded in ${Date.now() - tailorStart}ms\n`);

  console.log(`Seniority: ${tailored.jdAnalysis.seniority}`);
  console.log(`Required skills: ${tailored.jdAnalysis.requiredSkills.join(", ")}`);
  console.log(`Tailored headline: ${tailored.resume.headline}`);
  console.log(`Skill groups: ${tailored.resume.skillGroups.length}`);
  console.log(`Experience bullets: ${tailored.resume.experience[0]?.bullets.length ?? 0}`);

  const draftStart = Date.now();
  const draft = await draftOutreach({
    candidate: parsed,
    tailored,
    job: { title: "Full-Stack Developer", company: "Acme Corp" },
    recruiterName: "Priya Sharma",
    links: { portfolio: null, github: "https://github.com/example" },
  });
  console.log(`✅ draftOutreach succeeded in ${Date.now() - draftStart}ms\n`);
  console.log(`Subject: ${draft.email.subject}`);
  console.log(`Body: ${draft.email.body.slice(0, 100)}...`);
  console.log(`LinkedIn note: ${draft.linkedin.connectionNote}`);

  const checks: [string, boolean][] = [
    ["parsed name preserved", parsed.name === "Ankit Kumar"],
    ["no fabricated experience in tailor output", tailored.resume.experience.length === 1],
    [
      "tailored company matches master profile",
      tailored.resume.experience[0]?.company === "Acme Corp",
    ],
    ["JD analysis produced required skills", tailored.jdAnalysis.requiredSkills.length > 0],
    ["skill groups non-empty", tailored.resume.skillGroups.length > 0],
    ["email subject under 60 chars", draft.email.subject.length <= 60],
    ["LinkedIn connection note under 280 chars", draft.linkedin.connectionNote.length <= 280],
    ["email body non-empty", draft.email.body.length > 0],
  ];
  console.log();
  for (const [label, ok] of checks) console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
