import { auth } from "@/auth";
import { AppError } from "@/lib/errors";

/**
 * Session guard for API routes / server actions.
 * Throws a typed 401 that apiHandler converts to a clean JSON response.
 */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) {
    throw new AppError("UNAUTHORIZED", "Sign in required");
  }
  return { id: user.id, email: user.email };
}
