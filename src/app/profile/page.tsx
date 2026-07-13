import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileWithPrefs } from "@/server/services/profile";
import { parsedResumeSchema } from "@/types/resume";
import { ProfileForm, type ProfileFormData } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const data = await getProfileWithPrefs(session.user.id);
  const parsed = parsedResumeSchema.safeParse(data.profile?.parsedResume);

  const initial: ProfileFormData = {
    name: data.name,
    email: data.email,
    sendMode: data.sendMode,
    dailyEmailCap: data.dailyEmailCap,
    targetRoles: data.profile?.targetRoles ?? [],
    locations: data.profile?.locations ?? [],
    remoteOnly: data.profile?.remoteOnly ?? false,
    portfolioUrl: data.profile?.portfolioUrl ?? null,
    githubUrl: data.profile?.githubUrl ?? null,
    linkedinUrl: data.profile?.linkedinUrl ?? null,
    telegramChatId: data.telegramChatId,
    parsedResume: parsed.success ? parsed.data : null,
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold">Your Profile</h1>
      <ProfileForm initial={initial} />
    </main>
  );
}
