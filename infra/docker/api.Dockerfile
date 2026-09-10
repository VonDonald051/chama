FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run db:generate && npm run build --workspace @chama/database && npm run build --workspace @chama/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/database ./packages/database
CMD ["node", "apps/api/dist/server.js"]
