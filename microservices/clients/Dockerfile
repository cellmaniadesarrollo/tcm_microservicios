# Etapa builder: instala todo, copia código y fuerza assets
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias primero (cache bueno)
COPY package*.json ./
RUN npm ci   # o npm install si no usas lockfile

# Copia todo el proyecto (src, nest-cli.json, etc.)
COPY . .

# ─────────────────────────────────────────────────────────────
# FUERZA creación y copia de los JSON (lo más confiable aquí)
RUN mkdir -p dist/catalogs/data && \
    cp -r src/catalogs/data/*.json dist/catalogs/data/ 2>/dev/null || true
# ─────────────────────────────────────────────────────────────

# Compila (debe usar nest build o tsc según tu package.json scripts)
RUN npm run build

# Etapa producción: solo lo esencial
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copiamos lo compilado + node_modules prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Si tienes otros archivos necesarios (ej: .env.prod, configs fuera de src)
# COPY .env* ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]