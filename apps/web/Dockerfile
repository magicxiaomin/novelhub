FROM node:20-alpine AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile \
  --filter @novelhub/web... \
  --filter @novelhub/shared

COPY apps/web apps/web
COPY packages/shared packages/shared

RUN pnpm --filter @novelhub/web build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
# Next standalone trace doesn't always pick up dynamic Sentry imports from
# instrumentation.ts; copy the config files explicitly so the runtime image
# can resolve them.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/sentry.client.config.ts ./apps/web/sentry.client.config.ts
COPY --from=build --chown=nextjs:nodejs /app/apps/web/sentry.server.config.ts ./apps/web/sentry.server.config.ts
COPY --from=build --chown=nextjs:nodejs /app/apps/web/sentry.edge.config.ts ./apps/web/sentry.edge.config.ts

USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
