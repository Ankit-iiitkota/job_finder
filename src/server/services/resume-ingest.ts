import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseResume } from "@/lib/ai/resume-parser";
import { newStorageKey, storage } from "@/lib/storage";
import { db } from "@/lib/db";
import type { ParsedResume } from "@/types/resume";

/**
 * Resume ingestion pipeline (FEATURES.md F1):
 *   file → text extraction → LLM parse → store original → upsert profile
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

const SUPPORTED: Record<string, "pdf" | "docx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

async function extractResumeText(buffer: Buffer, kind: "pdf" | "docx"): Promise<string> {
  if (kind === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function ingestResume(
  userId: string,
  file: { bytes: Buffer; mimeType: string },
): Promise<ParsedResume> {
  const kind = SUPPORTED[file.mimeType];
  if (!kind) {
    throw new AppError("BAD_REQUEST", "Only PDF or DOCX resumes are supported");
  }
  if (file.bytes.length > MAX_RESUME_BYTES) {
    throw new AppError("BAD_REQUEST", "Resume must be smaller than 5 MB");
  }

  const text = (await extractResumeText(file.bytes, kind)).trim();
  if (text.length < 200) {
    throw new AppError(
      "BAD_REQUEST",
      "Could not read enough text from the file — is it a scanned image? Please upload a text-based resume",
    );
  }

  const parsed = await parseResume(text);

  const key = newStorageKey("resumes", userId, kind);
  await storage.save(key, file.bytes);

  await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      parsedResume: parsed,
      originalResumeKey: key,
      githubUrl: parsed.links.github,
      linkedinUrl: parsed.links.linkedin,
      portfolioUrl: parsed.links.portfolio,
    },
    update: {
      parsedResume: parsed,
      originalResumeKey: key,
      // links are only auto-filled on first upload; edits belong to the user
    },
  });

  logger.info(
    { userId, skills: parsed.skills.length, experience: parsed.experience.length },
    "resume ingested",
  );
  return parsed;
}
