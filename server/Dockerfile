# Build stage: compile TS -> dist.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Run stage: prod deps only, migrate then start.
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
EXPOSE 8080
# Apply any pending migrations (idempotent), then launch the API.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
