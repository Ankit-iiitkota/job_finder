import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getApplicationDetail } from "@/server/services/application-detail";
import { ApplicationDetailView } from "./application-detail-view";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { id } = await params;
  const application = await getApplicationDetail(session.user.id, id);

  return <ApplicationDetailView initial={application} />;
}
