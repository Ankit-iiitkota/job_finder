import { readFile } from "node:fs/promises";
import path from "node:path";
import { escapeLatex } from "@/server/latex/escape";
import type { TailoredResume } from "@/types/tailored-resume";

/**
 * TailoredResume JSON → complete .tex document.
 * Layout lives in latex-templates/resume.tex (editable without touching code);
 * this module only fills the %%SLOT%% markers with escaped fragments.
 */
const TEMPLATE_PATH = path.join(process.cwd(), "latex-templates", "resume.tex");

const e = escapeLatex;

function href(url: string, label: string): string {
  // URLs go through \url-safe hyperref; label is escaped normally
  return `\\href{${url.replace(/[%#{}\\]/g, "")}}{${e(label)}}`;
}

function header(r: TailoredResume["resume"]): string {
  const contact = [
    r.email && e(r.email),
    r.phone && e(r.phone),
    r.location && e(r.location),
    r.links.github && href(r.links.github, "GitHub"),
    r.links.linkedin && href(r.links.linkedin, "LinkedIn"),
    r.links.portfolio && href(r.links.portfolio, "Portfolio"),
  ]
    .filter(Boolean)
    .join(" \\;|\\; ");

  return [
    `\\begin{center}`,
    `{\\LARGE\\bfseries ${e(r.name)}}\\\\[2pt]`,
    `{\\large ${e(r.headline)}}\\\\[3pt]`,
    `{\\small ${contact}}`,
    `\\end{center}`,
  ].join("\n");
}

function summary(r: TailoredResume["resume"]): string {
  if (!r.summary) return "";
  return `\\section{Summary}\n${e(r.summary)}`;
}

function skills(r: TailoredResume["resume"]): string {
  if (r.skillGroups.length === 0) return "";
  const rows = r.skillGroups
    .map((g) => `\\textbf{${e(g.label)}:} ${g.skills.map(e).join(", ")}\\\\`)
    .join("\n");
  return `\\section{Skills}\n${rows}`;
}

function experience(r: TailoredResume["resume"]): string {
  if (r.experience.length === 0) return "";
  const entries = r.experience
    .map((job) =>
      [
        `\\textbf{${e(job.role)}} — ${e(job.company)} \\hfill ${e(job.dates)}`,
        `\\begin{itemize}`,
        ...job.bullets.map((b) => `  \\item ${e(b)}`),
        `\\end{itemize}`,
      ].join("\n"),
    )
    .join("\n\\vspace{4pt}\n");
  return `\\section{Experience}\n${entries}`;
}

function projects(r: TailoredResume["resume"]): string {
  if (r.projects.length === 0) return "";
  const entries = r.projects
    .map((p) => {
      const title = p.url
        ? `${href(p.url, p.name)}`
        : `\\textbf{${e(p.name)}}`;
      const tech = p.tech.length > 0 ? ` \\;—\\; \\textit{${p.tech.map(e).join(", ")}}` : "";
      return [
        `\\textbf{${title}}${tech}`,
        `\\begin{itemize}`,
        ...p.bullets.map((b) => `  \\item ${e(b)}`),
        `\\end{itemize}`,
      ].join("\n");
    })
    .join("\n\\vspace{4pt}\n");
  return `\\section{Projects}\n${entries}`;
}

function education(r: TailoredResume["resume"]): string {
  if (r.education.length === 0) return "";
  const rows = r.education
    .map((ed) => {
      const degree = [ed.degree && e(ed.degree), ed.score && `(${e(ed.score)})`]
        .filter(Boolean)
        .join(" ");
      return `\\textbf{${e(ed.institution)}}${degree ? ` — ${degree}` : ""} \\hfill ${ed.years ? e(ed.years) : ""}\\\\`;
    })
    .join("\n");
  return `\\section{Education}\n${rows}`;
}

function certifications(r: TailoredResume["resume"]): string {
  if (r.certifications.length === 0) return "";
  return `\\section{Certifications}\n${r.certifications.map(e).join(" \\;·\\; ")}`;
}

export async function renderResumeTex(tailored: TailoredResume): Promise<string> {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const r = tailored.resume;

  return template
    .replace("%%HEADER%%", header(r))
    .replace("%%SUMMARY%%", summary(r))
    .replace("%%SKILLS%%", skills(r))
    .replace("%%EXPERIENCE%%", experience(r))
    .replace("%%PROJECTS%%", projects(r))
    .replace("%%EDUCATION%%", education(r))
    .replace("%%CERTIFICATIONS%%", certifications(r));
}
