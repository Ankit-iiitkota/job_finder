# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js app. Deploy target: a VM alongside n8n
# (see docker-compose.yml for local dev, and n8n/README.md for the split
# between "n8n owns cron" and "the app owns endpoints"). Vercel does not use
# this file — it builds directly from the repo.
#
# No LaTeX binary is installed here: src/server/latex/compile.ts
# auto-detects Tectonic's absence and falls back to the free remote compile
# API, so the same code runs correctly on this slim image or on Vercel's
# serverless functions with zero config difference.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma only needs a syntactically valid URL to generate the client at
# build time — it never connects. Real credentials are supplied at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/latex-templates ./latex-templates

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
