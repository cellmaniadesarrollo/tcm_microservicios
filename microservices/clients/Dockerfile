# Dockerfile (en gateway/ o cada microservicio)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Forzamos copia explícita de los json ANTES del build
COPY src/catalogs/data/ dist/catalogs/data/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# NO copies todo el proyecto aquí
# COPY . .   ← ¡ELIMINA ESTA LÍNEA!

CMD ["node", "dist/main.js"]
EXPOSE 3000