"use client";

import { useState } from "react";
import type { ParsedResume } from "@/types/resume";
import { readError } from "@/lib/read-error";

export interface ProfileFormData {
  name: string | null;
  email: string;
  sendMode: "APPROVAL" | "AUTO";
  dailyEmailCap: number;
  targetRoles: string[];
  locations: string[];
  remoteOnly: boolean;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  telegramChatId: string | null;
  parsedResume: ParsedResume | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";
const labelClass = "mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300";

export function ProfileForm({ initial }: { initial: ProfileFormData }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function uploadResume(file: File) {
    setStatus({ kind: "busy", message: "Reading and parsing your resume with AI…" });
    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/resume", { method: "POST", body });
    if (!response.ok) {
      setStatus({ kind: "error", message: await readError(response) });
      return;
    }
    const { parsed } = (await response.json()) as { parsed: ParsedResume };
    setForm((f) => ({
      ...f,
      parsedResume: parsed,
      githubUrl: f.githubUrl ?? parsed.links.github,
      linkedinUrl: f.linkedinUrl ?? parsed.links.linkedin,
      portfolioUrl: f.portfolioUrl ?? parsed.links.portfolio,
    }));
    setStatus({ kind: "ok", message: "Resume parsed — review the details below and save." });
  }

  async function save() {
    setStatus({ kind: "busy", message: "Saving…" });
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRoles: form.targetRoles,
        locations: form.locations,
        remoteOnly: form.remoteOnly,
        portfolioUrl: form.portfolioUrl || null,
        githubUrl: form.githubUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        sendMode: form.sendMode,
        dailyEmailCap: form.dailyEmailCap,
        telegramChatId: form.telegramChatId || null,
      }),
    });
    setStatus(
      response.ok
        ? { kind: "ok", message: "Profile saved." }
        : { kind: "error", message: await readError(response) },
    );
  }

  const parsed = form.parsedResume;

  return (
    <div className="space-y-10">
      {/* ---- Resume upload ---- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-1 text-lg font-semibold">Resume</h2>
        <p className="mb-4 text-sm text-zinc-500">
          PDF or DOCX, max 5 MB. We extract your skills and experience — nothing
          is ever invented on your behalf.
        </p>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={status.kind === "busy"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadResume(file);
          }}
          className="block text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-white dark:file:text-zinc-900"
        />

        {parsed && (
          <div className="mt-6 space-y-3 text-sm">
            <p>
              <span className="font-medium">{parsed.name ?? form.name}</span>
              {parsed.headline && (
                <span className="text-zinc-500"> — {parsed.headline}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.skills.slice(0, 20).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs dark:bg-zinc-800"
                >
                  {skill}
                </span>
              ))}
              {parsed.skills.length > 20 && (
                <span className="text-xs text-zinc-400">
                  +{parsed.skills.length - 20} more
                </span>
              )}
            </div>
            <p className="text-zinc-500">
              {parsed.experience.length} experience entries ·{" "}
              {parsed.projects.length} projects · {parsed.education.length} education
            </p>
          </div>
        )}
      </section>

      {/* ---- Job preferences ---- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Job preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Target roles (comma-separated — used to search jobs)
            </label>
            <input
              className={inputClass}
              placeholder="frontend developer, react, full stack"
              value={form.targetRoles.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  targetRoles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Preferred locations</label>
            <input
              className={inputClass}
              placeholder="Bangalore, Remote"
              value={form.locations.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  locations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.remoteOnly}
              onChange={(e) => setForm({ ...form, remoteOnly: e.target.checked })}
            />
            Remote jobs only
          </label>
        </div>
      </section>

      {/* ---- Links ---- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Links (included in cold emails)</h2>
        <div className="grid gap-4">
          {(
            [
              ["githubUrl", "GitHub"],
              ["portfolioUrl", "Portfolio"],
              ["linkedinUrl", "LinkedIn"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                className={inputClass}
                placeholder={`https://…`}
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ---- Outreach settings ---- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Outreach settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Sending mode</label>
            <select
              className={inputClass}
              value={form.sendMode}
              onChange={(e) =>
                setForm({ ...form, sendMode: e.target.value as "APPROVAL" | "AUTO" })
              }
            >
              <option value="APPROVAL">Approval — I review every email</option>
              <option value="AUTO">Auto — send without asking</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Daily email cap (protects your Gmail)</label>
            <input
              type="number"
              min={1}
              max={50}
              className={inputClass}
              value={form.dailyEmailCap}
              onChange={(e) =>
                setForm({ ...form, dailyEmailCap: Number(e.target.value) || 1 })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Telegram chat ID (optional — get notified when a recruiter replies)
            </label>
            <input
              className={inputClass}
              placeholder="message @BotFather to set up a bot, then paste your chat id"
              value={form.telegramChatId ?? ""}
              onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* ---- Save ---- */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => void save()}
          disabled={status.kind === "busy"}
          className="rounded-lg bg-zinc-900 px-6 py-2.5 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Save profile
        </button>
        {status.kind !== "idle" && (
          <p
            className={
              status.kind === "error"
                ? "text-sm text-red-500"
                : "text-sm text-zinc-500"
            }
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
