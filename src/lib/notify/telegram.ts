import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/http";

/**
 * Telegram Bot API notifier (FEATURES.md upgrade F8) — free, zero
 * dependency (raw REST, same posture as the Gmail client in lib/gmail.ts).
 *
 * Setup: message @BotFather → /newbot → copy the token into
 * TELEGRAM_BOT_TOKEN. Each user finds their own chat id by messaging the
 * bot once, then GET api.telegram.org/bot<token>/getUpdates, and pastes it
 * into their profile settings.
 *
 * Silently no-ops when unconfigured — notifications are a nice-to-have and
 * must never fail or block a core flow (reply detection, follow-ups, etc).
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  try {
    const response = await safeFetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        timeoutMs: 8_000,
        retries: 1,
      },
    );
    if (!response.ok) {
      logger.warn({ status: response.status }, "telegram notification failed");
    }
  } catch (error) {
    logger.warn({ err: error }, "telegram notification failed");
  }
}
