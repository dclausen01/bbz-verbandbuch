# ============================================================================
#  Verbandsbuch BBZ – monolithisches Image (Frontend + API + LDAP-Login).
#  Ein Prozess, ein Port. Start: node .output/server/index.mjs
# ============================================================================

FROM node:24.11.1-bookworm-slim AS build_stage

WORKDIR /app

# Build-Werkzeuge als Fallback, falls für better-sqlite3 kein Prebuild passt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Laufzeit-Image: enthält nur das fertige Nitro-Bundle (inkl. node_modules) ---
FROM node:24.11.1-bookworm-slim AS prod_stage

WORKDIR /app

COPY --from=build_stage /app/.output ./.output

# Persistentes Datenverzeichnis für die SQLite-Datei.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
ENV DB_PATH=/app/data/verbandbuch.db
ENV TZ=Europe/Berlin

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
