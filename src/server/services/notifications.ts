import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/notify/telegram";

/**
 * Notification dispatch — currently Telegram only; adding a channel means
 * adding an adapter under lib/notify/ and a branch here, same pattern as
 * job sources and storage.
 */
export async function notifyUser(userId: string, text: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(user.telegramChatId, text);
}
