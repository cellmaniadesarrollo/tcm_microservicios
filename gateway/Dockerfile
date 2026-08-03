# ETAPA 1: Compilación
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ETAPA 2: Producción - solo deps de prod
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Instala SOLO dependencias de producción (mucho más liviano)
RUN npm ci --omit=dev

# ETAPA 3: Runtime final
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules   

EXPOSE 3000
CMD ["node", "dist/main"]