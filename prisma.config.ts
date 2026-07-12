// Prisma 7 config — the CLI (migrate/studio) reads the connection URL from
// here. The runtime client gets it via the PrismaPg adapter in src/lib/db.ts.
// Prisma Config does NOT auto-load .env, so we load it explicitly.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
