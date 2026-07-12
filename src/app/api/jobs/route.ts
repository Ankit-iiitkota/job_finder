import { NextResponse } from "next/server";
import { z } from "zod";
import { JobSource, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { apiHandler } from "@/lib/errors";

/**
 * GET /api/jobs — search / filter / paginate stored jobs.
 *   ?q=react&source=REMOTEOK&remote=true&page=1&pageSize=20
 */
const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  source: z.enum(JobSource).optional(),
  remote: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = apiHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = listQuerySchema.parse(Object.fromEntries(searchParams));

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

  return NextResponse.json({
    jobs,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
});
