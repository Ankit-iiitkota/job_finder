import { db } from "@/lib/db";
import { parsedResumeSchema } from "@/types/resume";
import { tailoredResumeSchema } from "@/types/tailored-resume";

/**
 * Skill-gap analysis (FEATURES.md upgrade feature): across every job the
 * user has tailored a resume for, which required/nice-to-have skills keep
 * showing up that the master profile doesn't have? Pure aggregation over
 * data already stored by tailoring (Phase 4) — zero additional AI calls.
 */
export interface SkillGapEntry {
  skill: string;
  missingCount: number;
}

export async function getSkillGap(userId: string): Promise<SkillGapEntry[]> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const master = parsedResumeSchema.safeParse(profile?.parsedResume);
  if (!master.success) return []; // no resume yet — nothing to compare against

  const haveSkills = new Set(master.data.skills.map((s) => s.trim().toLowerCase()));

  const applications = await db.application.findMany({
    where: { userId },
    select: { tailoredResume: true },
  });

  const counts = new Map<string, number>();
  for (const app of applications) {
    if (!app.tailoredResume) continue;
    const tailored = tailoredResumeSchema.safeParse(app.tailoredResume);
    if (!tailored.success) continue;

    // count each missing skill at most once per application (frequency
    // across jobs, not raw mentions within one JD)
    const missingHere = new Set(
      [...tailored.data.jdAnalysis.requiredSkills, ...tailored.data.jdAnalysis.niceToHaveSkills]
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && !haveSkills.has(s)),
    );
    for (const skill of missingHere) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([skill, missingCount]) => ({ skill, missingCount }))
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, 15);
}
