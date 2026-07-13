import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { looseUrl } from "@/lib/zod-helpers";
import { SendMode } from "@/generated/prisma/client";

/** Profile read/update service — thin routes call these (AGENTS.md conventions). */

export const profileUpdateSchema = z.object({
  targetRoles: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  locations: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  remoteOnly: z.boolean().optional(),
  portfolioUrl: looseUrl().nullable().optional(),
  githubUrl: looseUrl().nullable().optional(),
  linkedinUrl: looseUrl().nullable().optional(),
  // user-level outreach preferences
  sendMode: z.enum(SendMode).optional(),
  dailyEmailCap: z.number().int().min(1).max(50).optional(),
  // Telegram notifications (FEATURES.md upgrade F8) — empty string clears it
  telegramChatId: z.string().trim().max(40).nullable().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

const USER_SELECT = {
  email: true,
  name: true,
  sendMode: true,
  dailyEmailCap: true,
  telegramChatId: true,
  profile: true,
} as const;

export async function getProfileWithPrefs(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return user;
}

export async function updateProfile(userId: string, input: ProfileUpdate) {
  const { sendMode, dailyEmailCap, telegramChatId, ...profileFields } = input;

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
        ...(telegramChatId !== undefined && { telegramChatId: telegramChatId || null }),
      },
      select: USER_SELECT,
    }),
  ]);

  return user;
}
