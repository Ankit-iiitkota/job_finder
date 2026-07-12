import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage behind a tiny interface — local disk today, S3/Supabase later
 * by swapping the implementation (adapter pattern, AGENTS.md conventions).
 * Keys look like: "resumes/<userId>/<uuid>.pdf"
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}

const BASE_DIR = path.join(process.cwd(), "var", "uploads");

function resolveSafe(key: string): string {
  const full = path.resolve(BASE_DIR, key);
  // path-traversal guard: a malicious key must never escape the upload dir
  if (!full.startsWith(path.resolve(BASE_DIR) + path.sep)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return full;
}

export const storage: FileStorage = {
  async save(key, data) {
    const full = resolveSafe(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  async read(key) {
    return readFile(resolveSafe(key));
  },
};

export function newStorageKey(prefix: string, userId: string, ext: string): string {
  return `${prefix}/${userId}/${randomUUID()}.${ext}`;
}
