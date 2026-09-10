FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace @chama/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "3000"]
