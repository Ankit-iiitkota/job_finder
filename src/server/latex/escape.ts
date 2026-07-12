/**
 * LaTeX escaping — ALL user/LLM-provided text passes through this before
 * entering the .tex document. Unescaped `&` or `%` would break compilation
 * (or worse, inject LaTeX commands).
 *
 * Single-pass replacement: sequential .replace() calls would re-escape the
 * `{}` inserted by the backslash replacement.
 */
const MAP: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escapeLatex(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, (ch) => MAP[ch]);
}
