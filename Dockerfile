# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/dashboard/package*.json apps/dashboard/
RUN cd apps/dashboard && npm ci
COPY apps/dashboard/ apps/dashboard/
COPY packages/ packages/
COPY workspace.md ./
RUN cd apps/dashboard && npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY apps/dashboard/package*.json apps/dashboard/
RUN cd apps/dashboard && npm ci --omit=dev
COPY apps/dashboard/server.js apps/dashboard/
COPY apps/dashboard/src/data/ apps/dashboard/src/data/
COPY packages/ packages/
COPY --from=builder /app/apps/dashboard/dist apps/dashboard/dist
COPY workspace.md ./
COPY seeds/ seeds/
COPY assets/ assets/
COPY docs/ docs/

# Make node_modules accessible to packages/core/ (Node resolves upward)
RUN ln -s /app/apps/dashboard/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
