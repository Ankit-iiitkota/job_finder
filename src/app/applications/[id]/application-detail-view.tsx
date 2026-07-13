"use client";

import { useState } from "react";
import type { ApplicationDetail } from "@/server/services/application-detail";
import { StatusBadge } from "@/components/status-badge";

interface TailorResult {
  atsScore: number;
  coveredKeywords: string[];
  missingKeywords: string[];
}

interface FindRecruiterResult {
  recruiter: { email: string; confidence: number; method: string; mxVerified: boolean };
  alternates: { email: string; confidence: number; method: string }[];
}

type Busy = null | "tailor" | "recruiter" | "draft" | "send";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

const sectionClass = "rounded-xl border border-zinc-200 p-6 dark:border-zinc-800";
const btnPrimary =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
const btnSecondary =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

function eventLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function ApplicationDetailView({ initial }: { initial: ApplicationDetail }) {
  const [app, setApp] = useState(initial);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [recruiterNameInput, setRecruiterNameInput] = useState("");
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);
  const [alternates, setAlternates] = useState<FindRecruiterResult["alternates"]>([]);
  const [subject, setSubject] = useState(
    app.emails.find((e) => e.type === "COLD")?.subject ?? "",
  );
  const [body, setBody] = useState(app.emails.find((e) => e.type === "COLD")?.body ?? "");

  async function refresh() {
    const response = await fetch(`/api/applications/${app.id}`);
    if (response.ok) setApp((await response.json()) as ApplicationDetail);
  }

  async function run(kind: Exclude<Busy, null>, request: () => Promise<Response>) {
    setBusy(kind);
    setMessage(null);
    const response = await request();
    if (!response.ok) {
      setMessage({ kind: "error", text: await readError(response) });
      setBusy(null);
      return null;
    }
    setBusy(null);
    return response;
  }

  async function tailor() {
    const response = await run("tailor", () =>
      fetch(`/api/applications/${app.id}/tailor`, { method: "POST" }),
    );
    if (!response) return;
    setTailorResult((await response.json()) as TailorResult);
    setMessage({ kind: "ok", text: "Resume tailored." });
    await refresh();
  }

  async function findRecruiter() {
    const response = await run("recruiter", () =>
      fetch(`/api/applications/${app.id}/find-recruiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          recruiterNameInput.trim() ? { recruiterName: recruiterNameInput.trim() } : {},
        ),
      }),
    );
    if (!response) return;
    const result = (await response.json()) as FindRecruiterResult;
    setAlternates(result.alternates);
    setMessage({
      kind: "ok",
      text: `Found ${result.recruiter.email} (${result.recruiter.confidence}% confidence).`,
    });
    await refresh();
  }

  async function draftOutreach() {
    const response = await run("draft", () =>
      fetch(`/api/applications/${app.id}/outreach`, { method: "POST" }),
    );
    if (!response) return;
    await refresh();
    setMessage({ kind: "ok", text: "Outreach drafted — review and send below." });
  }

  async function sendEmail() {
    const response = await run("send", () =>
      fetch(`/api/applications/${app.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      }),
    );
    if (!response) return;
    setMessage({ kind: "ok", text: "Email sent!" });
    await refresh();
  }

  async function copyLinkedIn(text: string) {
    await navigator.clipboard.writeText(text);
    await fetch(`/api/applications/${app.id}/linkedin-copied`, { method: "POST" });
    await refresh();
    setMessage({ kind: "ok", text: "Copied — paste it into LinkedIn." });
  }

  const coldEmail = app.emails.find((e) => e.type === "COLD");

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{app.job.title}</h1>
          <StatusBadge status={app.status} />
        </div>
        <p className="text-zinc-500">
          {app.job.company} · {app.job.remote ? "Remote" : app.job.location ?? "Location unknown"}{" "}
          ·{" "}
          <a href={app.job.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            view posting
          </a>
        </p>
        <div className="mt-2 flex gap-4 text-sm text-zinc-500">
          {app.matchScore != null && <span>Match score: {app.matchScore}%</span>}
          {app.atsScore != null && <span>ATS score: {app.atsScore}%</span>}
        </div>
      </div>

      {message && (
        <p className={message.kind === "error" ? "text-sm text-red-500" : "text-sm text-emerald-600"}>
          {message.text}
        </p>
      )}

      {/* Resume */}
      <section className={sectionClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tailored resume</h2>
          <div className="flex gap-2">
            {app.tailoredResumeKey && (
              <a href={`/api/applications/${app.id}/resume`} className={btnSecondary}>
                Download PDF
              </a>
            )}
            <button onClick={() => void tailor()} disabled={busy === "tailor"} className={btnPrimary}>
              {busy === "tailor" ? "Tailoring…" : app.tailoredResumeKey ? "Re-tailor" : "Tailor resume"}
            </button>
          </div>
        </div>
        {tailorResult && (
          <div className="text-sm">
            <p className="mb-2">
              ATS score: <strong>{tailorResult.atsScore}%</strong>
            </p>
            {tailorResult.missingKeywords.length > 0 && (
              <p className="text-zinc-500">
                Missing keywords: {tailorResult.missingKeywords.join(", ")}
              </p>
            )}
          </div>
        )}
        {!tailorResult && !app.tailoredResumeKey && (
          <p className="text-sm text-zinc-500">Not tailored yet.</p>
        )}
      </section>

      {/* Recruiter */}
      <section className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold">Recruiter contact</h2>
        {app.recruiter ? (
          <div className="mb-3 text-sm">
            <p>
              <strong>{app.recruiter.email}</strong> — {app.recruiter.confidence}% confidence (
              {app.recruiter.method.replace(/_/g, " ").toLowerCase()})
              {app.recruiter.mxVerified && <span className="text-emerald-600"> · MX verified</span>}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-zinc-500">No recruiter found yet.</p>
        )}
        <div className="flex gap-2">
          <input
            value={recruiterNameInput}
            onChange={(e) => setRecruiterNameInput(e.target.value)}
            placeholder="Recruiter name (optional, improves accuracy)"
            className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            onClick={() => void findRecruiter()}
            disabled={busy === "recruiter"}
            className={btnPrimary}
          >
            {busy === "recruiter" ? "Searching…" : app.recruiter ? "Search again" : "Find email"}
          </button>
        </div>
        {alternates.length > 0 && (
          <div className="mt-3 text-xs text-zinc-500">
            Alternates: {alternates.map((a) => `${a.email} (${a.confidence}%)`).join(", ")}
          </div>
        )}
      </section>

      {/* Outreach */}
      <section className={sectionClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cold email</h2>
          <button
            onClick={() => void draftOutreach()}
            disabled={busy === "draft" || !app.tailoredResumeKey || !app.recruiter}
            className={btnSecondary}
          >
            {busy === "draft" ? "Drafting…" : coldEmail ? "Redraft with AI" : "Draft with AI"}
          </button>
        </div>

        {!app.tailoredResumeKey || !app.recruiter ? (
          <p className="text-sm text-zinc-500">
            Tailor the resume and find the recruiter first.
          </p>
        ) : coldEmail?.sentAt ? (
          <div className="text-sm">
            <p>
              Sent to <strong>{app.recruiter.email}</strong> on{" "}
              {new Date(coldEmail.sentAt).toLocaleString()}
            </p>
            {coldEmail.repliedAt && (
              <p className="mt-1 text-emerald-600">
                Replied on {new Date(coldEmail.repliedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : coldEmail ? (
          <div className="space-y-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm font-medium dark:border-zinc-700"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
            <button onClick={() => void sendEmail()} disabled={busy === "send"} className={btnPrimary}>
              {busy === "send" ? "Sending…" : `Send to ${app.recruiter.email}`}
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No draft yet — click &quot;Draft with AI&quot;.</p>
        )}
      </section>

      {/* LinkedIn */}
      {app.linkedinMessage && (
        <section className={sectionClass}>
          <h2 className="mb-3 text-lg font-semibold">LinkedIn message</h2>
          <p className="mb-3 text-xs text-zinc-500">
            LinkedIn automation isn&apos;t allowed by their terms — copy each message and send it
            yourself.
          </p>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Connection note</p>
              <p className="mb-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                {app.linkedinMessage.connectionNote}
              </p>
              <button
                onClick={() => void copyLinkedIn(app.linkedinMessage!.connectionNote)}
                className={btnSecondary}
              >
                Copy connection note
              </button>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Follow-up DM</p>
              <p className="mb-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                {app.linkedinMessage.message}
              </p>
              <button
                onClick={() => void copyLinkedIn(app.linkedinMessage!.message)}
                className={btnSecondary}
              >
                Copy message
              </button>
            </div>
            {app.linkedinMessage.copiedAt && (
              <p className="text-xs text-zinc-400">
                Copied on {new Date(app.linkedinMessage.copiedAt).toLocaleString()}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold">Timeline</h2>
        <ol className="space-y-2 text-sm">
          {app.events.map((event) => (
            <li key={event.id} className="flex justify-between gap-4 text-zinc-500">
              <span>{eventLabel(event.type)}</span>
              <span className="shrink-0 text-xs text-zinc-400">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
