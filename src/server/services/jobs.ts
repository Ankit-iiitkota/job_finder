import { z } from "zod";
import { JobSource, type Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Job listing service — shared by the API route (client-side fetches) and
 * the server-rendered jobs page (direct call, no internal HTTP round-trip).
 */
export const listJobsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  source: z.enum(JobSource).optional(),
  remote: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  source: JobSource;
  sourceUrl: string;
  postedAt: Date | null;
}

export interface JobListResult {
  jobs: JobListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listJobs(query: ListJobsQuery): Promise<JobListResult> {
  const where: Prisma.JobWhereInput = {
    ...(query.source && { source: query.source }),
    ...(query.remote !== undefined && { remote: query.remote }),
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { company: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, jobs] = await Promise.all([
    db.job.count({ where }),
    db.job.findMany({
      where,
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { scrapedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        remote: true,
        salaryMin: true,
        salaryMax: true,
        source: true,
        sourceUrl: true,
        postedAt: true,
      },
    }),
  ]);

  return {
    jobs,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
