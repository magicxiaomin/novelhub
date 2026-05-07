FROM node:20-alpine AS build

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/db/index.js packages/db/index.js
COPY packages/db/index.d.ts packages/db/index.d.ts
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts \
  --filter @novelhub/api... \
  --filter @novelhub/db... \
  --filter @novelhub/shared

COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/shared packages/shared

RUN pnpm --filter @novelhub/db prisma:generate
RUN pnpm --filter @novelhub/shared build
RUN pnpm --filter @novelhub/api build
RUN pnpm prune --prod

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate \
  && addgroup -S nodejs \
  && adduser -S nestjs -G nodejs

COPY --from=build --chown=nestjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nestjs:nodejs /app/packages/db ./packages/db
COPY --from=build --chown=nestjs:nodejs /app/packages/shared ./packages/shared

USER nestjs

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["sh", "-c", "pnpm --filter @novelhub/db exec prisma migrate deploy --schema prisma/schema.prisma && node apps/api/dist/main.js"]
