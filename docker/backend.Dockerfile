FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/prisma apps/backend/prisma
COPY apps/backend/prisma.config.ts apps/backend/prisma.config.ts
RUN npm ci --no-audit --no-fund
COPY apps/backend apps/backend
RUN npm run build -w apps/backend

FROM base
WORKDIR /workspace/apps/backend
COPY --from=build --chown=node:node /workspace /workspace
COPY docker /workspace/docker
RUN mkdir -p /data/firebase && chown node:node /data/firebase
USER node
EXPOSE 3000 9099
CMD ["node", "/workspace/docker/start-demo.mjs"]
