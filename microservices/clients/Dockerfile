# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Primero dependencias (cacheo eficiente)
COPY package*.json ./
RUN npm ci

# Copiamos TODO el código fuente
COPY . .

# ────────────────────────────────────────────────
# COPIA EXPLÍCITA DE LOS ARCHIVOS JSON ANTES DE BUILD
# Esto es lo que más consistentemente resuelve el problema
RUN mkdir -p dist/catalogs/data
COPY src/catalogs/data/*.json dist/catalogs/data/
# ────────────────────────────────────────────────

# Compilamos
RUN npm run build

# Etapa final - imagen liviana
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Solo copiamos lo estrictamente necesario
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json  

# NO COPIAR NADA MÁS aquí (evitar COPY . .)

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]