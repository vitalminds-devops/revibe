# Next.js website: pages, login and the /api proxy to the backend.
# The same image runs `npm run db:migrate` (compose "migrate" service) and the admin commands,
# so the Prisma CLI and tsx stay installed.
FROM node:22-slim AS base
# openssl: Prisma's migration engine needs it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
# npm ci runs `prisma generate` (postinstall), which needs the schema and its config first.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY src/lib/env.ts ./src/lib/env.ts
RUN npm ci --no-audit --no-fund
COPY . .
# The /api rewrite target is fixed at build time: the backend's name on the compose network.
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Migrations run in the "migrate" service, so start Next directly (not `npm start`).
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
