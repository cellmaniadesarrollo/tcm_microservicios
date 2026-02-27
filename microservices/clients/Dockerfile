# Etapa 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src/ src/
COPY src/catalogs/data/ dist/catalogs/data/   
RUN npm run build

# Etapa 2: Producción (solo lo necesario)
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Opcional: si usas .env o configs
# COPY .env* ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]