import type { TailoredResume } from "@/types/tailored-resume";

/**
 * ATS score estimate (0–100) — FEATURES.md F3.
 *
 * Real ATS systems mostly do (a) keyword matching against the JD and
 * (b) structural parsing. Our LaTeX template already guarantees (b)
 * (single column, standard headings, real text), so the score is:
 *   70% — JD keyword coverage in the tailored resume text
 *   30% — completeness checks (contact info, summary, sections present)
 *
 * Honest and explainable: we return WHICH keywords are covered/missing so
 * the user can see exactly why the score is what it is.
 */

export interface AtsReport {
  score: number;
  keywordCoverage: number; // 0-1
  coveredKeywords: string[];
  missingKeywords: string[];
  checks: { label: string; passed: boolean }[];
}

function resumeToPlainText(resume: TailoredResume["resume"]): string {
  return [
    resume.name,
    resume.headline,
    resume.summary,
    resume.skillGroups.map((g) => `${g.label} ${g.skills.join(" ")}`).join(" "),
    resume.experience
      .map((x) => `${x.role} ${x.company} ${x.bullets.join(" ")}`)
      .join(" "),
    resume.projects.map((p) => `${p.name} ${p.tech.join(" ")} ${p.bullets.join(" ")}`).join(" "),
    resume.education.map((ed) => `${ed.institution} ${ed.degree ?? ""}`).join(" "),
    resume.certifications.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function scoreAts(tailored: TailoredResume): AtsReport {
  const text = resumeToPlainText(tailored.resume);
  const keywords = [...new Set(tailored.jdAnalysis.keywords.map((k) => k.toLowerCase()))];

  const covered: string[] = [];
  const missing: string[] = [];
  for (const keyword of keywords) {
    (text.includes(keyword) ? covered : missing).push(keyword);
  }
  const coverage = keywords.length > 0 ? covered.length / keywords.length : 1;

  const r = tailored.resume;
  const checks = [
    { label: "Contact email present", passed: Boolean(r.email) },
    { label: "Professional headline present", passed: r.headline.length > 0 },
    { label: "Summary present", passed: r.summary.length > 0 },
    { label: "Skills section present", passed: r.skillGroups.length > 0 },
    {
      label: "Experience or projects present",
      passed: r.experience.length > 0 || r.projects.length > 0,
    },
    {
      label: "Bullets are concise (< 220 chars)",
      passed: [...r.experience, ...r.projects].every((x) =>
        x.bullets.every((b) => b.length < 220),
      ),
    },
  ];
  const checksPassed = checks.filter((c) => c.passed).length / checks.length;

  const score = Math.round(coverage * 70 + checksPassed * 30);
  return {
    score,
    keywordCoverage: Number(coverage.toFixed(2)),
    coveredKeywords: covered,
    missingKeywords: missing,
    checks,
  };
}
