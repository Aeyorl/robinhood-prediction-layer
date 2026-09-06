# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm \
  --filter @pl/chain-config \
  --filter @pl/config \
  --filter @pl/types \
  --filter @pl/database \
  --filter @pl/sdk \
  --filter @pl/api \
  --filter @pl/worker \
  build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
RUN npm install --global pnpm@11.25.0

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
USER node

FROM runtime AS api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@pl/api", "start"]

FROM runtime AS worker
CMD ["pnpm", "--filter", "@pl/worker", "start"]

FROM runtime AS migrate
CMD ["pnpm", "--filter", "@pl/database", "migrate"]
