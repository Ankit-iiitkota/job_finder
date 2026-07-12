import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/http";

/**
 * .tex → PDF with two strategies (adapter pattern):
 *  - LOCAL:  Tectonic binary (production path — runs in our Docker service)
 *  - REMOTE: latex.ytotech.com free compile API (dev machines without LaTeX)
 * Selection: LATEX_COMPILER env override, else auto-detect local, else remote.
 */

async function compileWithTectonic(tex: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "resume-"));
  try {
    const texPath = path.join(dir, "resume.tex");
    await writeFile(texPath, tex, "utf8");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("tectonic", ["-X", "compile", texPath], {
        cwd: dir,
        timeout: 60_000,
      });
      let stderr = "";
      proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      proc.on("error", reject);
      proc.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new AppError("INTERNAL", `LaTeX compile failed: ${stderr.slice(-500)}`)),
      );
    });

    return await readFile(path.join(dir, "resume.pdf"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function compileRemote(tex: string): Promise<Buffer> {
  const response = await safeFetch(env.LATEX_REMOTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: "pdflatex",
      resources: [{ main: true, content: tex }],
    }),
    timeoutMs: 90_000, // LaTeX compiles are slow; give the free service room
    retries: 1,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.error({ status: response.status, detail: detail.slice(0, 500) }, "remote latex failed");
    throw new AppError("UPSTREAM_ERROR", "PDF generation failed, please retry");
  }
  return Buffer.from(await response.arrayBuffer());
}

let tectonicAvailable: Promise<boolean> | null = null;

function detectTectonic(): Promise<boolean> {
  tectonicAvailable ??= new Promise((resolve) => {
    const proc = spawn("tectonic", ["--version"]);
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
  return tectonicAvailable;
}

export async function compileLatexToPdf(tex: string): Promise<Buffer> {
  const mode = env.LATEX_COMPILER ?? ((await detectTectonic()) ? "local" : "remote");
  logger.info({ mode }, "compiling resume pdf");
  return mode === "local" ? compileWithTectonic(tex) : compileRemote(tex);
}
