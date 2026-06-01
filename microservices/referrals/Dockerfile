# ETAPA 1: Compilación
FROM node:20-alpine AS builder
WORKDIR /app

# Copiamos archivos de configuración primero
COPY package*.json ./
# Instalamos TODO (incluyendo nest cli y typescript)
RUN npm ci

# Copiamos el código fuente y compilamos
COPY . .
RUN npm run build

# ETAPA 2: Producción
FROM node:20-alpine
WORKDIR /app

# Variable para que Nest sepa que es producción
ENV NODE_ENV=production

# Copiamos SOLO lo que Nest generó en la etapa anterior
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Ejecutamos el archivo principal de NestJS
CMD ["node", "dist/main"]