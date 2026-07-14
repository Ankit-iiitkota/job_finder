import { auth, signIn } from "@/auth";
import { LandingContent } from "./landing-content";

export default async function HomePage() {
  const session = await auth();

  async function signInAction() {
    "use server";
    await signIn("google", { redirectTo: "/profile" });
  }

  return <LandingContent signedIn={!!session?.user} signInAction={signInAction} />;
}
