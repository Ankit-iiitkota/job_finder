import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { SendMode } from "@/generated/prisma/client";

/** Profile read/update service — thin routes call these (AGENTS.md conventions). */

export const profileUpdateSchema = z.object({
  targetRoles: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  locations: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  remoteOnly: z.boolean().optional(),
  portfolioUrl: z.url().nullable().optional(),
  githubUrl: z.url().nullable().optional(),
  linkedinUrl: z.url().nullable().optional(),
  // user-level outreach preferences
  sendMode: z.enum(SendMode).optional(),
  dailyEmailCap: z.number().int().min(1).max(50).optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export async function getProfileWithPrefs(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      sendMode: true,
      dailyEmailCap: true,
      profile: true,
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return user;
}

export async function updateProfile(userId: string, input: ProfileUpdate) {
  const { sendMode, dailyEmailCap, ...profileFields } = input;

  const [, user] = await db.$transaction([
    db.profile.upsert({
      where: { userId },
      create: { userId, ...profileFields },
      update: profileFields,
    }),
    db.user.update({
      where: { id: userId },
      data: {
        ...(sendMode && { sendMode }),
        ...(dailyEmailCap && { dailyEmailCap }),
      },
      select: {
        email: true,
        name: true,
        sendMode: true,
        dailyEmailCap: true,
        profile: true,
      },
    }),
  ]);

  return user;
}
