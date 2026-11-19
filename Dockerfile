# One image for every host (Render, Lightsail, any VPS). See docs/DEPLOY-*.md.
# Builds the API and the client; set SERVE_CLIENT=true to serve both from this container.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install -g npm@11 && npm ci
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY client client
RUN npm run build -w server && npm run build -w client

FROM node:22-alpine AS runtime
ENV NODE_ENV=production TZ=Asia/Singapore
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install -g npm@11 && npm ci --omit=dev -w server --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/drizzle server/drizzle
COPY --from=build /app/client/dist client/dist
WORKDIR /app/server
ENV CLIENT_DIST_DIR=../client/dist PORT=3000
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/index.js"]
