# Etapa 1: Builder (compila + fuerza copia de assets)
FROM node:20-alpine AS builder

WORKDIR /app

# Copia solo dependencias primero (buen cacheo)
COPY package*.json ./
RUN npm ci

# Copia todo el código (incluyendo nest-cli.json, tsconfig, src, etc.)
COPY . .

# ───────────────────────────────────────────────────────────────
# FUERZA COPIA DE LA CARPETA catalogs/data ANTES DEL BUILD
# Esto crea la estructura en dist/ independientemente de nest-cli.json
RUN mkdir -p dist/catalogs/data && \
    cp -r src/catalogs/data/* dist/catalogs/data/ 2>/dev/null || true
# El "|| true" evita que falle si la carpeta está vacía
# ───────────────────────────────────────────────────────────────

# Ahora sí compilamos (nest build o tsc)
RUN npm run build

# Etapa 2: Producción (imagen liviana)
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copia solo lo necesario del builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Opcional: si tienes .env o configs que no van en dist
# COPY .env* ./

# Corre como usuario no-root (buena práctica)
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]