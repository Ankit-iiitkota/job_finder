/**
 * Smoke test: render a sample tailored resume to .tex and compile to PDF.
 * Usage: npx tsx scripts/smoke-latex.ts
 * Verifies the template, escaping, renderer, and the compiler (remote
 * fallback on machines without Tectonic).
 */
import "dotenv/config"; // tsx doesn't auto-load .env the way Next.js does
import { writeFile } from "node:fs/promises";
import { renderResumeTex } from "@/server/latex/render-resume";
import { compileLatexToPdf } from "@/server/latex/compile";
import type { TailoredResume } from "@/types/tailored-resume";

const sample: TailoredResume = {
  jdAnalysis: {
    requiredSkills: ["react", "typescript"],
    niceToHaveSkills: ["next.js"],
    keywords: ["react", "typescript", "rest api", "ci/cd"],
    seniority: "junior",
    roleFocus: "Frontend product engineering",
  },
  resume: {
    name: "Ankit Kumar",
    headline: "Full-Stack Developer (React & TypeScript)",
    email: "ankit@example.com",
    phone: "+91 98765 43210",
    location: "Kota, India",
    links: {
      github: "https://github.com/example",
      linkedin: "https://linkedin.com/in/example",
      portfolio: null,
    },
    summary:
      "Full-stack developer with hands-on experience building React + TypeScript apps with REST APIs & CI/CD pipelines. 100% escaping test: $5, C#, a_b, {braces}, ~tilde, 5^2.",
    skillGroups: [
      { label: "Frontend", skills: ["React", "TypeScript", "Next.js", "Tailwind CSS"] },
      { label: "Backend", skills: ["Node.js", "PostgreSQL", "Prisma", "REST APIs"] },
    ],
    experience: [
      {
        company: "Acme Corp",
        role: "Software Developer Intern",
        dates: "Jun 2025 – Present",
        bullets: [
          "Built React dashboards used by 500+ internal users, cutting report time by 40%",
          "Designed REST APIs with Node.js & PostgreSQL handling 10k requests/day",
        ],
      },
    ],
    projects: [
      {
        name: "AI Job Finder",
        tech: ["Next.js", "Prisma", "n8n", "Claude API"],
        bullets: [
          "Automated job-application platform: discovery, resume tailoring (LaTeX), outreach & tracking",
        ],
        url: "https://github.com/Ankit-iiitkota/job_finder",
      },
    ],
    education: [
      {
        institution: "IIIT Kota",
        degree: "B.Tech, Computer Science",
        years: "2022 – 2026",
        score: "8.5 CGPA",
      },
    ],
    certifications: ["AWS Cloud Practitioner"],
  },
};

async function main() {
  const tex = await renderResumeTex(sample);
  console.log(`✅ rendered .tex (${tex.length} chars)`);

  const started = Date.now();
  const pdf = await compileLatexToPdf(tex);
  const isPdf = pdf.subarray(0, 5).toString() === "%PDF-";
  console.log(
    `${isPdf ? "✅" : "❌"} compiled PDF: ${pdf.length} bytes in ${Date.now() - started}ms (magic bytes ${isPdf ? "ok" : "WRONG"})`,
  );

  await writeFile("var/smoke-resume.pdf", pdf);
  console.log("   saved to var/smoke-resume.pdf — open it to inspect layout");
  if (!isPdf) process.exit(1);
}

main();
